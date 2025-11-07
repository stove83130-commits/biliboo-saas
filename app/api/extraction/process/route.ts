/**
 * API Endpoint pour traiter une extraction de factures
 * POST /api/extraction/process?jobId=xxx
 * 
 * Cet endpoint est appelé par /api/extraction/start pour garantir l'exécution
 * même si la fonction principale se termine (problème Vercel serverless)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes maximum pour Vercel Pro (60s pour Hobby)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractInvoiceData } from '@/lib/services/invoice-ocr-extractor';
import { convertHtmlToImage, cleanHtmlForScreenshot } from '@/lib/utils/html-to-image';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Nettoie les caractères Unicode invalides pour PostgreSQL
 */
function sanitizeForPostgres(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(/\u0000/g, '')
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForPostgres);
  }
  if (value && typeof value === 'object') {
    const cleaned: any = {};
    for (const key in value) {
      cleaned[key] = sanitizeForPostgres(value[key]);
    }
    return cleaned;
  }
  return value;
}

/**
 * Normalise une chaîne pour la comparaison (lowercase, trim, suppression accents)
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/\s+/g, ' '); // Normaliser les espaces
}

/**
 * Normalise un montant pour la comparaison (arrondi à 2 décimales)
 */
function normalizeAmount(amount: any): number | null {
  if (amount === null || amount === undefined) return null;
  const num = parseFloat(amount.toString());
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100; // Arrondir à 2 décimales
}

export async function POST(req: NextRequest) {
  try {
    console.log('\n🔵 ========== API: Extraction Process ==========');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    // 1. Authentification utilisateur
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer le jobId
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Paramètre jobId requis' },
        { status: 400 }
      );
    }

    // 3. Récupérer le job
    const { data: job, error: jobError } = await supabaseService
      .from('extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      console.error('❌ Job introuvable:', jobError);
      return NextResponse.json(
        { error: 'Job d\'extraction introuvable' },
        { status: 404 }
      );
    }

    // 4. Vérifier que le job n'est pas déjà terminé OU en cours de traitement
    // IMPORTANT: Empêcher les appels multiples pour le même job (race condition)
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(`⚠️ Job ${jobId} déjà terminé avec le statut: ${job.status}`);
      return NextResponse.json({
        success: true,
        message: 'Job déjà terminé',
        status: job.status,
      });
    }
    
    // Vérifier si le job est déjà en cours de traitement (pour éviter les appels multiples)
    // IMPORTANT: Si le job est "processing", refuser TOUS les appels supplémentaires
    // pour éviter les instances parallèles qui créent des doublons
    if (job.status === 'processing') {
      // Vérifier si une instance est déjà en cours en regardant le progress
      // Si progress.processing_started_at existe et est récent (< 2 minutes), c'est qu'une instance tourne
      const progress = job.progress || {};
      const processingStartedAt = (progress as any)?.processing_started_at;
      
      if (processingStartedAt) {
        const startedAt = new Date(processingStartedAt).getTime();
        const now = Date.now();
        const timeSinceStart = now - startedAt;
        
        // Si une instance a démarré il y a moins de 2 minutes, refuser l'appel
        // (une extraction normale ne devrait pas prendre plus de 2 minutes pour démarrer)
        if (timeSinceStart < 120000) { // 2 minutes
          console.log(`⚠️ Job ${jobId} déjà en cours de traitement (instance active détectée depuis ${Math.round(timeSinceStart / 1000)}s), ignoré`);
          return NextResponse.json({
            success: true,
            message: 'Job déjà en cours de traitement',
            status: 'processing',
          });
        } else {
          // Si plus de 2 minutes, c'est peut-être une instance bloquée, on peut la relancer
          console.log(`⚠️ Job ${jobId} en "processing" depuis plus de 2 minutes, possible instance bloquée - Relance autorisée`);
        }
      } else {
        // Pas de timestamp, mais status = processing, vérifier l'âge du job
        const jobCreatedAt = new Date(job.created_at).getTime();
        const now = Date.now();
        const timeSinceCreation = now - jobCreatedAt;
        
        // Si le job a été créé il y a moins de 30 secondes, c'est probablement un appel en double
        if (timeSinceCreation < 30000) { // 30 secondes
          console.log(`⚠️ Job ${jobId} déjà en cours de traitement (créé il y a ${Math.round(timeSinceCreation / 1000)}s), ignoré`);
          return NextResponse.json({
            success: true,
            message: 'Job déjà en cours de traitement',
            status: 'processing',
          });
        } else {
          // Job en processing depuis plus de 30 secondes sans timestamp, possible instance bloquée
          console.log(`⚠️ Job ${jobId} en "processing" depuis plus de 30 secondes sans timestamp, possible instance bloquée - Relance autorisée`);
        }
      }
    }

    // 5. Récupérer la connexion email
    const { data: emailAccount, error: accountError } = await supabaseService
      .from('email_accounts')
      .select('*')
      .eq('id', job.connection_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !emailAccount) {
      console.error('❌ Erreur récupération compte:', accountError);
      await supabaseService
        .from('extraction_jobs')
        .update({
          status: 'failed',
          error_message: 'Compte email introuvable',
        })
        .eq('id', jobId);
      return NextResponse.json(
        { error: 'Compte email introuvable' },
        { status: 404 }
      );
    }

    console.log(`🚀 Traitement extraction job ${jobId}`);

    // 6. Mettre à jour le statut à 'processing' si nécessaire
    if (job.status !== 'processing') {
      await supabaseService
        .from('extraction_jobs')
        .update({
          status: 'processing',
        })
        .eq('id', jobId);
    }

    // IMPORTANT: Retourner immédiatement une réponse pour éviter le timeout 504
    // L'extraction sera traitée en arrière-plan
    const extractionPromise = processExtractionInBackground(jobId, user.id, job, emailAccount).catch((error) => {
      console.error(`❌ Erreur extraction job ${jobId}:`, error);
    });

    // Retourner immédiatement pour éviter le timeout
    return NextResponse.json({
      success: true,
      message: 'Extraction démarrée en arrière-plan',
      jobId: jobId,
    });
  } catch (error: any) {
    console.error(`❌ Erreur API extraction process:`, error);
    return NextResponse.json(
      {
        error: 'Erreur lors du démarrage de l\'extraction',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Fonction séparée pour traiter l'extraction en arrière-plan (peut prendre plusieurs minutes)
async function processExtractionInBackground(
  jobId: string,
  userId: string,
  job: any,
  emailAccount: any
) {
  try {
    console.log('\n🟢 ========== processExtractionInBackground DÉMARRÉE ==========')
    console.log(`📋 Job ID: ${jobId}`)
    console.log(`👤 User ID: ${userId}`)
    console.log(`📧 Email Account: ${emailAccount.email}`)
    console.log(`📅 Période: ${job.start_date} → ${job.end_date}`)
    console.log(`📊 Progress initial du job:`, job.progress)
    
    // IMPORTANT: Marquer que le traitement a démarré (verrou pour éviter les instances parallèles)
    const processingStartedAt = new Date().toISOString();
    await supabaseService
      .from('extraction_jobs')
      .update({
        progress: {
          ...(job.progress || {}),
          processing_started_at: processingStartedAt, // Verrou pour éviter les instances parallèles
          workspaceId: (job.progress as any)?.workspaceId || null,
          emailsAnalyzed: (job.progress as any)?.emailsAnalyzed || 0,
          invoicesFound: (job.progress as any)?.invoicesFound || 0,
          invoicesDetected: (job.progress as any)?.invoicesDetected || 0,
          emailsRejected: (job.progress as any)?.emailsRejected || 0,
        },
      })
      .eq('id', jobId);
    
    console.log(`🔒 Verrou de traitement activé (processing_started_at: ${processingStartedAt})`);
    
    // 7. Configurer OAuth2 pour Gmail
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: emailAccount.access_token,
      refresh_token: emailAccount.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 8. Calculer les dates
    const startDate = job.start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = job.end_date || new Date().toISOString().split('T')[0];
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime() + 86400000;

    console.log(`📧 Récupération emails Gmail du ${startDate} au ${endDate}`);

    // 9. Récupérer les emails avec FILTRAGE PRÉALABLE pour optimiser la vitesse
    // OPTIMISATION: Filtrer directement dans la requête Gmail pour ne récupérer que les emails pertinents
    // Cela réduit drastiquement le nombre d'emails à traiter
    let allMessages: any[] = [];
    let pageToken: string | undefined = undefined;
    
    // Construire une requête de filtrage intelligente pour Gmail
    // On cherche les emails avec des mots-clés facture/receipt dans le sujet OU avec des PDF attachés
    const gmailQuery = `after:${Math.floor(startTimestamp / 1000)} before:${Math.floor(endTimestamp / 1000)} (subject:facture OR subject:invoice OR subject:receipt OR subject:reçu OR subject:bill OR has:attachment filename:pdf)`;
    
    console.log(`🔍 Recherche emails avec filtre Gmail: ${gmailQuery}`);
    
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: gmailQuery,
        maxResults: 500,
        pageToken,
      });

      const batchMessages = response.data.messages || [];
      allMessages = allMessages.concat(batchMessages);
      pageToken = response.data.nextPageToken || undefined;

      console.log(`📬 ${batchMessages.length} emails récupérés avec filtre (total: ${allMessages.length})`);
    } while (pageToken);

    console.log(`✅ TOTAL: ${allMessages.length} emails trouvés sur la période (après filtrage Gmail)`);
    
    // Si aucun email trouvé avec le filtre, essayer sans filtre (fallback)
    if (allMessages.length === 0) {
      console.log(`⚠️ Aucun email trouvé avec filtre, recherche sans filtre (fallback)...`);
      allMessages = [];
      pageToken = undefined;
      
      do {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: `after:${Math.floor(startTimestamp / 1000)} before:${Math.floor(endTimestamp / 1000)}`,
          maxResults: 500,
          pageToken,
        });

        const fallbackMessages = response.data.messages || [];
        allMessages = allMessages.concat(fallbackMessages);
        pageToken = response.data.nextPageToken || undefined;

        console.log(`📬 ${fallbackMessages.length} emails récupérés sans filtre (total: ${allMessages.length})`);
      } while (pageToken);
      
      console.log(`✅ TOTAL: ${allMessages.length} emails trouvés sans filtre`);
    }
    
    const messages = allMessages;

    let invoicesFound = 0;
    let invoicesDetected = 0; // Compteur pour les factures détectées (même si rejetées ensuite)
    let emailsAnalyzed = 0;
    let emailsRejected = 0;
    let rejectionReasons: { [key: string]: number } = {};
    let lastProgressUpdate = 0; // Initialiser à 0 pour que la première mise à jour se fasse immédiatement
    
    // CACHE EN MÉMOIRE pour éviter les doublons dans la même session d'extraction
    // Clé: "vendor|invoice_number|amount|date" (normalisé)
    // Valeur: true si déjà inséré dans cette session
    const sessionInsertedInvoices = new Map<string, boolean>();

    // Fonction pour mettre à jour le progress périodiquement
    const updateProgress = async (force = false) => {
      const now = Date.now();
      // Mettre à jour toutes les 2 secondes (pour correspondre au polling du frontend) ou si forcé
      // La première mise à jour se fera toujours (car lastProgressUpdate = 0)
      if (force || now - lastProgressUpdate > 2000) {
        try {
          const progressData = {
            emailsAnalyzed,
            invoicesFound,
            invoicesDetected,
            emailsRejected,
          };
          
          const { error: updateError } = await supabaseService
            .from('extraction_jobs')
            .update({
              progress: progressData,
            })
            .eq('id', jobId);
          
          if (updateError) {
            console.error('❌ Erreur mise à jour progress:', updateError);
          } else {
            lastProgressUpdate = now;
            console.log(`📊 Progress mis à jour: ${invoicesFound} factures sauvegardées, ${emailsAnalyzed} emails analysés`);
            
            // Vérifier que la mise à jour a bien été effectuée (pour déboguer)
            const { data: verifyJob } = await supabaseService
              .from('extraction_jobs')
              .select('progress')
              .eq('id', jobId)
              .single();
            
            if (verifyJob?.progress) {
              console.log(`📊 [VERIF] Progress sauvegardé dans DB:`, verifyJob.progress);
            } else {
              console.warn(`⚠️ [VERIF] Progress non trouvé après mise à jour`);
            }
          }
        } catch (error) {
          console.error('❌ Erreur mise à jour progress:', error);
        }
      }
    };

    // Mise à jour initiale pour que le frontend voie immédiatement que l'extraction a commencé
    console.log(`📊 Mise à jour initiale du progress (0 factures, 0 emails analysés)`)
    await updateProgress(true);
    console.log(`✅ Progress initial mis à jour avec succès`)

    // 10. Traiter TOUS les emails
    console.log(`🔄 Début du traitement de ${messages.length} emails...`)
    for (const message of messages) {
      emailsAnalyzed++;
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const headers = fullMessage.data.payload?.headers || [];
        const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
        const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
        const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';

        // Extraire le contenu HTML de l'email
        let emailHtml = '';
        const payload = fullMessage.data.payload;
        if (payload?.body?.data) {
          emailHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              emailHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            }
          }
        }

        // ========== VALIDATION PRÉALABLE STRICTE ==========
        const subjectLower = subject.toLowerCase();
        const fromLower = from.toLowerCase();
        
        // 1. EXCLUSION D'EXPÉDITEURS CONNUS POUR ENVOYER DES NON-FACTURES
        // Exclusion stricte : vérifier le nom ET le domaine
        const excludedSenders = [
          'receiptor', 'automation', 'noreply@qonto', 'no-reply@qonto',
          'notifications@qonto', 'support@qonto'
        ];
        const excludedDomains = [
          'receiptor.ai', 'receiptor.com', 'bilibou.com', 'bilibou.ai'
        ];
        
        // Vérifier si l'expéditeur contient un nom exclu (plus strict : doit être présent dans le nom OU l'email)
        // Format email possible : "Receiptor Automation <noreply@receiptor.ai>" ou "noreply@receiptor.ai"
        const hasExcludedSenderName = excludedSenders.some(excluded => {
          // Vérifier dans le nom complet (avant <) et dans l'adresse email (après <)
          return fromLower.includes(excluded);
        });
        
        // Vérifier si l'expéditeur est d'un domaine exclu (plus strict : doit correspondre exactement au domaine)
        const hasExcludedDomain = excludedDomains.some(domain => {
          // Extraire le domaine de l'email (partie après @)
          // Format possible : "Name <email@domain.com>" ou "email@domain.com" ou "Name email@domain.com"
          const emailMatch = fromLower.match(/@([^\s<>]+)/);
          if (emailMatch) {
            const emailDomain = emailMatch[1];
            // Vérifier si le domaine correspond exactement ou se termine par le domaine exclu
            // Ex: "receiptor.ai" doit matcher "noreply@receiptor.ai" ou "receiptor.ai"
            return emailDomain === domain || 
                   emailDomain.endsWith('.' + domain) || 
                   emailDomain.includes(domain.replace('.', ''));
          }
          // Si pas de @ trouvé, vérifier si le domaine est présent dans le texte (fallback)
          return fromLower.includes(domain);
        });
        
        // Exclusion si nom exclu OU domaine exclu
        const isExcludedSender = hasExcludedSenderName || hasExcludedDomain;
        
        // Log pour déboguer si un email suspect passe
        if (fromLower.includes('receiptor') || fromLower.includes('bilibou')) {
          console.log(`🔍 [DEBUG] Email suspect détecté: "${subject.substring(0, 50)}" de ${from}`);
          console.log(`   - fromLower: "${fromLower}"`);
          console.log(`   - hasExcludedSenderName: ${hasExcludedSenderName}`);
          console.log(`   - hasExcludedDomain: ${hasExcludedDomain}`);
          console.log(`   - isExcludedSender: ${isExcludedSender}`);
          console.log(`   - hasExcludedSubjectPattern: ${hasExcludedSubjectPattern}`);
          console.log(`   - subjectLower: "${subjectLower}"`);
          
          // Si l'email suspect passe quand même, c'est un problème critique
          if (!isExcludedSender && !hasExcludedSubjectPattern) {
            console.error(`❌ [CRITIQUE] Email suspect n'a PAS été exclu !`);
            console.error(`   - Expéditeur: ${from}`);
            console.error(`   - Sujet: ${subject}`);
            console.error(`   - Raison: isExcludedSender=${isExcludedSender}, hasExcludedSubjectPattern=${hasExcludedSubjectPattern}`);
          }
        }
        
        // 2. EXCLUSION DE PATTERNS DANS LE SUJET (automation, notification, etc.)
        const excludedSubjectPatterns = [
          'automation', 'notification', 'alert', 'reminder', 'update', 'newsletter',
          'confirmation', 'welcome', 'account', 'security', 'password', 'verify',
          'conditions générales', 'cgv', 'cgu', 'terms and conditions', 'privacy policy',
          'politique de confidentialité', 'mentions légales',
          'export', 'csv', 'report', 'history', 'download', 'link', 'expire', // Patterns pour emails système
          'receipts history', 'exports history', 'data export' // Patterns spécifiques pour Receiptor
        ];
        const hasExcludedSubjectPattern = excludedSubjectPatterns.some(pattern => 
          subjectLower.includes(pattern)
        );
        
        // 3. DÉTECTION DES MOTS-CLÉS FACTURE (mots entiers uniquement)
        // Utiliser des regex pour détecter les mots entiers, pas des sous-chaînes
        const invoiceKeywordPatterns = [
          /\bfacture\b/i,
          /\binvoice\b/i,
          /\breceipt\b/i,
          /\breçu\b/i,
          /\bbill\b/i,
          /\bdevis\b/i,
          /\bquote\b/i
        ];
        const hasInvoiceKeywordInSubject = invoiceKeywordPatterns.some(pattern => 
          pattern.test(subject)
        );
        
        // 4. VÉRIFICATION DES PDFS ATTACHÉS
        const parts = fullMessage.data.payload?.parts || [];
        let hasPdfAttachment = false;
        let pdfAttachment: any = null;
        let pdfExcluded = false;
        let pdfExcludedReason = '';

        for (const part of parts) {
          if (
            part.mimeType === 'application/pdf' ||
            part.filename?.toLowerCase().endsWith('.pdf')
          ) {
            const filename = part.filename?.toLowerCase() || '';
            
            // Patterns d'exclusion pour les PDFs (CGU, CGV, etc.)
            const excludedPdfPatterns = [
              'condition', 'cgu', 'cgv', 'terms', 'tcu', 'policy', 'politique',
              'contrat', 'contract', 'agreement', 'accord', 'legal', 'privacy',
              'confidentialit', 'rgpd', 'gdpr', 'mention', 'statut', 'regulation',
              'règlement', 'guide', 'manual', 'manuel', 'tutorial', 'tutoriel'
            ];
            
            const isExcludedPdf = excludedPdfPatterns.some(pattern => filename.includes(pattern));
            
            // Vérifier aussi si le sujet contient des patterns d'exclusion
            const isSubjectExcluded = excludedSubjectPatterns.some(pattern => 
              subjectLower.includes(pattern)
            );
            
            if (isExcludedPdf || isSubjectExcluded) {
              pdfExcluded = true;
              pdfExcludedReason = isExcludedPdf 
                ? `PDF exclu (nom fichier): ${part.filename}`
                : `PDF exclu (sujet): ${subject.substring(0, 50)}`;
            } else {
              // Vérifier que le nom du PDF contient des indicateurs de facture
              const invoicePdfPatterns = [
                'facture', 'invoice', 'receipt', 'reçu', 'bill', 'devis', 'quote'
              ];
              const hasInvoiceIndicator = invoicePdfPatterns.some(pattern => 
                filename.includes(pattern)
              );
              
              // Si le PDF n'a pas d'indicateur de facture dans le nom, vérifier le sujet
              if (!hasInvoiceIndicator && !hasInvoiceKeywordInSubject) {
                pdfExcluded = true;
                pdfExcludedReason = `PDF sans indicateur facture: ${part.filename}`;
              } else {
                hasPdfAttachment = true;
                pdfAttachment = part;
                break;
              }
            }
          }
        }
        
        // 5. DÉTECTION DES EXPÉDITEURS DE CONFIANCE (liste de domaines connus)
        const trustedDomains = [
          'stripe.com', 'paypal.com', 'square.com', 'invoice', 'billing',
          'noreply', 'no-reply', 'notifications', 'receipts',
          'apple.com', 'email.apple.com' // Ajouter Apple pour les reçus
        ];
        const isTrustedSender = trustedDomains.some(domain => fromLower.includes(domain));
        
        // 6. DÉTECTION GÉNÉRIQUE DES EMAILS D'ENTREPRISES (pas personnels)
        // Un email d'entreprise a généralement :
        // - Un domaine personnalisé (pas gmail.com, outlook.com, etc.)
        // - Un format "noreply@", "no-reply@", "receipts@", "billing@", etc.
        // - Un domaine avec extension .com, .fr, .net, etc. (pas les domaines personnels)
        const personalDomains = ['@gmail.com', '@outlook.com', '@hotmail.com', '@yahoo.com', '@icloud.com'];
        const isPersonalEmail = personalDomains.some(domain => fromLower.includes(domain));
        
        // Détecter si c'est un email d'entreprise (générique, pas seulement Apple)
        // Un email d'entreprise = pas un email personnel ET (domaine personnalisé OU format noreply/no-reply/receipts/billing)
        const hasBusinessEmailPattern = fromLower.includes('noreply') || 
                                       fromLower.includes('no-reply') || 
                                       fromLower.includes('receipts') || 
                                       fromLower.includes('billing') || 
                                       fromLower.includes('invoice') ||
                                       fromLower.includes('order') ||
                                       fromLower.includes('payment');
        
        // Un domaine personnalisé = contient un point ET n'est pas un domaine personnel
        const hasCustomDomain = fromLower.includes('.') && !isPersonalEmail;
        
        // C'est une entreprise si : domaine personnalisé OU pattern email d'entreprise
        const isBusinessEmail = hasCustomDomain || hasBusinessEmailPattern;
        
        // ========== RÈGLES DE DÉTECTION FINALE (STRICTES) ==========
        // RÈGLE 1: PDF attaché avec indicateur de facture = CANDIDAT (sera validé par GPT après extraction)
        // RÈGLE 2: Mot-clé facture dans sujet + pas email personnel = CANDIDAT (mais OBLIGATOIREMENT analyser le HTML pour confirmer)
        // RÈGLE 3: Expéditeur exclu = REJETÉ IMMÉDIATEMENT
        // RÈGLE 4: Pattern d'exclusion dans sujet = REJETÉ IMMÉDIATEMENT
        // 
        // IMPORTANT: On ne marque PAS comme facture tant qu'on n'a pas vérifié le contenu (PDF ou HTML)
        // Un simple mot-clé dans le sujet ne suffit PLUS - il faut une preuve concrète (PDF ou analyse HTML)
        
        // Candidat si : PDF attaché OU (mot-clé facture + expéditeur valide + pas email personnel)
        // Mais on ne marquera comme facture qu'après validation du contenu
        // IMPORTANT: L'exclusion de l'expéditeur et du sujet est PRIORITAIRE - même avec un PDF, on rejette si expéditeur exclu
        const isInvoiceCandidate = !isExcludedSender && 
                                   !hasExcludedSubjectPattern &&
                                   (hasPdfAttachment || 
                                    (hasInvoiceKeywordInSubject && (isTrustedSender || isBusinessEmail) && !isPersonalEmail && emailHtml));
        
        // Log critique si un email exclu passe quand même
        if ((isExcludedSender || hasExcludedSubjectPattern) && isInvoiceCandidate) {
          console.error(`❌ [ERREUR CRITIQUE] Email exclu est passé comme candidat !`);
          console.error(`   - Expéditeur: ${from}`);
          console.error(`   - Sujet: ${subject}`);
          console.error(`   - isExcludedSender: ${isExcludedSender}`);
          console.error(`   - hasExcludedSubjectPattern: ${hasExcludedSubjectPattern}`);
          console.error(`   - isInvoiceCandidate: ${isInvoiceCandidate}`);
          // Forcer le rejet
          emailsRejected++;
          continue;
        }
        
        // Pour les emails sans PDF, on devra analyser le HTML AVANT de confirmer que c'est une facture
        const needsHtmlAnalysis = !hasPdfAttachment && hasInvoiceKeywordInSubject && (isTrustedSender || isBusinessEmail) && !isPersonalEmail && emailHtml;

        // Logs détaillés pour comprendre pourquoi un email est rejeté
        if (!isInvoiceCandidate) {
          emailsRejected++;
          let reason = '';
          if (isExcludedSender) {
            reason = `Expéditeur exclu: ${from}`;
          } else if (hasExcludedSubjectPattern) {
            reason = `Pattern d'exclusion dans sujet: ${subject.substring(0, 50)}`;
          } else if (pdfExcluded) {
            reason = pdfExcludedReason;
          } else if (hasInvoiceKeywordInSubject) {
            if (isPersonalEmail) {
              reason = 'Email personnel avec mot-clé facture (rejeté)';
            } else if (!isTrustedSender && !isBusinessEmail) {
              reason = `Mot-clé facture mais expéditeur non reconnu comme entreprise: ${from}`;
            } else if (!emailHtml) {
              reason = 'Mot-clé facture mais pas de contenu HTML à analyser';
            }
          } else {
            reason = 'Pas de PDF ni mot-clé facture';
          }
          // Logger tous les emails rejetés pour debug (limité aux 20 premiers pour éviter trop de logs)
          if (emailsRejected <= 20) {
            console.log(`🔍 Email ${emailsAnalyzed} rejeté: "${subject.substring(0, 50)}" de ${from.substring(0, 40)} - Raison: ${reason}`);
          }
        }

        // Si c'est un candidat, on va analyser le contenu (PDF ou HTML) pour confirmer
        if (isInvoiceCandidate) {
          // Ne pas incrémenter invoicesDetected tout de suite - on attendra la validation du contenu
          const detectionReason = hasPdfAttachment 
            ? ' (PDF attaché - validation en cours)' 
            : ' (mot-clé détecté - analyse HTML requise)';
          console.log(`🔍 Candidat facture détecté: "${subject}" de ${from}${detectionReason}`);
          
          // Télécharger le PDF si présent
          let fileUrl = null;
          let pdfBuffer: Buffer | null = null;
          let htmlImageUrl = null;
          let htmlMimeType = null;
          
          if (hasPdfAttachment && pdfAttachment.body?.attachmentId) {
            try {
              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id!,
                id: pdfAttachment.body.attachmentId,
              });

              if (attachment.data.data) {
                pdfBuffer = Buffer.from(attachment.data.data, 'base64');
                
                const fileName = `${userId}/${message.id}_${pdfAttachment.filename}`;
                const { data: uploadData, error: uploadError } = await supabaseService.storage
                  .from('invoices')
                  .upload(fileName, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true,
                  });

                if (!uploadError && uploadData) {
                  const { data: urlData } = supabaseService.storage
                    .from('invoices')
                    .getPublicUrl(fileName);
                  
                  fileUrl = urlData.publicUrl;
                }
              }
            } catch (error) {
              console.error(`❌ Erreur upload PDF:`, error);
            }
          } else if (emailHtml && emailHtml.trim().length > 0) {
            // Si pas de PDF mais HTML disponible, sauvegarder le HTML comme image ou HTML
            try {
              console.log(`📸 Conversion HTML en image pour email ${message.id}...`);
              
              // Nettoyer le HTML pour le screenshot
              const cleanedHtml = cleanHtmlForScreenshot(emailHtml);
              
              // Convertir le HTML en image PNG
              const imageBuffer = await convertHtmlToImage(cleanedHtml, 1200);
              
              // Uploader l'image dans Supabase Storage
              const imageFileName = `${userId}/${message.id}_email_screenshot.png`;
              const { data: uploadData, error: uploadError } = await supabaseService.storage
                .from('invoices')
                .upload(imageFileName, imageBuffer, {
                  contentType: 'image/png',
                  upsert: true,
                });

              if (!uploadError && uploadData) {
                const { data: urlData } = supabaseService.storage
                  .from('invoices')
                  .getPublicUrl(imageFileName);
                
                htmlImageUrl = urlData.publicUrl;
                htmlMimeType = 'image/png';
                console.log(`✅ Screenshot HTML sauvegardé: ${htmlImageUrl}`);
              } else {
                console.error(`❌ Erreur upload screenshot HTML:`, uploadError);
                // Fallback: sauvegarder le HTML en base64
                const htmlBase64 = Buffer.from(emailHtml).toString('base64');
                htmlImageUrl = `data:text/html;base64,${htmlBase64}`;
                htmlMimeType = 'text/html';
                console.log(`⚠️ Fallback: HTML sauvegardé en base64`);
              }
            } catch (error) {
              console.error(`❌ Erreur conversion HTML en image:`, error);
              // Fallback: sauvegarder le HTML en base64 si la conversion échoue
              try {
                const htmlBase64 = Buffer.from(emailHtml).toString('base64');
                htmlImageUrl = `data:text/html;base64,${htmlBase64}`;
                htmlMimeType = 'text/html';
                console.log(`⚠️ Fallback: HTML sauvegardé en base64 après erreur conversion`);
              } catch (fallbackError) {
                console.error(`❌ Erreur fallback HTML base64:`, fallbackError);
              }
            }
          }

          // Extraction des données
          let extractedData: any = {};
          
          if (pdfBuffer) {
            try {
              const fullExtraction = await extractInvoiceData(pdfBuffer, {
                from,
                subject,
                date,
              });
              
              if (fullExtraction.document_type && 
                  fullExtraction.document_type !== 'invoice' && 
                  fullExtraction.document_type !== 'receipt') {
                console.log(`❌ Candidat facture rejeté après extraction GPT: type document = ${fullExtraction.document_type} (attendu: invoice/receipt)`);
                emailsRejected++;
                continue;
              }
              
              // ========== VALIDATION STRICTE POST-EXTRACTION GPT ==========
              // RÈGLE EN BÉTON : Une facture/reçu VALIDE doit avoir OBLIGATOIREMENT LES DEUX :
              // 1. Un numéro de facture valide (pas vide, pas juste le sujet de l'email, au moins 3 caractères)
              // 2. Un montant valide (nombre > 0)
              // Si l'un des deux manque, ce n'est PAS une facture/reçu valide
              
              // Vérifier si le numéro de facture est valide
              const invoiceNumber = fullExtraction.invoice_number?.toString().trim() || '';
              const isValidInvoiceNumber = invoiceNumber.length > 0 && 
                                         invoiceNumber !== subject.trim() && 
                                         invoiceNumber.length >= 3; // Au moins 3 caractères
              
              // Vérifier si le montant est valide
              const totalAmount = fullExtraction.total_amount;
              const isValidAmount = totalAmount !== null && 
                                   totalAmount !== undefined && 
                                   !isNaN(Number(totalAmount)) && 
                                   Number(totalAmount) > 0;
              
              // REJETER si le numéro OU le montant n'est pas valide (les DEUX sont obligatoires)
              if (!isValidInvoiceNumber || !isValidAmount) {
                console.log(`❌ Candidat facture rejeté après extraction GPT: numéro ET montant obligatoires`);
                console.log(`   - Numéro facture: "${invoiceNumber}" (valide: ${isValidInvoiceNumber})`);
                console.log(`   - Montant: ${totalAmount} (valide: ${isValidAmount})`);
                console.log(`   - Raison: ${!isValidInvoiceNumber ? 'Numéro de facture manquant ou invalide' : 'Montant manquant ou invalide'}`);
                emailsRejected++;
                continue;
              }
              
              // Validation supplémentaire: score de confiance minimum
              const minConfidenceScore = 50; // Score minimum de 50%
              if (fullExtraction.confidence_score !== undefined && fullExtraction.confidence_score < minConfidenceScore) {
                console.log(`❌ Candidat facture rejeté après extraction GPT: score de confiance trop bas (${fullExtraction.confidence_score} < ${minConfidenceScore})`);
                emailsRejected++;
                continue;
              }
              
              // VÉRIFICATION DE SÉCURITÉ FINALE: Même si le PDF est valide,
              // rejeter si l'expéditeur est dans la liste d'exclusion (double vérification)
              // Cela évite que des PDFs de Receiptor, Bilibou, etc. soient acceptés
              if (isExcludedSender || hasExcludedSubjectPattern) {
                console.error(`❌ [SÉCURITÉ] Email rejeté malgré PDF valide: expéditeur ou sujet exclu`);
                console.error(`   - Expéditeur: ${from}`);
                console.error(`   - Sujet: ${subject}`);
                console.error(`   - isExcludedSender: ${isExcludedSender}`);
                console.error(`   - hasExcludedSubjectPattern: ${hasExcludedSubjectPattern}`);
                emailsRejected++;
                continue; // Rejeter même si le PDF est valide
              }
              
              // Si on arrive ici, c'est une vraie facture validée (PDF)
              invoicesDetected++;
              console.log(`✅ Facture validée après extraction PDF (#${invoicesDetected}): numéro="${invoiceNumber}", montant=${totalAmount} ${fullExtraction.currency || 'EUR'}`);
              
              extractedData = {
                vendor: fullExtraction.vendor_name,
                category: fullExtraction.category || 'Charges exceptionnelles',
                vendor_address: fullExtraction.vendor_address,
                vendor_city: fullExtraction.vendor_city,
                vendor_country: fullExtraction.vendor_country,
                vendor_phone: fullExtraction.vendor_phone,
                vendor_email: fullExtraction.vendor_email,
                vendor_website: fullExtraction.vendor_website,
                customer_name: fullExtraction.customer_name,
                customer_address: fullExtraction.customer_address,
                customer_city: fullExtraction.customer_city,
                customer_country: fullExtraction.customer_country,
                customer_phone: fullExtraction.customer_phone,
                customer_email: fullExtraction.customer_email,
                customer_vat_number: fullExtraction.customer_vat_number,
                amount: fullExtraction.total_amount,
                subtotal: fullExtraction.subtotal,
                tax_amount: fullExtraction.tax_amount,
                tax_rate: fullExtraction.tax_rate,
                currency: fullExtraction.currency,
                date: fullExtraction.invoice_date,
                invoice_number: fullExtraction.invoice_number,
                payment_status: fullExtraction.payment_status,
                payment_method: fullExtraction.payment_method,
                payment_date: fullExtraction.payment_date,
                due_date: fullExtraction.due_date,
                items: fullExtraction.line_items,
                extraction_status: fullExtraction.extraction_status,
                confidence_score: fullExtraction.confidence_score,
                ocr_text: fullExtraction.ocr_text,
              };
            } catch (error) {
              console.error(`❌ Erreur extraction complète:`, error);
              extractedData = {
                vendor: from,
                date: date,
                invoice_number: subject,
                extraction_status: 'failed',
                confidence_score: 0,
              };
            }
          } else if (needsHtmlAnalysis) {
            // OBLIGATOIRE: Analyser le HTML pour confirmer que c'est vraiment une facture
            // On ne peut plus accepter juste sur la base d'un mot-clé dans le sujet
            try {
              console.log(`🔍 Analyse HTML requise pour confirmer la facture: "${subject}"`);
              
              const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
              });
              
              const cleanHtml = emailHtml
                .replace(/<style[^>]*>.*?<\/style>/gis, '')
                .replace(/<script[^>]*>.*?<\/script>/gis, '')
                .replace(/<img[^>]*>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 30000);
              
              const prompt = `Analyse cet email et détermine s'il s'agit d'une VRAIE facture ou d'un VRAI reçu.

IMPORTANT: Ce n'est une facture/reçu QUE si tu trouves :
1. Un montant payé (nombre > 0, pas juste "0" ou vide)
2. Un numéro de facture/reçu valide (pas juste le sujet de l'email, au moins 3 caractères)
3. Des détails de transaction (date, fournisseur, etc.)

Si c'est juste une notification, un lien de téléchargement, un rapport, ou autre chose qui n'est PAS une facture/reçu, retourne "is_invoice": false.

CONTEXTE:
- De: ${from}
- Sujet: ${subject}
- Date: ${date}

CONTENU EMAIL:
${cleanHtml}

Retourne un JSON avec :
{
  "is_invoice": true/false,
  "vendor": "nom fournisseur" (si facture),
  "amount": montant_ttc (si facture, doit être > 0),
  "currency": "EUR/USD" (si facture),
  "date": "YYYY-MM-DD" (si facture),
  "invoice_number": "numéro" (si facture, doit être valide),
  "payment_status": "paid/unpaid" (si facture),
  "payment_method": "méthode" (si facture),
  "confidence_score": 0-100,
  "rejection_reason": "raison du rejet si is_invoice=false"
}`;

              const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                  { role: 'system', content: 'Tu réponds uniquement avec du JSON valide. Sois strict : ce n\'est une facture que si tu trouves un montant réel et un numéro de facture valide.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 1000,
              });
              
              const responseText = completion.choices[0].message.content || '{}';
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysisResult = JSON.parse(jsonMatch[0]);
                
                // Vérifier d'abord si GPT a déterminé que c'est une facture
                if (!analysisResult.is_invoice) {
                  console.log(`❌ Email rejeté après analyse HTML: "${subject}" - ${analysisResult.rejection_reason || 'Pas une facture/reçu valide'}`);
                  emailsRejected++;
                  continue; // Rejeter l'email
                }
                
                // VÉRIFICATION DE SÉCURITÉ FINALE: Même si GPT dit que c'est une facture,
                // rejeter si l'expéditeur est dans la liste d'exclusion (double vérification)
                // Cela évite que GPT se trompe et accepte des emails de Receiptor, Bilibou, etc.
                if (isExcludedSender || hasExcludedSubjectPattern) {
                  console.error(`❌ [SÉCURITÉ] Email rejeté malgré validation GPT: expéditeur ou sujet exclu`);
                  console.error(`   - Expéditeur: ${from}`);
                  console.error(`   - Sujet: ${subject}`);
                  console.error(`   - isExcludedSender: ${isExcludedSender}`);
                  console.error(`   - hasExcludedSubjectPattern: ${hasExcludedSubjectPattern}`);
                  emailsRejected++;
                  continue; // Rejeter même si GPT a dit que c'est une facture
                }
                
                // Si GPT confirme que c'est une facture, extraire les données
                extractedData = {
                  vendor: analysisResult.vendor || from,
                  amount: analysisResult.amount || null,
                  currency: analysisResult.currency || 'EUR',
                  date: analysisResult.date || date,
                  invoice_number: analysisResult.invoice_number || null,
                  payment_status: analysisResult.payment_status || 'unpaid',
                  payment_method: analysisResult.payment_method || null,
                  extraction_status: 'partial',
                  confidence_score: analysisResult.confidence_score || 0,
                };
                
                // ========== VALIDATION STRICTE POST-EXTRACTION GPT (pour emails HTML) ==========
                // RÈGLE EN BÉTON : Même validation que pour les PDFs - numéro ET montant OBLIGATOIRES
                const invoiceNumber = extractedData.invoice_number?.toString().trim() || '';
                const isValidInvoiceNumber = invoiceNumber.length > 0 && 
                                           invoiceNumber !== subject.trim() && 
                                           invoiceNumber.length >= 3;
                
                const totalAmount = extractedData.amount;
                const isValidAmount = totalAmount !== null && 
                                     totalAmount !== undefined && 
                                     !isNaN(Number(totalAmount)) && 
                                     Number(totalAmount) > 0;
                
                // REJETER si le numéro OU le montant n'est pas valide (les DEUX sont obligatoires)
                if (!isValidInvoiceNumber || !isValidAmount) {
                  console.log(`❌ Email rejeté après analyse HTML: numéro ET montant obligatoires`);
                  console.log(`   - Numéro facture: "${invoiceNumber}" (valide: ${isValidInvoiceNumber})`);
                  console.log(`   - Montant: ${totalAmount} (valide: ${isValidAmount})`);
                  console.log(`   - Raison: ${!isValidInvoiceNumber ? 'Numéro de facture manquant ou invalide' : 'Montant manquant ou invalide'}`);
                  emailsRejected++;
                  continue; // Sortir de la boucle pour cet email
                }
                
                // Si on arrive ici, c'est une vraie facture validée
                invoicesDetected++;
                console.log(`✅ Facture validée après analyse HTML (#${invoicesDetected}): numéro="${invoiceNumber}", montant=${totalAmount} ${extractedData.currency || 'EUR'}`);
              } else {
                // Impossible de parser la réponse GPT, rejeter par sécurité
                console.log(`❌ Email rejeté: impossible d'analyser le contenu HTML`);
                emailsRejected++;
                continue;
              }
            } catch (error) {
              console.error(`❌ Erreur analyse HTML:`, error);
              // En cas d'erreur, rejeter par sécurité
              console.log(`❌ Email rejeté: erreur lors de l'analyse HTML`);
              emailsRejected++;
              continue;
            }
          } else {
            // Pas de PDF et pas d'analyse HTML requise = pas une facture
            console.log(`❌ Email rejeté: pas de PDF et pas de contenu HTML à analyser`);
            emailsRejected++;
            continue;
          }
          
          // Si on arrive ici, c'est une facture validée (PDF ou HTML)
          // invoicesDetected a déjà été incrémenté dans les blocs précédents

          // Sauvegarder la facture
          const cleanedData = sanitizeForPostgres(extractedData);
          const cleanedVendor = sanitizeForPostgres(extractedData.vendor || from);
          const cleanedSubject = sanitizeForPostgres(subject);

          // Récupérer le workspace_id depuis le progress JSONB (car la table n'a pas de colonne workspace_id)
          let workspaceIdToUse = null;
          const workspaceIdFromProgress = job.progress?.workspaceId || null;
          
          if (workspaceIdFromProgress) {
            // Vérifier que le workspace existe ET appartient à l'utilisateur
            const { data: workspaceExists, error: workspaceError } = await supabaseService
              .from('workspaces')
              .select('id, owner_id')
              .eq('id', workspaceIdFromProgress)
              .eq('owner_id', userId) // Vérifier que le workspace appartient à l'utilisateur
              .single();
            
            if (workspaceError || !workspaceExists) {
              // Le workspace n'existe pas ou n'appartient pas à l'utilisateur
              console.warn(`⚠️ Workspace ${workspaceIdFromProgress} n'existe pas ou n'appartient pas à l'utilisateur ${userId}, utilisation de null (personnel)`);
              console.warn(`   Erreur workspace:`, workspaceError?.message || 'Workspace introuvable');
              workspaceIdToUse = null; // Utiliser null pour workspace personnel
            } else {
              // Le workspace existe et appartient à l'utilisateur
              workspaceIdToUse = workspaceIdFromProgress;
              console.log(`✅ Workspace ${workspaceIdFromProgress} vérifié et valide`);
            }
          } else {
            // Pas de workspace_id dans le progress = workspace personnel
            workspaceIdToUse = null;
          }

          // ========== VÉRIFICATION DE DOUBLONS AVANT INSERTION ==========
          // Vérifier si cette facture existe déjà dans la base de données
          // Critères de détection de doublon (NORMALISÉS pour éviter les variations) :
          // 1. Même email_id (même email traité plusieurs fois) - PRIORITÉ ABSOLUE
          // 2. Même vendor (normalisé) + invoice_number (normalisé) + amount (normalisé) + date (même facture, même workspace)
          // 3. Même vendor (normalisé) + amount (normalisé) + date (si pas de numéro de facture fiable)
          
          // Normaliser les valeurs pour la comparaison
          const normalizedVendor = normalizeString(cleanedVendor);
          const normalizedInvoiceNumber = normalizeString(cleanedData.invoice_number);
          const normalizedAmount = normalizeAmount(cleanedData.amount);
          const invoiceDate = cleanedData.date ? new Date(cleanedData.date).toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0];
          
          // Vérification 0: CACHE EN MÉMOIRE (vérifier si déjà inséré dans cette session) - PRIORITÉ ABSOLUE
          // Construire une clé unique pour cette facture (vendor + invoice_number + amount + date)
          const sessionCacheKey = `${normalizedVendor}|${normalizedInvoiceNumber}|${normalizedAmount}|${invoiceDate}`;
          if (sessionInsertedInvoices.has(sessionCacheKey)) {
            console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - cache session): ${cleanedVendor} - ${cleanedData.invoice_number} - ${cleanedData.amount} ${cleanedData.currency || 'EUR'} - ${invoiceDate} - Déjà insérée dans cette session`);
            continue;
          }
          
          // Vérification 1: Même email_id (même email = doublon garanti) - PRIORITÉ ABSOLUE
          // IMPORTANT: Vérifier par user_id + email_id uniquement (sans connection_id)
          // car un même email ne devrait être traité qu'UNE SEULE FOIS par utilisateur,
          // même s'il est traité depuis plusieurs comptes email différents
          const { data: existingByEmailId } = await supabaseService
            .from('invoices')
            .select('id, vendor, invoice_number, amount, date, payment_status, connection_id, email_id')
            .eq('user_id', userId)
            .eq('email_id', message.id)
            .limit(1);
          
          if (existingByEmailId && existingByEmailId.length > 0) {
            console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - même email_id): ${message.id} - Facture déjà existante (ID: ${existingByEmailId[0].id}, connection_id: ${existingByEmailId[0].connection_id}), ignorée`);
            continue;
          }
          
          // Vérification 2: Même vendor + invoice_number + amount + date (même facture, même workspace)
          // OPTIMISATION: Utiliser une requête plus ciblée au lieu de charger toutes les factures
          // Filtrer par date récente pour réduire le nombre de factures à charger
          if (normalizedVendor && normalizedInvoiceNumber && normalizedAmount && normalizedInvoiceNumber.length >= 3) {
            // OPTIMISATION: Charger seulement les factures récentes (derniers 6 mois)
            // Cela réduit drastiquement le nombre de factures à charger et comparer
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const { data: allInvoices } = await supabaseService
              .from('invoices')
              .select('id, vendor, invoice_number, amount, date, payment_status, extracted_data, connection_id, email_id')
              .eq('user_id', userId)
              .gte('date', sixMonthsAgo.toISOString()) // Seulement les factures des 6 derniers mois
              .limit(500); // Réduire la limite car on filtre déjà par date
            
            // Filtrer côté client avec normalisation
            let existingByDetails = (allInvoices || []).filter((inv: any) => {
              // Normaliser les valeurs de la facture existante
              const invVendor = normalizeString(inv.vendor || inv.extracted_data?.vendor);
              const invInvoiceNumber = normalizeString(inv.invoice_number || inv.extracted_data?.invoice_number);
              const invAmount = normalizeAmount(inv.amount || inv.extracted_data?.amount);
              const invDate = inv.date ? new Date(inv.date).toISOString().split('T')[0] : null;
              const invWorkspaceId = inv.extracted_data?.workspace_id || null;
              
              // Vérifier si c'est le même workspace
              const sameWorkspace = workspaceIdToUse 
                ? invWorkspaceId === workspaceIdToUse
                : (invWorkspaceId === null || invWorkspaceId === 'personal' || !invWorkspaceId);
              
              // Vérifier si toutes les valeurs correspondent (normalisées)
              return sameWorkspace &&
                     invVendor === normalizedVendor &&
                     invInvoiceNumber === normalizedInvoiceNumber &&
                     invAmount === normalizedAmount &&
                     invDate === invoiceDate;
            });
            
            if (existingByDetails && existingByDetails.length > 0) {
              console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - vendor + numéro + montant + date normalisés): ${cleanedVendor} - ${cleanedData.invoice_number} - ${cleanedData.amount} ${cleanedData.currency || 'EUR'} - ${invoiceDate} - Facture déjà existante (ID: ${existingByDetails[0].id}, email_id: ${existingByDetails[0].email_id}), ignorée`);
              continue;
            }
          }
          
          // Vérification 3: Même vendor + amount + date (si pas de numéro de facture fiable)
          // Utilisé uniquement si le numéro de facture n'est pas fiable (vide ou = sujet email)
          // IMPORTANT: Ne PAS filtrer par connection_id - un même email peut être traité depuis plusieurs comptes
          const isInvoiceNumberReliable = normalizedInvoiceNumber && 
                                        normalizedInvoiceNumber.length >= 3 && 
                                        normalizedInvoiceNumber !== normalizeString(subject);
          
          if (normalizedVendor && normalizedAmount && !isInvoiceNumberReliable) {
            // OPTIMISATION: Charger seulement les factures récentes (derniers 6 mois) avec le même vendor
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const { data: allInvoices } = await supabaseService
              .from('invoices')
              .select('id, vendor, invoice_number, amount, date, payment_status, extracted_data, connection_id, email_id')
              .eq('user_id', userId)
              .gte('date', sixMonthsAgo.toISOString()) // Seulement les factures des 6 derniers mois
              .limit(500); // Réduire la limite car on filtre déjà par date
            
            // Filtrer côté client avec normalisation
            let existingByVendorAmountDate = (allInvoices || []).filter((inv: any) => {
              const invVendor = normalizeString(inv.vendor || inv.extracted_data?.vendor);
              const invAmount = normalizeAmount(inv.amount || inv.extracted_data?.amount);
              const invDate = inv.date ? new Date(inv.date).toISOString().split('T')[0] : null;
              const invWorkspaceId = inv.extracted_data?.workspace_id || null;
              
              const sameWorkspace = workspaceIdToUse 
                ? invWorkspaceId === workspaceIdToUse
                : (invWorkspaceId === null || invWorkspaceId === 'personal' || !invWorkspaceId);
              
              // IMPORTANT: Ne PAS vérifier le connection_id - un même email peut être traité depuis plusieurs comptes
              return sameWorkspace &&
                     invVendor === normalizedVendor &&
                     invAmount === normalizedAmount &&
                     invDate === invoiceDate;
            });
            
            if (existingByVendorAmountDate && existingByVendorAmountDate.length > 0) {
              console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - vendor + montant + date normalisés): ${cleanedVendor} - ${cleanedData.amount} ${cleanedData.currency || 'EUR'} - ${invoiceDate} - Facture déjà existante (ID: ${existingByVendorAmountDate[0].id}, email_id: ${existingByVendorAmountDate[0].email_id}, connection_id: ${existingByVendorAmountDate[0].connection_id}), ignorée`);
              continue;
            }
          }

          console.log(`✅ Aucun doublon détecté, insertion de la facture: ${cleanedVendor} - ${cleanedData.invoice_number || 'N/A'} - ${cleanedData.amount} ${cleanedData.currency || 'EUR'}`);

          // Construire extracted_data avec TOUTES les données (y compris celles qui n'ont pas de colonnes dédiées)
          const fullExtractedData = {
            ...cleanedData,
            // Ajouter les métadonnées supplémentaires
            workspace_id: workspaceIdToUse,
            account_email: emailAccount.email,
          };

          const { error: insertError } = await supabaseService
            .from('invoices')
            .insert({
              user_id: userId,
              connection_id: job.connection_id,
              email_id: message.id,
              // NOTE: workspace_id, subtotal, tax_amount, tax_rate, customer_*, account_email
              // n'existent pas dans la table invoices - toutes ces données sont dans extracted_data (JSONB)
              vendor: cleanedVendor,
              amount: cleanedData.amount || null,
              currency: cleanedData.currency || 'EUR',
              date: cleanedData.date ? new Date(cleanedData.date).toISOString() : new Date(date).toISOString(),
              invoice_number: cleanedData.invoice_number || cleanedSubject,
              description: cleanedData.description || null,
              category: cleanedData.category || 'Charges exceptionnelles',
              // Les colonnes suivantes n'existent pas dans le schéma, stockées dans extracted_data :
              // subtotal, tax_amount, tax_rate, customer_*, workspace_id, account_email
              vendor_address: cleanedData.vendor_address || null,
              vendor_city: cleanedData.vendor_city || null,
              vendor_country: cleanedData.vendor_country || null,
              vendor_phone: cleanedData.vendor_phone || null,
              vendor_email: cleanedData.vendor_email || null,
              vendor_website: cleanedData.vendor_website || null,
              payment_status: cleanedData.payment_status || 'unpaid',
              payment_method: cleanedData.payment_method || null,
              payment_date: cleanedData.payment_date ? new Date(cleanedData.payment_date).toISOString() : null,
              due_date: cleanedData.due_date ? new Date(cleanedData.due_date).toISOString() : null,
              original_file_name: cleanedData.original_file_name || pdfAttachment?.filename || (htmlImageUrl ? `${message.id}_email_screenshot.png` : null),
              original_mime_type: cleanedData.original_mime_type || (pdfAttachment ? 'application/pdf' : (htmlMimeType || null)),
              original_file_url: cleanedData.original_file_url || fileUrl || htmlImageUrl,
              source: 'gmail',
              items: cleanedData.items || null, // Stocker les items dans la colonne items (JSONB)
              extracted_data: fullExtractedData, // Toutes les données supplémentaires dans extracted_data (JSONB)
            });

          if (!insertError) {
            invoicesFound++;
            // Ajouter au cache en mémoire pour éviter les doublons dans la même session
            sessionInsertedInvoices.set(sessionCacheKey, true);
            console.log(`✅ Facture #${invoicesFound} sauvegardée: ${extractedData.vendor || from} - ${cleanedData.amount || 'N/A'} ${cleanedData.currency || 'EUR'} - Workspace: ${workspaceIdToUse || 'null (personnel)'}`);
            // Mettre à jour le progress immédiatement après chaque facture sauvegardée (force = true)
            await updateProgress(true);
          } else {
            // Vérifier si l'erreur est due à la contrainte UNIQUE (doublon)
            const isDuplicateError = insertError.code === '23505' || // PostgreSQL unique violation
                                   insertError.message?.includes('duplicate') ||
                                   insertError.message?.includes('unique') ||
                                   insertError.message?.includes('UNIQUE') ||
                                   insertError.message?.includes('violates unique constraint');
            
            if (isDuplicateError) {
              // C'est un doublon détecté par la contrainte UNIQUE de la DB
              // (race condition ou vérification qui a échoué)
              // Ajouter quand même au cache pour éviter de réessayer
              sessionInsertedInvoices.set(sessionCacheKey, true);
              console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - contrainte UNIQUE DB): ${message.id} - Facture déjà existante, ignorée`);
              // Ne pas incrémenter invoicesFound car c'est un doublon
            } else {
              // Autre erreur d'insertion
              console.error(`❌ Erreur insertion facture #${invoicesDetected}:`, insertError);
              console.error(`   Vendor: ${cleanedVendor}`);
              console.error(`   Amount: ${cleanedData.amount}`);
              console.error(`   Workspace: ${workspaceIdToUse || 'null'}`);
              console.error(`   Email ID: ${message.id}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur traitement email:`, error);
      }
      
      // Mettre à jour le progress périodiquement (tous les 5 emails pour un feedback plus rapide)
      if (emailsAnalyzed % 5 === 0) {
        await updateProgress(false);
      }
      
      // Log de progression tous les 50 emails pour suivre l'avancement
      if (emailsAnalyzed % 50 === 0) {
        console.log(`📊 Progression: ${emailsAnalyzed}/${messages.length} emails analysés (${((emailsAnalyzed / messages.length) * 100).toFixed(1)}%), ${invoicesFound} factures trouvées`);
      }
    }

    console.log(`\n📊 RÉSUMÉ EXTRACTION:`);
    console.log(`   🔍 ${invoicesDetected} factures détectées`);
    console.log(`   ✅ ${invoicesFound} factures sauvegardées`);
    console.log(`   📧 ${emailsAnalyzed} emails analysés`);
    console.log(`   ❌ ${emailsRejected} emails rejetés`);
    console.log(`   📈 Taux de détection: ${emailsAnalyzed > 0 ? ((invoicesDetected / emailsAnalyzed) * 100).toFixed(2) : 0}%`);
    console.log(`   💾 Taux de sauvegarde: ${invoicesDetected > 0 ? ((invoicesFound / invoicesDetected) * 100).toFixed(2) : 0}%\n`);

    // 11. Vérifier le nombre réel de factures sauvegardées dans la DB
    // IMPORTANT: Attendre que toutes les insertions soient terminées avant de marquer comme "completed"
    // Faire plusieurs vérifications avec délai pour s'assurer que toutes les factures sont bien sauvegardées
    let actualInvoicesCount = invoicesFound;
    let verificationAttempts = 0;
    const maxVerificationAttempts = 5; // Maximum 5 tentatives
    
    while (verificationAttempts < maxVerificationAttempts) {
      // Attendre un délai avant de vérifier (pour laisser le temps aux insertions de se terminer)
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seconde entre chaque vérification
      
      const { count: countResult, error: countError } = await supabaseService
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('connection_id', job.connection_id)
        .gte('created_at', job.created_at); // Factures créées après le début du job
      
      if (!countError && countResult !== null) {
        console.log(`📊 [VERIFICATION ${verificationAttempts + 1}] Nombre réel de factures dans la DB: ${countResult} (compteur: ${invoicesFound})`);
        
        if (countResult > actualInvoicesCount) {
          actualInvoicesCount = countResult;
          console.log(`⚠️ [CORRECTION] Le nombre réel (${countResult}) est supérieur, utilisation du nombre réel`);
        }
        
        // Si le nombre est stable (identique à la vérification précédente), on peut arrêter
        if (verificationAttempts > 0 && countResult === actualInvoicesCount) {
          console.log(`✅ [VERIFICATION] Nombre stable après ${verificationAttempts + 1} vérifications: ${actualInvoicesCount}`);
          break;
        }
      }
      
      verificationAttempts++;
    }
    
    // Utiliser le nombre réel final
    invoicesFound = actualInvoicesCount;
    console.log(`📊 [FINAL] Nombre final de factures après vérifications: ${invoicesFound}`);

    // 12. Mettre à jour le progress une dernière fois AVANT de marquer le job comme terminé
    // IMPORTANT: Cette mise à jour doit se faire avec le nombre réel de factures
    const finalProgress = {
      emailsAnalyzed,
      invoicesFound,
      invoicesDetected,
      emailsRejected,
    };
    
    console.log(`📊 [FINAL] Mise à jour finale du progress:`, finalProgress);
    
    // Mettre à jour le progress d'abord (sans changer le status)
    await updateProgress(true);
    
    // Attendre un délai supplémentaire pour s'assurer que toutes les opérations DB sont terminées
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 secondes au lieu de 500ms
    
    // Vérifier une dernière fois le statut du job (pour éviter de marquer comme "completed" si un autre processus l'a déjà fait)
    const { data: jobCheck } = await supabaseService
      .from('extraction_jobs')
      .select('status')
      .eq('id', jobId)
      .single();
    
    if (jobCheck?.status === 'completed' || jobCheck?.status === 'failed') {
      console.log(`⚠️ Job ${jobId} déjà marqué comme ${jobCheck.status} par un autre processus, arrêt`);
      return;
    }
    
    // Maintenant marquer le job comme terminé avec le progress final
    await supabaseService
      .from('extraction_jobs')
      .update({
        progress: finalProgress,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Vérifier que la mise à jour a bien été effectuée
    const { data: updatedJob } = await supabaseService
      .from('extraction_jobs')
      .select('progress, status')
      .eq('id', jobId)
      .single();
    
    console.log(`✅ Job ${jobId} terminé avec succès`);
    console.log(`📊 [VERIFICATION] Progress final sauvegardé:`, updatedJob?.progress);
    console.log(`📊 [VERIFICATION] Status final:`, updatedJob?.status);
    console.log(`📊 [VERIFICATION] Factures finales: ${updatedJob?.progress?.invoicesFound || 'N/A'}`);
  } catch (error: any) {
    console.error(`❌ Erreur traitement extraction:`, error);

    // Mettre à jour le job en erreur
    await supabaseService
      .from('extraction_jobs')
      .update({
        status: 'failed',
        error_message: error.message || String(error),
      })
      .eq('id', jobId)
      .catch((updateError) => {
        console.error('❌ Erreur mise à jour statut job:', updateError);
      });
  }
}

