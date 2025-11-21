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
import { extractInvoiceData, validateDocumentIsInvoice } from '@/lib/services/invoice-ocr-extractor';
import { convertHtmlToImage, cleanHtmlForScreenshot } from '@/lib/utils/html-to-image';
import { canExtractInvoices, getMonthlyInvoiceLimit } from '@/lib/billing/plans';
// SYSTÈME SIMPLE : Filtre Gmail avec mots-clés → Vérification contenu → Extraction

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
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null

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

    // 4. Vérifier que le job n'est pas déjà terminé
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(`⚠️ Job ${jobId} déjà terminé avec le statut: ${job.status}`);
      return NextResponse.json({
        success: true,
        message: 'Job déjà terminé',
        status: job.status,
      });
    }
    
    // Vérifier si le job est VRAIMENT en cours de traitement
    // LOGIQUE: Un job est "vraiment en cours" seulement si son progress contient processing_started_at
    // Car c'est /process qui ajoute ce champ au début du traitement
    if (job.status === 'processing') {
      const progress = job.progress || {};
      const processingStartedAt = (progress as any)?.processing_started_at;
      
      if (processingStartedAt) {
        // Il y a un timestamp = une instance a vraiment démarré
        const startedAt = new Date(processingStartedAt).getTime();
        const now = Date.now();
        const timeSinceStart = now - startedAt;
        
        if (timeSinceStart < 120000) { // 2 minutes
          console.log(`⚠️ Job ${jobId} déjà en cours de traitement (instance active depuis ${Math.round(timeSinceStart / 1000)}s), ignoré`);
          return NextResponse.json({
            success: true,
            message: 'Job déjà en cours de traitement',
            status: 'processing',
          });
        } else {
          // Plus de 2 minutes = probablement bloqué, on peut relancer
          console.log(`⚠️ Job ${jobId} en "processing" depuis plus de 2 minutes, relance autorisée`);
        }
      } else {
        // Pas de processing_started_at = le job est en "processing" mais n'a jamais vraiment démarré
        // C'est OK de le traiter (peut-être que /start a mis le status mais /process n'a pas démarré)
        console.log(`✅ Job ${jobId} en "processing" sans timestamp, démarrage du traitement`);
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
          // workspaceId supprimé - simplification
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
    
    // 🔧 FIX FUSEAU HORAIRE : Créer les dates en heure locale pour inclure toute la journée
    // new Date("2025-11-05") crée minuit UTC, ce qui peut exclure des emails du début de journée en heure locale
    // On crée donc les dates à minuit heure locale, puis on convertit en timestamp
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    
    // Créer les dates à minuit heure locale (00:00:00)
    const startDateLocal = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    // Créer la date de fin à 23:59:59.999 heure locale (fin de journée)
    const endDateLocal = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
    
    const startTimestamp = startDateLocal.getTime();
    const endTimestamp = endDateLocal.getTime();

    console.log(`📧 Récupération emails Gmail du ${startDate} au ${endDate}`);

    // 9. Récupérer les emails avec FILTRAGE PRÉALABLE pour optimiser la vitesse
    // OPTIMISATION: Filtrer directement dans la requête Gmail pour ne récupérer que les emails pertinents
    // Cela réduit drastiquement le nombre d'emails à traiter
    let allMessages: any[] = [];
    let pageToken: string | undefined = undefined;
    
    // 🎯 FILTRE GMAIL ÉLARGI : 
    // - Option A : pièce jointe avec nom de fichier contenant .pdf/.png/.jpg ET facture/invoice/receipt/recu/refund
    // - Option B : sujet contenant mots-clés (classiques + nouveaux: réservation/booking/ticket/achat/paiement/etc.) ET pièce jointe
    // - Option C : sujet contenant mots-clés (classiques + nouveaux) SANS pièce jointe ET HTML contenant un numéro de facture/commande ET une méthode de paiement
    const dateStart = Math.floor(startTimestamp / 1000);
    const dateEnd = Math.floor(endTimestamp / 1000);
    const gmailQuery = `(
  has:attachment 
  (
    filename:(.pdf OR .png OR .jpg)
    (filename:facture OR filename:invoice OR filename:receipt OR filename:recu OR filename:refund)
  )
)
OR (
  (subject:facture OR subject:invoice OR subject:"votre commande" OR subject:commande OR subject:receipt OR subject:reçu OR subject:refund OR subject:refunded OR subject:refunds OR subject:réservation OR subject:reservation OR subject:booking OR subject:ticket OR subject:billet OR subject:achat OR subject:purchase OR subject:paiement OR subject:payment OR subject:ordering OR subject:order)
  has:attachment
)
OR (
  (subject:facture OR subject:invoice OR subject:"votre commande" OR subject:commande OR subject:receipt OR subject:reçu OR subject:refund OR subject:refunded OR subject:refunds OR subject:réservation OR subject:reservation OR subject:booking OR subject:ticket OR subject:billet OR subject:achat OR subject:purchase OR subject:paiement OR subject:payment OR subject:ordering OR subject:order)
  -has:attachment
)
after:${dateStart} before:${dateEnd}`;
    console.log(`🎯 [FILTRE GMAIL] Query: ${gmailQuery.trim()}`);
    console.log(`📅 Période: ${startDate} → ${endDate} (${dateStart} → ${dateEnd})`);
    
    do {
      const response: any = await gmail.users.messages.list({
        userId: 'me',
        q: gmailQuery,
        maxResults: 500,
        pageToken,
      });

      const batchMessages = response.data.messages || [];
      allMessages = allMessages.concat(batchMessages);
      pageToken = response.data.nextPageToken || undefined;

      console.log(`📬 ${batchMessages.length} emails récupérés avec filtre (total: ${allMessages.length})`);
      
      // LOG DIAGNOSTIC : Afficher les sujets pour vérifier que les emails sont bien récupérés
      if (batchMessages.length > 0) {
        // Récupérer les sujets pour diagnostic (limité à 10 pour ne pas surcharger)
        const sampleMessages = await Promise.all(
          batchMessages.slice(0, 10).map(async (msg: any) => {
            try {
              const fullMsg = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From'],
              });
              const headers = fullMsg.data.payload?.headers || [];
              const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '';
              const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
              return { subject, from, id: msg.id };
            } catch (e) {
              return { subject: 'ERROR', from: 'ERROR', id: msg.id };
            }
          })
        );
        console.log(`📋 [DIAGNOSTIC] Exemples d'emails récupérés (${sampleMessages.length}):`, sampleMessages.map(m => `"${m.subject.substring(0, 60)}" de ${m.from.substring(0, 30)}`));
        
        // Log spécifique pour les emails contenant "refund" ou "cursor"
        const refundOrCursorEmails = sampleMessages.filter(m => 
          m.subject.toLowerCase().includes('refund') || 
          m.subject.toLowerCase().includes('cursor')
        );
        if (refundOrCursorEmails.length > 0) {
          console.log(`🔍 [DIAGNOSTIC REFUND/CURSOR] ${refundOrCursorEmails.length} email(s) trouvé(s) avec "refund" ou "cursor":`, 
            refundOrCursorEmails.map(m => `"${m.subject}" de ${m.from}`));
        }
      }
    } while (pageToken);

    console.log(`✅ TOTAL: ${allMessages.length} emails trouvés sur la période (après filtrage Gmail)`);
    
    // 🔍 DIAGNOSTIC : Vérifier si des emails avec "refund" ou "cursor" ont été récupérés
    if (allMessages.length > 0) {
      console.log(`🔍 [DIAGNOSTIC] Vérification des emails contenant "refund" ou "cursor"...`);
      const diagnosticMessages = await Promise.all(
        allMessages.slice(0, Math.min(50, allMessages.length)).map(async (msg: any) => {
          try {
            const fullMsg = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'Date'],
            });
            const headers = fullMsg.data.payload?.headers || [];
            const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '';
            const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
            const date = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';
            return { subject, from, date, id: msg.id };
          } catch (e) {
            return { subject: 'ERROR', from: 'ERROR', date: '', id: msg.id };
          }
        })
      );
      
      const refundOrCursorEmails = diagnosticMessages.filter(m => 
        m.subject.toLowerCase().includes('refund') || 
        m.subject.toLowerCase().includes('cursor')
      );
      
      if (refundOrCursorEmails.length > 0) {
        console.log(`✅ [DIAGNOSTIC] ${refundOrCursorEmails.length} email(s) trouvé(s) avec "refund" ou "cursor":`);
        refundOrCursorEmails.forEach(m => {
          console.log(`   📧 "${m.subject}" de ${m.from} (Date: ${m.date})`);
        });
      } else {
        console.log(`⚠️ [DIAGNOSTIC] Aucun email avec "refund" ou "cursor" trouvé dans les ${Math.min(50, allMessages.length)} premiers emails récupérés`);
        console.log(`   💡 Vérifiez que la période d'extraction inclut la date de l'email de refund`);
        console.log(`   💡 Vérifiez que le sujet de l'email contient bien "refund" ou "cursor"`);
      }
    }
    
    const messages = allMessages;

    let invoicesFound = 0;
    let invoicesDetected = 0; // Compteur pour les factures détectées (même si rejetées ensuite)
    let emailsAnalyzed = 0;
    let emailsRejected = 0;
    let lastProgressUpdate = 0; // Initialiser à 0 pour que la première mise à jour se fasse immédiatement
    
    // Récupérer le plan et la limite une seule fois au début
    const { data: userData } = await supabaseService.auth.admin.getUserById(userId);
    const planId = userData?.user?.user_metadata?.selected_plan || null;
    const monthlyLimit = getMonthlyInvoiceLimit(planId);
    const isUnlimited = monthlyLimit === -1;
    
    // Compter les factures extraites ce mois-ci une seule fois au début
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const { count: initialMonthlyCount } = await supabaseService
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', firstDayOfMonth.toISOString())
      .lte('created_at', lastDayOfMonth.toISOString());
    
    let currentMonthlyCount = initialMonthlyCount || 0;
    console.log(`📊 [EXTRACTION] Limite mensuelle: ${isUnlimited ? 'illimité' : monthlyLimit}, actuellement: ${currentMonthlyCount} factures`);
    
    // ========== OPTIMISATION 1: CACHE EN MÉMOIRE DES FACTURES EXISTANTES ==========
    // Charger UNIQUEMENT les factures de la période d'extraction demandée
    // pour éviter de rejeter des factures qui ont déjà été extraites dans cette période
    console.log('📦 Chargement du cache des factures existantes pour la période d\'extraction...');
    
    const { data: existingInvoices } = await supabaseService
      .from('invoices')
      .select('id, vendor, invoice_number, amount, date, payment_status, extracted_data, connection_id, email_id')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(1000); // Charger jusqu'à 1000 factures de la période
    
    // Créer des Maps pour recherche rapide O(1) au lieu de O(n)
    const invoicesByEmailId = new Map<string, any>();
    const invoicesByDetails = new Map<string, any>();
    const invoicesByVendorAmountDate = new Map<string, any>();
    
    (existingInvoices || []).forEach((inv: any) => {
      // Index par email_id (pour vérification doublon rapide)
      if (inv.email_id) {
        invoicesByEmailId.set(inv.email_id, inv);
      }
      
      // Index par vendor+invoice_number+amount+date (normalisé)
      const invVendor = normalizeString(inv.vendor || inv.extracted_data?.vendor);
      const invInvoiceNumber = normalizeString(inv.invoice_number || inv.extracted_data?.invoice_number);
      const invAmount = normalizeAmount(inv.amount || inv.extracted_data?.amount);
      const invDate = inv.date ? new Date(inv.date).toISOString().split('T')[0] : null;
      
      if (invVendor && invInvoiceNumber && invAmount && invDate) {
        const detailsKey = `${invVendor}|${invInvoiceNumber}|${invAmount}|${invDate}`;
        invoicesByDetails.set(detailsKey, inv);
      }
      
      // Index par vendor+amount+date (pour factures sans numéro fiable)
      if (invVendor && invAmount && invDate) {
        const vendorAmountDateKey = `${invVendor}|${invAmount}|${invDate}`;
        invoicesByVendorAmountDate.set(vendorAmountDateKey, inv);
      }
    });
    
    console.log(`✅ Cache chargé: ${existingInvoices?.length || 0} factures en mémoire`);
    console.log(`   - ${invoicesByEmailId.size} indexées par email_id`);
    console.log(`   - ${invoicesByDetails.size} indexées par détails complets`);
    console.log(`   - ${invoicesByVendorAmountDate.size} indexées par vendor+montant+date`);
    
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

    // ========== OPTIMISATION 2: FONCTION DE TRAITEMENT D'UN EMAIL ==========
    // Extraire la logique de traitement dans une fonction pour permettre le traitement parallèle
    const processEmail = async (message: any) => {
      emailsAnalyzed++;
      try {
        // ========== RÉ-EXTRACTION FORCÉE : On traite tous les emails même s'ils existent déjà ==========
        // Vérifier si la facture existe déjà pour afficher un log informatif
        if (invoicesByEmailId.has(message.id)) {
          const existing = invoicesByEmailId.get(message.id);
          console.log(`🔄 Email #${emailsAnalyzed} déjà extrait, ré-extraction forcée: ${message.id} - Facture existante (ID: ${existing.id})`);
        }
        
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const headers = fullMessage.data.payload?.headers || [];
        const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
        const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
        const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';

        console.log(`📧 [EMAIL #${emailsAnalyzed}] Traitement: "${subject.substring(0, 60)}" de ${from.substring(0, 50)}`);

        // ========== BLACKLIST : Exclure les newsletters (sauf si c'est un reçu/facture d'abonnement) ==========
        const subjectLower = subject.toLowerCase();
        const fromLower = from.toLowerCase();
        const isNewsletter = subjectLower.includes('newsletter') || fromLower.includes('newsletter');
        
        if (isNewsletter) {
          console.log(`🔍 [BLACKLIST] Email détecté comme newsletter: sujet="${subject.substring(0, 50)}", expéditeur="${from.substring(0, 50)}"`);
          // Exception : Si l'email contient aussi des mots-clés de facture/reçu, c'est probablement un reçu d'abonnement
          const invoiceKeywords = ['invoice', 'receipt', 'facture', 'reçu', 'payment', 'paiement', 'paid', 'payé', 'order', 'commande', 'purchase', 'achat'];
          const hasInvoiceKeyword = invoiceKeywords.some(keyword => subjectLower.includes(keyword));
          
          if (hasInvoiceKeyword) {
            console.log(`✅ [BLACKLIST] Email avec "newsletter" mais contient aussi un mot-clé de facture/reçu ("${invoiceKeywords.find(kw => subjectLower.includes(kw))}"), accepté (probable reçu d'abonnement)`);
            // On continue le traitement normalement
          } else {
            console.log(`🚫 [BLACKLIST] Email rejeté (newsletter marketing sans mot-clé de facture/reçu) : "${subject.substring(0, 50)}" de ${from.substring(0, 50)}`);
            emailsRejected++;
            return;
          }
        }

        // ========== SYSTÈME AMÉLIORÉ : EXTRACTION RÉCURSIVE ==========
        const payload = fullMessage.data.payload;
        const parts = payload?.parts || [];
        
        // Fonction récursive pour extraire le HTML (gère multipart/related, multipart/alternative, etc.)
        const extractHtmlRecursive = (part: any): string => {
          if (!part) return '';
          
          // Si c'est une partie HTML avec des données
          if (part.mimeType === 'text/html' && part.body?.data) {
            try {
              const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
              if (html && html.trim().length > 0) {
                return html;
              }
            } catch (error) {
              console.warn(`⚠️ Erreur décodage HTML:`, error);
            }
          }
          
          // Parcourir récursivement les sous-parties (multipart/related, multipart/alternative, etc.)
          if (part.parts && Array.isArray(part.parts)) {
            for (const subPart of part.parts) {
              const html = extractHtmlRecursive(subPart);
              if (html && html.trim().length > 0) {
                return html;
              }
            }
          }
          
          return '';
        };
        
        // Extraire le HTML (récursif)
        let emailHtml = '';
        if (payload?.body?.data && payload?.mimeType === 'text/html') {
          try {
            emailHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          } catch (error) {
            // Ignorer
          }
        }
        
        if (!emailHtml || emailHtml.trim().length === 0) {
          if (payload?.parts) {
            emailHtml = extractHtmlRecursive(payload) || '';
          } else if (payload) {
            emailHtml = extractHtmlRecursive(payload) || '';
          }
        }
        
        if (emailHtml && emailHtml.trim().length > 0) {
          console.log(`📧 HTML extrait: ${emailHtml.length} caractères`);
        } else {
          console.log(`⚠️ Aucun HTML extrait de l'email`);
        }

        // Fonction récursive pour trouver les PDFs (gère multipart/related, etc.)
        const findPDFsRecursive = (part: any): any[] => {
          const pdfs: any[] = [];
          
          if (!part) return pdfs;
          
          // Vérifier si c'est un PDF
          const mimeType = part.mimeType?.toLowerCase() || '';
          const filename = part.filename?.toLowerCase() || '';
          
          if (
            mimeType === 'application/pdf' ||
            filename.endsWith('.pdf') ||
            (mimeType === 'application/octet-stream' && filename.endsWith('.pdf'))
          ) {
            // 🚫 FILTRE : Exclure les PDF non-factures par nom de fichier
            const excludedPatterns = [
              'condition', 'cgu', 'cgv', 'terms', 'tcu', 'policy', 'politique',
              'contrat', 'contract', 'agreement', 'accord', 'legal', 'privacy',
              'confidentialit', 'rgpd', 'gdpr', 'mention', 'statut'
            ];
            
            const isExcludedFile = excludedPatterns.some(pattern => filename.includes(pattern));
            
            if (!isExcludedFile) {
              pdfs.push(part);
            } else {
              console.log(`🚫 PDF exclu (non-facture): ${part.filename}`);
            }
          }
          
          // Parcourir récursivement les sous-parties
          if (part.parts && Array.isArray(part.parts)) {
            for (const subPart of part.parts) {
              pdfs.push(...findPDFsRecursive(subPart));
            }
          }
          
          return pdfs;
        };
        
        // Fonction récursive pour trouver les images
        const findImagesRecursive = (part: any): any[] => {
          const images: any[] = [];
          
          if (!part) return images;
          
          const mimeType = part.mimeType?.toLowerCase() || '';
          const filename = part.filename?.toLowerCase() || '';
          
          if (
            mimeType === 'image/jpeg' || mimeType === 'image/jpg' ||
            mimeType === 'image/png' ||
            filename.endsWith('.jpg') ||
            filename.endsWith('.jpeg') ||
            filename.endsWith('.png')
          ) {
            images.push(part);
          }
          
          // Parcourir récursivement les sous-parties
          if (part.parts && Array.isArray(part.parts)) {
            for (const subPart of part.parts) {
              images.push(...findImagesRecursive(subPart));
            }
          }
          
          return images;
        };

        // Détection récursive des PDFs et images
        const pdfAttachments = findPDFsRecursive(payload);
        const imageAttachments = findImagesRecursive(payload);
        
        const hasPdfAttachment = pdfAttachments.length > 0;
        const hasImageAttachment = imageAttachments.length > 0;
        const pdfAttachment = pdfAttachments[0] || null;
        const imageAttachment = imageAttachments[0] || null;
        
        // ========== SYSTÈME ÉLARGI : Gmail a déjà filtré, validation supplémentaire pour nouveaux mots-clés ==========
        // Gmail a déjà vérifié que :
        // - Option A : pièce jointe avec nom de fichier contenant .pdf/.png/.jpg ET facture/invoice/receipt/recu/refund
        // - Option B : sujet contenant mots-clés (classiques + nouveaux: réservation/booking/ticket/achat/paiement/etc.) ET pièce jointe
        // - Option C : sujet contenant mots-clés (classiques + nouveaux) SANS pièce jointe
        // Pour l'Option B avec nouveaux mots-clés : validation supplémentaire du montant dans le HTML
        // Pour l'Option C, on vérifie aussi que le HTML contient :
        //   1. Un numéro de facture/commande (ex: #1730-8862) avec minimum 4 chiffres
        //   2. Une méthode de paiement (carte bancaire, PayPal, virement, etc.)
        //   3. Un total avec montant (Total TTC, Total HT, Total, Montant total, À payer, etc.)
        
        // Identifier le type d'email (Option A, B ou C)
        if (hasPdfAttachment || hasImageAttachment) {
          console.log(`✅ Email accepté pour extraction (Option A ou B - avec pièce jointe): "${subject.substring(0, 50)}"`);
          
          // 🔍 VALIDATION POUR NOUVEAUX MOTS-CLÉS : Si le sujet contient un nouveau mot-clé (pas classique)
          // ET qu'il y a une pièce jointe, vérifier que le HTML contient un montant avec devise
          const classicKeywords = ['facture', 'invoice', 'votre commande', 'receipt', 'reçu', 'refund', 'refunded', 'refunds'];
          const newKeywords = ['réservation', 'reservation', 'booking', 'ticket', 'billet', 'achat', 'purchase', 'paiement', 'payment'];
          
          const subjectLower = subject.toLowerCase();
          const hasClassicKeyword = classicKeywords.some(keyword => subjectLower.includes(keyword));
          const hasNewKeyword = newKeywords.some(keyword => subjectLower.includes(keyword));
          
          // Si nouveau mot-clé ET pas de mot-clé classique, vérifier le montant dans le HTML
          if (hasNewKeyword && !hasClassicKeyword && emailHtml && emailHtml.trim().length > 0) {
            console.log(`🔍 [VALIDATION NOUVEAUX MOTS-CLÉS] Email avec pièce jointe et nouveau mot-clé détecté: "${subject.substring(0, 50)}"`);
            console.log(`🔍 [VALIDATION] Vérification de la présence d'un montant avec devise dans le HTML...`);
            
            // Nettoyer le HTML pour l'analyse
            const cleanHtml = emailHtml
              .replace(/<style[^>]*>.*?<\/style>/gi, '')
              .replace(/<script[^>]*>.*?<\/script>/gi, '')
              .replace(/<img[^>]*>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Patterns pour détecter un montant avec devise (€, $, £, EUR, USD, etc.)
            const amountPatterns = [
              /[\d\s,\.]+[\s]*[€$£]/i,  // 25€, 25 €, 25.00€, 25,50 €
              /[\d\s,\.]+[\s]*(?:EUR|USD|GBP|euro|dollar)/i,  // 25 EUR, 25.00 USD
              /(?:total|montant|amount)[\s:]*[\d\s,\.]+[\s]*[€$£]?/i,  // Total: 25€, Montant: 25 €
              /(?:total|montant|amount)[\s:]*[\d\s,\.]+[\s]*(?:EUR|USD|GBP)/i,  // Total: 25 EUR
            ];
            
            const hasAmount = amountPatterns.some(pattern => pattern.test(cleanHtml));
            
            if (!hasAmount) {
              console.log(`❌ [VALIDATION] Email rejeté : nouveau mot-clé détecté mais aucun montant avec devise trouvé dans le HTML`);
              emailsRejected++;
              return;
            }
            
            console.log(`✅ [VALIDATION] Montant avec devise détecté dans le HTML, email accepté`);
          }
        } else if (emailHtml && emailHtml.trim().length > 0) {
          console.log(`📧 Email accepté pour extraction (Option C - HTML uniquement, sans pièce jointe): "${subject.substring(0, 50)}"`);
        } else {
          console.log(`✅ Email accepté pour extraction (filtré par Gmail): "${subject.substring(0, 50)}"`);
        }

        // 📥 TRAITEMENT DE TOUTES LES PIÈCES JOINTES (PDFs et images)
        // Fonction helper pour traiter une pièce jointe
        const processAttachment = async (attachment: any, isPdf: boolean): Promise<{ success: boolean; extractedData?: any; fileUrl?: string }> => {
          try {
            const attachmentName = attachment.filename || (isPdf ? 'invoice.pdf' : 'invoice.jpg');
            let attachmentData: string | null = null;
            
            // Télécharger la pièce jointe
            if (attachment.body?.attachmentId) {
              console.log(`📎 ${isPdf ? 'PDF' : 'Image'} avec attachmentId: ${attachment.body.attachmentId}`);
              const attachmentResponse = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id!,
                id: attachment.body.attachmentId,
              });
              attachmentData = attachmentResponse.data.data || null;
            } else if (attachment.body?.data) {
              console.log(`📎 ${isPdf ? 'PDF' : 'Image'} avec body.data directement (inline)`);
              attachmentData = attachment.body.data;
            }
            
            if (!attachmentData) {
              console.warn(`⚠️ ${isPdf ? 'PDF' : 'Image'} détecté mais pas de données`);
              return { success: false };
            }
            
            const documentBuffer = Buffer.from(attachmentData, 'base64');
            
            // 🔍 VALIDATION : Vérifier si le document est une facture/reçu avant extraction complète
            console.log(`🔍 [VALIDATION] Validation de la pièce jointe: ${attachmentName}...`);
            const validation = await validateDocumentIsInvoice(documentBuffer, attachmentName);
            
            if (!validation.isValid) {
              console.log(`🚫 [VALIDATION] Pièce jointe rejetée: ${validation.reason || 'Ce n\'est pas une facture/reçu'}`);
              console.log(`   📎 Fichier: ${attachmentName}`);
              return { success: false }; // Rejeter cette pièce jointe, continuer avec la suivante
            }
            
            console.log(`✅ [VALIDATION] Pièce jointe validée, début de l'extraction complète...`);
            console.log(`📄 Extraction de la pièce jointe: ${attachmentName}...`);
            
            // Upload la pièce jointe dans Supabase Storage
            const fileName = `${userId}/${message.id}_${attachmentName}`;
            const contentType = isPdf ? 'application/pdf' : (attachment.mimeType || 'image/jpeg');
            const { data: uploadData, error: uploadError } = await supabaseService.storage
              .from('invoices')
              .upload(fileName, documentBuffer, {
                contentType,
                upsert: true,
              });
            
            let fileUrl = null;
            if (!uploadError && uploadData) {
              const { data: urlData } = supabaseService.storage
                .from('invoices')
                .getPublicUrl(fileName);
              fileUrl = urlData.publicUrl;
              console.log(`📎 ${isPdf ? 'PDF' : 'Image'} uploadé: ${fileName}`);
            } else {
              console.error(`❌ Erreur upload ${isPdf ? 'PDF' : 'image'}:`, uploadError);
            }
            
            // Extraction complète avec GPT
            const fullExtraction = await extractInvoiceData(documentBuffer, {
              from,
              subject,
              date,
            });
            
            console.log(`📊 Résultats extraction:`);
            console.log(`   - vendor_name: ${fullExtraction.vendor_name || 'null'}`);
            console.log(`   - invoice_number: ${fullExtraction.invoice_number || 'null'}`);
            console.log(`   - receipt_number: ${(fullExtraction as any).receipt_number || 'null'}`);
            console.log(`   - total_amount: ${fullExtraction.total_amount || 'null'} ${fullExtraction.currency || 'EUR'}`);
            console.log(`   - subtotal: ${fullExtraction.subtotal || 'null'}`);
            console.log(`   - tax_amount: ${fullExtraction.tax_amount || 'null'}`);
            console.log(`   - tax_rate: ${fullExtraction.tax_rate || 'null'}%`);
            console.log(`   - payment_method: ${fullExtraction.payment_method || 'null'}`);
            console.log(`   - vendor_address: ${fullExtraction.vendor_address || 'null'}`);
            console.log(`   - vendor_city: ${fullExtraction.vendor_city || 'null'}`);
            console.log(`   👤 CLIENT:`);
            console.log(`      - customer_name: ${fullExtraction.customer_name || 'null'}`);
            console.log(`      - customer_address: ${fullExtraction.customer_address || 'null'}`);
            console.log(`      - customer_city: ${fullExtraction.customer_city || 'null'}`);
            console.log(`      - customer_country: ${fullExtraction.customer_country || 'null'}`);
            console.log(`      - customer_phone: ${fullExtraction.customer_phone || 'null'}`);
            console.log(`      - customer_email: ${fullExtraction.customer_email || 'null'}`);
            console.log(`      - customer_vat_number: ${fullExtraction.customer_vat_number || 'null'}`);
            
            // Mapper les champs vers le format de la BDD
            const invoiceNumber = fullExtraction.invoice_number?.toString().trim() || '';
            const receiptNumber = (fullExtraction as any).receipt_number?.toString().trim() || '';
            const identifier = invoiceNumber || receiptNumber;
            
            const extractedData = {
              vendor: fullExtraction.vendor_name || from,
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
              date: fullExtraction.invoice_date || date,
              invoice_number: identifier || fullExtraction.invoice_number || subject,
              payment_status: fullExtraction.payment_status || 'paid',
              payment_method: fullExtraction.payment_method,
              payment_date: fullExtraction.payment_date,
              due_date: fullExtraction.due_date,
              items: fullExtraction.line_items,
              extraction_status: fullExtraction.extraction_status || 'completed',
              confidence_score: fullExtraction.confidence_score || 80,
              ocr_text: fullExtraction.ocr_text,
            };
            
            console.log(`✅ Extraction terminée : ${fullExtraction.extraction_status || 'completed'} (${fullExtraction.confidence_score || 80}%)`);
            invoicesDetected++;
            
            return { success: true, extractedData, fileUrl };
            
          } catch (error) {
            console.error(`❌ Erreur traitement pièce jointe:`, error);
            return { success: false };
          }
        };
        
        // Traiter toutes les pièces jointes PDF en priorité, puis les images
        let extractedData: any = {};
        let fileUrl = null;
        let htmlImageUrl = null;
        let htmlMimeType = null;
        let invoiceExtracted = false;
        
        // Traiter tous les PDFs
        if (pdfAttachments.length > 0) {
          console.log(`📎 Traitement de ${pdfAttachments.length} pièce(s) jointe(s) PDF...`);
          for (const pdfAtt of pdfAttachments) {
            const result = await processAttachment(pdfAtt, true);
            if (result.success && result.extractedData) {
              extractedData = result.extractedData;
              fileUrl = result.fileUrl || null;
              invoiceExtracted = true;
              break; // On prend la première facture/reçu valide
            }
          }
        }
        
        // Si aucun PDF valide, traiter les images
        if (!invoiceExtracted && imageAttachments.length > 0) {
          console.log(`📎 Traitement de ${imageAttachments.length} pièce(s) jointe(s) image...`);
          for (const imgAtt of imageAttachments) {
            const result = await processAttachment(imgAtt, false);
            if (result.success && result.extractedData) {
              extractedData = result.extractedData;
              fileUrl = result.fileUrl || null;
              invoiceExtracted = true;
              break; // On prend la première facture/reçu valide
            }
          }
        }
        
        // Si aucune pièce jointe valide n'a été trouvée
        if (!invoiceExtracted) {
          if (pdfAttachments.length > 0 || imageAttachments.length > 0) {
            console.log(`❌ Aucune pièce jointe valide (facture/reçu) trouvée parmi ${pdfAttachments.length + imageAttachments.length} pièce(s) jointe(s)`);
            emailsRejected++;
            return;
          }
        }
        
        // Si une facture a été extraite, continuer avec le processus de sauvegarde
        // (extractedData et fileUrl sont déjà remplis)
        
        // Si aucune pièce jointe valide, essayer l'Option C (HTML uniquement)
        if (!invoiceExtracted && !pdfAttachments.length && !imageAttachments.length && emailHtml && emailHtml.trim().length > 0) {
          // 📧 CAS 2 : Email sans PDF/image mais avec HTML → Option C → Extraire avec GPT
          try {
            console.log(`📧 [OPTION C] Début des validations pour l'email: "${subject.substring(0, 50)}"`);
            console.log(`📧 [OPTION C] HTML disponible: ${emailHtml.length} caractères`);
            
            // ========== VALIDATION OPTION C : TOUTES LES CONDITIONS DOIVENT ÊTRE REMPLIES ==========
            // Condition 1 : Le sujet doit contenir un mot-clé (classiques ou nouveaux)
            console.log(`🔍 [OPTION C] Validation 1/7 : Vérification du sujet de l'email...`);
            const classicKeywords = ['facture', 'invoice', 'votre commande', 'receipt', 'reçu', 'refund', 'refunded', 'refunds', 'commande'];
            const newKeywords = ['réservation', 'reservation', 'booking', 'ticket', 'billet', 'achat', 'purchase', 'paiement', 'payment', 'ordering', 'order'];
            const subjectKeywords = [...classicKeywords, ...newKeywords];
            const subjectLower = subject.toLowerCase();
            const hasSubjectKeyword = subjectKeywords.some(keyword => subjectLower.includes(keyword));
            
            if (!hasSubjectKeyword) {
              console.log(`❌ [OPTION C] Email rejeté : le sujet ne contient aucun mot-clé requis`);
              console.log(`   Mots-clés classiques: ${classicKeywords.join(', ')}`);
              console.log(`   Nouveaux mots-clés: ${newKeywords.join(', ')}`);
              console.log(`   Sujet actuel: "${subject}"`);
              emailsRejected++;
              return;
            }
            console.log(`✅ [OPTION C] Validation 1/7 réussie : Sujet contient un mot-clé`);
            
            // Condition 2 : L'email ne doit pas avoir de pièce jointe (PDF/image)
            console.log(`🔍 [OPTION C] Validation 2/7 : Vérification de l'absence de pièce jointe...`);
            if (hasPdfAttachment || hasImageAttachment) {
              console.log(`❌ [OPTION C] Email rejeté : l'email contient une pièce jointe (PDF ou image), ce n'est pas l'Option C`);
              emailsRejected++;
              return;
            }
            console.log(`✅ [OPTION C] Validation 2/7 réussie : Aucune pièce jointe détectée`);
            
            // Condition 3 : Le HTML doit être présent et non vide
            console.log(`🔍 [OPTION C] Validation 3/7 : Vérification de la présence de HTML...`);
            if (!emailHtml || emailHtml.trim().length === 0) {
              console.log(`❌ [OPTION C] Email rejeté : aucun contenu HTML disponible`);
              emailsRejected++;
              return;
            }
            console.log(`✅ [OPTION C] Validation 3/7 réussie : HTML présent (${emailHtml.length} caractères)`);
            
            // Nettoyer le HTML pour l'analyse texte
            // IMPORTANT: Extraire le texte des attributs alt et title des images avant de les supprimer
            let htmlWithAltText = emailHtml;
            // Extraire le texte des attributs alt et title des images
            htmlWithAltText = htmlWithAltText.replace(/<img[^>]*alt\s*=\s*["']([^"']*)["'][^>]*>/gi, ' $1 ');
            htmlWithAltText = htmlWithAltText.replace(/<img[^>]*title\s*=\s*["']([^"']*)["'][^>]*>/gi, ' $1 ');
            
            const cleanHtml = htmlWithAltText
              .replace(/<style[^>]*>.*?<\/style>/gi, '')
              .replace(/<script[^>]*>.*?<\/script>/gi, '')
              .replace(/<img[^>]*>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 30000);
            
            // Condition 4 : Le HTML doit contenir un numéro de facture/commande (minimum 4 chiffres)
            // 🔍 VALIDATION OPTION C : Vérifier la présence d'un numéro de facture/commande dans le HTML
            // Patterns recherchés : #1730-8862, # 1730-8862, Commande #1730-8862, Facture #1730-8862, etc.
            // ⚠️ RENFORCEMENT : Exiger au minimum 4 chiffres pour éviter les faux positifs
            console.log(`🔍 [OPTION C] Validation 4/7 : Recherche d'un numéro de facture/commande (minimum 4 chiffres)...`);
            const invoiceNumberPatterns = [
              /#\s*(\d{4,}[-\s]?\d*|\d+[-\s]?\d{4,})/i,                    // #1730-8862, # 1730-8862, #1730 8862 (minimum 4 chiffres)
              /(?:commande|order|facture|invoice|receipt|référence|reference|ref)[\s:]*#?\s*(\d{4,}[-\s]?\d*|\d+[-\s]?\d{4,})/i,  // Commande #1730-8862, Order #1730-8862 (minimum 4 chiffres)
              /(?:n°|no\.?|numéro|number)[\s:]*(\d{4,}[-\s]?\d*|\d+[-\s]?\d{4,})/i,  // N°1730-8862, No. 1730-8862 (minimum 4 chiffres)
              // Pattern pour "N° DE COMMANDE" suivi d'un numéro alphanumérique (format Apple)
              /(?:n°|no\.?|numéro|number)[\s:]*de\s+(?:commande|order)[\s:]*([A-Z0-9]{6,})/i,  // N° DE COMMANDE MVWS25VDLN, No. DE COMMANDE ABC123
              /\d{4,}[-\s]\d{3,}/,                     // 1730-8862, 1730 8862 (format général - déjà strict avec 4+ et 3+)
              // Numéros de commande alphanumériques - Pattern amélioré pour détecter même sans # après nettoyage HTML
              /(?:commande|order|facture|invoice|receipt|référence|reference|ref)[\s:]*#?\s*([A-Z0-9]{4,})/i,  // Commande 0ADCF, Order ABC123, Commande #FWN18749, Commande FWN20651
              // Numéros alphanumériques avec # seul (ex: "#FWN18749", "#ABC123", "#FWN20651")
              /#\s*([A-Z0-9]{4,})/i,  // #FWN18749, #ABC123, #FWN20651 (minimum 4 caractères alphanumériques après #)
              // Numéros alphanumériques sans # mais précédés de "commande" ou "order" (cas où # est supprimé par nettoyage HTML)
              /(?:commande|order)[\s:]+([A-Z]{2,}\d{3,}|\d{3,}[A-Z]{2,}|[A-Z0-9]{5,})/i,  // Commande FWN20651, Order ABC123 (sans #, format: lettres+chiffres ou chiffres+lettres)
              // Numéros alphanumériques isolés dans un contexte transactionnel (ex: "FWN20651" près de "commande", "total", "paiement")
              /(?:commande|order|total|paiement|payment|facture|invoice)[\s:]*.{0,30}([A-Z]{2,}\d{3,}|\d{3,}[A-Z]{2,}|[A-Z0-9]{5,})/i,  // FWN20651 près de "commande" ou "total" (dans les 30 caractères)
            ];
            
            const hasInvoiceNumber = invoiceNumberPatterns.some(pattern => pattern.test(cleanHtml));
            
            if (!hasInvoiceNumber) {
              // Log de diagnostic pour comprendre pourquoi le numéro n'est pas détecté
              const htmlSnippet = cleanHtml.substring(0, 1000).toLowerCase();
              const hasFWN = htmlSnippet.includes('fwn') || htmlSnippet.includes('commande') || htmlSnippet.includes('#');
              const hasNumber = /\d{4,}/.test(htmlSnippet);
              const hasAlphanumeric = /[a-z]{2,}\d{3,}|\d{3,}[a-z]{2,}/i.test(htmlSnippet);
              console.log(`❌ [OPTION C] Email rejeté : aucun numéro de facture/commande détecté dans le HTML (minimum 4 chiffres requis)`);
              if (hasFWN || hasNumber || hasAlphanumeric) {
                console.log(`   🔍 [DIAGNOSTIC] Le HTML contient "FWN", "commande", "#", un numéro à 4+ chiffres, ou un alphanumérique mais le pattern n'a pas matché`);
                console.log(`   📄 Extrait HTML (1000 premiers caractères): ${cleanHtml.substring(0, 1000)}`);
                // Chercher spécifiquement "#FWN" ou "FWN" dans le HTML
                const fwnMatch = cleanHtml.match(/#?\s*FWN\d+/i);
                if (fwnMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern "#FWN" ou "FWN" trouvé dans le HTML: "${fwnMatch[0]}"`);
                }
              }
              emailsRejected++;
              return;
            }
            
            console.log(`✅ [OPTION C] Validation 4/7 réussie : Numéro de facture/commande détecté dans le HTML`);
            
            // Condition 5 : Le HTML doit contenir une méthode de paiement
            // 💳 VALIDATION OPTION C : Vérifier la présence d'une méthode de paiement dans le HTML
            // Patterns recherchés : Carte bancaire, PayPal, Virement, etc.
            console.log(`💳 [OPTION C] Validation 5/7 : Recherche d'une méthode de paiement...`);
            const paymentMethodPatterns = [
              /(?:carte|card)\s*(?:bancaire|de\s*crédit|de\s*crédit|de\s*débit|bleue|bank)/i,  // Carte bancaire, carte de crédit, credit card
              /(?:visa|mastercard|amex|american\s*express)/i,  // Marques de cartes (Mastercard, Visa, etc.)
              /mastercard/i,  // Mastercard (pattern spécifique pour être sûr de le détecter)
              /visa/i,  // Visa (pattern spécifique)
              /paypal/i,  // PayPal
              /(?:virement|wire\s*transfer|bank\s*transfer|transfert\s*bancaire)/i,  // Virement
              /(?:chèque|check|cheque)/i,  // Chèque
              /(?:espèces|cash)/i,  // Espèces
              /(?:apple\s*pay|google\s*pay|samsung\s*pay)/i,  // Paiements mobiles
              /stripe/i,  // Stripe
              /(?:prélèvement|direct\s*debit|sepa)/i,  // Prélèvement
              /(?:cryptocurrency|crypto|bitcoin|ethereum)/i,  // Cryptomonnaies
              /(?:paiement|payment)\s*(?:par|via|with|par\s*le\s*biais\s*de)/i,  // "Paiement par/via"
              /(?:payé|paid|payment)\s*(?:avec|with|par|via)/i,  // "Payé avec/par"
              // Patterns pour détecter les méthodes de paiement avec contexte (ex: "Mastercard se terminant par", "Visa ending with")
              /(?:mastercard|visa|amex|american\s*express)\s+(?:se\s+terminant\s+par|ending\s+with|terminant\s+par|finissant\s+par)/i,  // "Mastercard se terminant par 3645"
              // Pattern pour "Paiement Mastercard se terminant par" (avec "Paiement" avant, flexible avec sauts de ligne)
              /(?:paiement|payment)[\s\n]+(?:mastercard|visa|amex|american\s*express)[\s\n]+(?:se\s+terminant\s+par|ending\s+with|terminant\s+par|finissant\s+par)/i,  // "Paiement\nMastercard se terminant par 3645"
              // Pattern flexible pour "Paiement" suivi de "Mastercard se terminant par" (dans un rayon de 50 caractères)
              /(?:paiement|payment).{0,50}(?:mastercard|visa|amex|american\s*express)\s+(?:se\s+terminant\s+par|ending\s+with|terminant\s+par|finissant\s+par)/i,  // "Paiement\nMastercard se terminant par 3645" (flexible)
              /(?:paiement|payment)\s*(?:par|with|via)\s*(?:mastercard|visa|amex|card)/i,  // "Paiement par Mastercard"
              // Pattern très simple : "Mastercard" suivi de "terminant" dans un rayon de 30 caractères (sans exiger "Paiement" avant)
              /mastercard.{0,30}terminant/i,  // "Mastercard se terminant par" ou "Mastercard terminant par" (très flexible)
              // Pattern pour détecter "terminant par" suivi de chiffres (indicateur fort de méthode de paiement, même sans "Mastercard" explicite)
              /(?:se\s+)?terminant\s+par\s+\d{4,}/i,  // "se terminant par 3645" ou "terminant par 3645" (détecte même sans "Mastercard")
              // Pattern pour détecter "ending with" suivi de chiffres (anglais)
              /ending\s+with\s+\d{4,}/i,  // "ending with 1234"
            ];
            
            const hasPaymentMethod = paymentMethodPatterns.some(pattern => pattern.test(cleanHtml));
            
            if (!hasPaymentMethod) {
              // Log de diagnostic pour comprendre pourquoi la méthode de paiement n'est pas détectée
              const htmlSnippet = cleanHtml.substring(0, 1000).toLowerCase();
              const hasMastercard = htmlSnippet.includes('mastercard') || htmlSnippet.includes('paiement') || htmlSnippet.includes('visa');
              const hasTerminant = htmlSnippet.includes('terminant') || htmlSnippet.includes('ending');
              console.log(`❌ [OPTION C] Email rejeté : aucune méthode de paiement détectée dans le HTML`);
              
              // TOUJOURS afficher un extrait autour de "paiement" et "mastercard" pour diagnostic
              const paiementIndex = cleanHtml.toLowerCase().indexOf('paiement');
              const mastercardIndex = cleanHtml.toLowerCase().indexOf('mastercard');
              
              if (paiementIndex !== -1) {
                const paiementContext = cleanHtml.substring(Math.max(0, paiementIndex - 50), Math.min(cleanHtml.length, paiementIndex + 200));
                console.log(`   🔍 [DIAGNOSTIC] Contexte autour de "Paiement" (index ${paiementIndex}): "${paiementContext}"`);
              }
              
              if (mastercardIndex !== -1) {
                const mastercardContext = cleanHtml.substring(Math.max(0, mastercardIndex - 50), Math.min(cleanHtml.length, mastercardIndex + 200));
                console.log(`   🔍 [DIAGNOSTIC] Contexte autour de "Mastercard" (index ${mastercardIndex}): "${mastercardContext}"`);
              }
              
              if (hasMastercard || hasTerminant) {
                console.log(`   🔍 [DIAGNOSTIC] Le HTML contient "mastercard", "paiement", "visa", "terminant" ou "ending" mais le pattern n'a pas matché`);
                console.log(`   📄 Extrait HTML (1000 premiers caractères): ${cleanHtml.substring(0, 1000)}`);
                // Chercher spécifiquement "Mastercard se terminant par" dans le HTML
                const mastercardMatch = cleanHtml.match(/mastercard\s+se\s+terminant\s+par/i);
                if (mastercardMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern "Mastercard se terminant par" trouvé dans le HTML: "${mastercardMatch[0]}"`);
                }
                // Chercher spécifiquement "Paiement Mastercard se terminant par" dans le HTML
                const paiementMastercardMatch = cleanHtml.match(/(?:paiement|payment)\s+mastercard\s+se\s+terminant\s+par/i);
                if (paiementMastercardMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern "Paiement Mastercard se terminant par" trouvé dans le HTML: "${paiementMastercardMatch[0]}"`);
                }
                // Tester le pattern simple "mastercard" seul
                const simpleMastercardMatch = cleanHtml.match(/mastercard/i);
                if (simpleMastercardMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern simple "mastercard" trouvé dans le HTML: "${simpleMastercardMatch[0]}" (mais validation échouée quand même !)`);
                }
                // Tester le pattern flexible "mastercard...terminant"
                const flexibleMatch = cleanHtml.match(/mastercard.{0,30}terminant/i);
                if (flexibleMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern flexible "mastercard...terminant" trouvé dans le HTML: "${flexibleMatch[0]}"`);
                }
                // Tester le pattern "terminant par" suivi de chiffres
                const terminantParMatch = cleanHtml.match(/(?:se\s+)?terminant\s+par\s+\d{4,}/i);
                if (terminantParMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern "terminant par" suivi de chiffres trouvé dans le HTML: "${terminantParMatch[0]}"`);
                }
                // Tester le pattern "ending with" suivi de chiffres
                const endingWithMatch = cleanHtml.match(/ending\s+with\s+\d{4,}/i);
                if (endingWithMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern "ending with" suivi de chiffres trouvé dans le HTML: "${endingWithMatch[0]}"`);
                }
              }
              emailsRejected++;
              return;
            }
            
            console.log(`✅ [OPTION C] Validation 5/7 réussie : Méthode de paiement détectée dans le HTML`);
            
            // Condition 6 : Le HTML doit contenir un total avec montant
            // 💰 VALIDATION OPTION C : Vérifier la présence d'un total/montant dans le HTML
            console.log(`💰 [OPTION C] Validation 6/7 : Recherche d'un total avec montant...`);
            const totalAmountPatterns = [
              // Français - Patterns renforcés
              /total\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Total : 125,50 €", "Total: 100.00€"
              /total\s+ht\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Total HT : 100.00€"
              /total\s+ttc\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Total TTC : 120 EUR"
              /total\s+à\s+payer\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "TOTAL À PAYER : 150€", "Total à payer: 25€"
              /à\s+payer\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "À payer : 25€"
              /montant\s+total\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Montant total : 99,99 €"
              /montant\s+payé\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Montant payé : 99,99€"
              /facturé\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Facturé : 6,00 €", "Facturé: 100.00€"
              /billed\s*:?\s*\$?[\d\s,\.]+\s*(?:usd|eur|gbp|€|\$|£)?/i,  // "Billed: $99.99", "Billed: 100.00 EUR"
              /total\s*\([^)]*\)\s*:?\s*[\d\s,\.]+\s*[€$£]?/i,  // "Total (TVA incluse) : 99€"
              // Anglais
              /total\s*:?\s*\$?[\d\s,\.]+\s*(?:usd|eur|gbp|€|\$|£)?/i,  // "Total: $299.99", "Total: 150.00 USD"
              /total\s+amount\s*:?\s*\$?[\d\s,\.]+\s*(?:usd|eur|gbp|€|\$|£)?/i,  // "Total Amount: 150.00 USD"
              /grand\s+total\s*:?\s*\$?[\d\s,\.]+\s*(?:usd|eur|gbp|€|\$|£)?/i,  // "Grand Total: £99"
              /amount\s+(?:due|paid)\s*:?\s*\$?[\d\s,\.]+\s*(?:usd|eur|gbp|€|\$|£)?/i,  // "Amount Due: $250", "Amount paid: $4.93"
              /net\s+to\s+pay\s*:?\s*\$?[\d\s,\.]+\s*(?:usd|eur|gbp|€|\$|£)?/i,  // "Net to Pay: 100.00 EUR"
              // Formats génériques avec montant
              /(?:total|montant|amount)\s*:?\s*[\d\s,\.]{2,}\s*(?:€|\$|£|usd|eur|gbp)/i,  // Format générique avec devise
              // Pattern spécifique pour "Total 18,12 EUR" (montant suivi de EUR en lettres, sans deux-points)
              /total\s+[\d\s,\.]{2,}\s*(?:eur|usd|gbp)/i,  // "Total 18,12 EUR", "Total 25.00 USD"
              /total\s*:?\s*[\d\s,\.]{2,}\s*(?:eur|usd|gbp)/i,  // "Total: 18,12 EUR", "Total : 25.00 USD"
            ];
            
            const hasTotalAmount = totalAmountPatterns.some(pattern => pattern.test(cleanHtml));
            
            if (!hasTotalAmount) {
              // Log de diagnostic pour comprendre pourquoi le total n'est pas détecté
              const htmlSnippet = cleanHtml.substring(0, 1000).toLowerCase();
              const hasTotal = htmlSnippet.includes('total');
              const hasFacture = htmlSnippet.includes('facturé') || htmlSnippet.includes('facture');
              const hasAmount = /[\d\s,\.]{2,}\s*(?:eur|usd|gbp|€|\$|£)/i.test(htmlSnippet);
              console.log(`❌ [OPTION C] Email rejeté : aucun total/montant détecté dans le HTML`);
              if (hasTotal || hasFacture || hasAmount) {
                console.log(`   🔍 [DIAGNOSTIC] Le HTML contient "total", "facturé" ou un montant mais le pattern n'a pas matché`);
                // Chercher spécifiquement "Facturé :" dans le HTML
                const factureMatch = cleanHtml.match(/facturé\s*:?\s*[\d\s,\.]+\s*[€$£]/i);
                if (factureMatch) {
                  console.log(`   🔍 [DIAGNOSTIC] Pattern "Facturé :" suivi d'un montant trouvé dans le HTML: "${factureMatch[0]}"`);
                }
                console.log(`   📄 Extrait HTML (1000 premiers caractères): ${cleanHtml.substring(0, 1000)}`);
              }
              emailsRejected++;
              return;
            }
            
            console.log(`✅ [OPTION C] Validation 6/7 réussie : Total avec montant détecté dans le HTML`);
            
            // Condition 7 : Le HTML doit contenir une date de paiement ou de facture
            // 📅 VALIDATION OPTION C : Vérifier la présence d'une date de paiement/facture dans le HTML
            // ⚠️ FILTRE ANTI-FAUX POSITIFS : Les vrais reçus/factures ont obligatoirement une date
            console.log(`📅 [OPTION C] Validation 7/7 : Recherche d'une date de paiement/facture...`);
            const datePatterns = [
              // Français - Date de paiement/facture
              /(?:date\s+de\s+paiement|date\s+paiement|date\s+payé|payé\s+le|paiement\s+le)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Date de paiement : 15/12/2024", "Payé le 15-12-2024"
              /(?:date\s+de\s+la\s+facture|date\s+facture|facture\s+du|facturé\s+le)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Date de la facture : 15/12/2024", "Facturé le 15-12-2024"
              // Format "DATE DE LA FACTURE" suivi de "15 févr. 2025" ou "4 nov. 2025" (format Apple)
              /(?:date\s+de\s+la\s+facture|date\s+facture|facture\s+du|facturé\s+le)\s*:?\s*\d{1,2}\s+(?:jan\.?|fév\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?|january|february|march|april|may|june|july|august|september|october|november|december)\s+\.?\s*\d{4}/i,  // "Date de la facture : 15 févr. 2025", "Facture du 4 nov 2025"
              /(?:date\s+de\s+commande|date\s+commande|commandé\s+le)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Date de commande : 15/12/2024"
              /(?:date\s+de\s+transaction|date\s+transaction|transaction\s+du)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Date de transaction : 15/12/2024"
              // Anglais - Date paid/invoice
              /(?:date\s+paid|paid\s+on|payment\s+date|date\s+of\s+payment)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Date paid: 12/15/2024", "Paid on 12-15-2024"
              /(?:invoice\s+date|date\s+of\s+invoice|billed\s+on|invoice\s+on)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Invoice date: 12/15/2024", "Billed on 12-15-2024"
              /(?:order\s+date|date\s+of\s+order|ordered\s+on)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Order date: 12/15/2024"
              /(?:transaction\s+date|date\s+of\s+transaction)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Transaction date: 12/15/2024"
              // Formats avec date suivie d'un label
              /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*(?:date\s+de\s+paiement|date\s+paiement|date\s+paid|payment\s+date)/i,  // "15/12/2024 Date de paiement"
              /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*(?:date\s+de\s+la\s+facture|date\s+facture|invoice\s+date)/i,  // "15/12/2024 Date de la facture"
              // Formats Apple et autres formats courants
              /(?:purchase\s+date|purchased\s+on|date\s+of\s+purchase)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Purchase date: 12/15/2024"
              /(?:receipt\s+date|date\s+of\s+receipt)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i,  // "Receipt date: 12/15/2024"
              // Dates en format texte (ex: "January 15, 2024", "15 janvier 2024")
              /(?:date\s+paid|paid\s+on|payment\s+date|purchase\s+date|invoice\s+date|receipt\s+date)\s*:?\s*(?:january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{1,2},?\s+\d{4}/i,  // "Date paid: January 15, 2024", "Payé le 15 janvier 2024"
              // Dates avec format YYYY-MM-DD (ISO)
              /(?:date\s+paid|paid\s+on|payment\s+date|purchase\s+date|invoice\s+date|receipt\s+date|date\s+de\s+paiement|date\s+facture)\s*:?\s*\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/i,  // "Date paid: 2024-12-15"
              // Dates simples avec contexte transactionnel (date proche d'un mot-clé transactionnel)
              /(?:date|le|on)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*(?:paid|paiement|payment|purchase|achat|invoice|facture|receipt|reçu|transaction)/i,  // "Date: 12/15/2024 Paid", "Le 15/12/2024 paiement"
              /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*(?:paid|paiement|payment|purchase|achat|invoice|facture|receipt|reçu|transaction)/i,  // "12/15/2024 Paid", "15/12/2024 paiement"
              // Pattern flexible : date (n'importe quel format) dans un contexte transactionnel (dans les 50 caractères)
              /(?:date|purchase|receipt|invoice|facture|paiement|payment|paid|achat|transaction).{0,50}\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|(?:date|purchase|receipt|invoice|facture|paiement|payment|paid|achat|transaction).{0,50}\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:date|purchase|receipt|invoice|facture|paiement|payment|paid|achat|transaction).{0,50}(?:january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{1,2},?\s+\d{4}/i,  // Date flexible dans un contexte transactionnel
              // Pattern très flexible pour "DATE DE LA FACTURE" suivi de n'importe quelle date (format Apple)
              /(?:date\s+de\s+la\s+facture|date\s+facture).{0,30}\d{1,2}\s+(?:jan\.?|fév\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?|january|february|march|april|may|june|july|august|september|october|november|december)\s*\.?\s*\d{4}/i,  // "DATE DE LA FACTURE" suivi de "15 févr. 2025" ou "4 nov. 2025" (même sur plusieurs lignes)
              // Pattern pour dates avec mois abrégés sans label explicite (dans un contexte de facture)
              /\d{1,2}\s+(?:jan\.?|fév\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?|january|february|march|april|may|june|july|august|september|october|november|december)\s*\.?\s*\d{4}/i,  // "15 févr. 2025", "4 nov. 2025", "4 nov 2025", "Nov 4, 2025"
              // Pattern pour "Date paid" suivi de date avec mois abrégé (format: "Oct 24, 2025" ou "Sep 16, 2025" avec saut de ligne possible)
              /(?:date\s+paid|paid\s+on|payment\s+date).{0,30}(?:jan\.?|fév\.?|févr\.?|feb\.?|mars|mar\.?|avr\.?|apr\.?|mai|may|juin|jun\.?|juil\.?|jul\.?|août|aug\.?|sept\.?|sep\.?|oct\.?|nov\.?|déc\.?|dec\.?|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i,  // "Date paid\nOct 24, 2025" ou "Date paid: Sep 16, 2025"
            ];
            
            const hasDate = datePatterns.some(pattern => pattern.test(cleanHtml));
            
            if (!hasDate) {
              // Exception pour les confirmations de commande : si tous les autres critères sont remplis
              // (numéro, total, méthode de paiement) ET que le sujet contient "commande" ou "order",
              // on accepte même sans date explicite dans le HTML (on utilisera la date de l'email)
              // ⚠️ IMPORTANT : Exclure les newsletters de cette exception
              const isNewsletter = subjectLower.includes('newsletter') || fromLower.includes('newsletter');
              const isOrderConfirmation = (subjectLower.includes('commande') || subjectLower.includes('order') || subjectLower.includes('command')) 
                && hasInvoiceNumber 
                && hasPaymentMethod 
                && hasTotalAmount
                && !isNewsletter; // Exclure les newsletters de cette exception
              
              if (isOrderConfirmation) {
                console.log(`✅ [OPTION C] Validation 7/7 réussie (exception confirmation de commande) : Date de l'email utilisée comme date de commande`);
                console.log(`   📅 Date de l'email: ${date}`);
              } else {
                if (isNewsletter) {
                  console.log(`❌ [OPTION C] Email rejeté : newsletter détectée, exception confirmation de commande non applicable`);
                } else {
                  console.log(`❌ [OPTION C] Email rejeté : aucune date de paiement/facture détectée dans le HTML`);
                  console.log(`   💡 Les vrais reçus/factures contiennent obligatoirement une date de paiement ou de facture`);
                }
                emailsRejected++;
                return;
              }
            } else {
              console.log(`✅ [OPTION C] Validation 7/7 réussie : Date de paiement/facture détectée dans le HTML`);
            }
            console.log(`✅ [OPTION C] ✅ TOUTES LES VALIDATIONS RÉUSSIES (7/7) - Extraction des données...`);
            
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
            });
            
            const prompt = `Extrais TOUTES les données de cette facture/reçu depuis le contenu HTML de l'email.

📧 EMAIL :
De: ${from}
Sujet: ${subject}
Date: ${date}

CONTENU HTML:
${cleanHtml}

⚠️ OBLIGATOIRE : Retourne UNIQUEMENT un JSON valide. TOUS les champs ci-dessous DOIVENT être présents dans ta réponse (mets null si absent, mais ne les oublie JAMAIS) :
{
  "vendor": "nom du fournisseur/entreprise" (ou null),
  "invoice_number": "numéro de facture/commande/reçu" (ou null),
  "receipt_number": "numéro de reçu (si différent de invoice_number)" (ou null),
  "total_amount": nombre (montant TTC) (ou null),
  "currency": "EUR/USD/GBP/etc" (ou null),
  "date": "YYYY-MM-DD" (ou null),
  "due_date": "YYYY-MM-DD" (ou null),
  "subtotal": nombre (montant HT/Sous-total HT) (ou null),
  "tax_amount": nombre (montant TVA) (ou null),
  "tax_rate": nombre (taux TVA en %) (ou null),
  "payment_method": "mode de paiement (carte bancaire, virement, PayPal, chèque, espèces, etc.)" (ou null),
  "payment_date": "YYYY-MM-DD" (ou null),
  "vendor_address": "adresse complète du fournisseur" (ou null),
  "vendor_city": "ville du fournisseur" (ou null),
  "vendor_country": "pays du fournisseur" (ou null),
  "vendor_phone": "téléphone du fournisseur" (ou null),
  "vendor_email": "email du fournisseur" (ou null),
  "vendor_website": "site web du fournisseur" (ou null),
  "customer_name": "nom du client/destinataire" (ou null),
  "customer_address": "adresse complète du client" (ou null),
  "customer_city": "ville du client" (ou null),
  "customer_country": "pays du client" (ou null),
  "customer_phone": "téléphone du client" (ou null),
  "customer_email": "email du client" (ou null),
  "customer_vat_number": "numéro de TVA intracommunautaire du client" (ou null),
  "items": [{"description": "...", "quantity": 1, "unit_price": 0, "total": 0}] (ou null)
}

⚠️ RÈGLES OBLIGATOIRES - TU DOIS EXTRAIRE TOUS CES CHAMPS (mets null si absent, mais inclus-les TOUJOURS dans ta réponse JSON) :

1. **COORDONNÉES CLIENT (OBLIGATOIRE)** : Cherche et extrait les coordonnées du DESTINATAIRE/CLIENT. Elles sont généralement dans une section "Facturé à", "Bill to", "Client", "Customer", "Destinataire", "Billing address", ou dans le coin supérieur droit. Les coordonnées client sont DIFFÉRENTES des coordonnées fournisseur (en-tête). Si tu vois deux adresses, celle qui n'est PAS l'en-tête/fournisseur est celle du client.

   EXEMPLES CONCRETS (formats variés) :
   - Format "Bill to:" : "Bill to: stove83130-7604's projects, 126 rue andre vuillet 83100, 83100 Toulon, France, stove83130@gmail.com" → Extrait customer_name="stove83130-7604's projects", customer_address="126 rue andre vuillet 83100", customer_city="Toulon", customer_country="France", customer_email="stove83130@gmail.com"
   - Format "Facturé à:" : "Facturé à: Jean Dupont, 15 Avenue des Champs, 75008 Paris, France, jean@example.com" → Extrait customer_name="Jean Dupont", customer_address="15 Avenue des Champs", customer_city="Paris", customer_country="France", customer_email="jean@example.com"
   - Format "Client:" : "Client: Société ABC, 10 Rue de la Paix, 69001 Lyon, France" → Extrait customer_name="Société ABC", customer_address="10 Rue de la Paix", customer_city="Lyon", customer_country="France"
   - Format "Customer:" : "Customer: John Smith, 123 Main Street, New York, NY 10001, USA" → Extrait customer_name="John Smith", customer_address="123 Main Street", customer_city="New York", customer_country="USA"

   Extrait TOUS ces champs (mets null si absent) :
   - **customer_name** : Le nom du client/destinataire. Cherche après "Client", "Customer", "Destinataire", "Bill to", "Facturé à", "Billed to", "Nom", "Name", "Entreprise", "Company", "Société", "Raison sociale", ou tout nom/projet qui suit ces mots-clés
   - **customer_address** : L'adresse complète du client. Cherche après "Adresse client", "Customer address", "Adresse de facturation", "Billing address", "Adresse", "Address", ou toute adresse (Rue, Street, Avenue, Boulevard, numéro) qui suit le nom du client dans la section client
   - **customer_city** : La ville du client. Extrait la ville de l'adresse client (ex: "Toulon" dans "126 rue andre vuillet 83100, 83100 Toulon, France"), ou cherche "Ville", "City", "Localité", "Commune" dans la section client
   - **customer_country** : Le pays du client. Extrait le pays de l'adresse client (ex: "France" dans "126 rue andre vuillet 83100, 83100 Toulon, France"), ou cherche "Pays", "Country", "Nation" dans la section client
   - **customer_phone** : Le téléphone du client. Cherche "Téléphone", "Phone", "Tel", "Tél", "Mobile", "Portable", "Tél." dans la section client
   - **customer_email** : L'email du client. Cherche "Email", "E-mail", "Mail", "Courriel" dans la section client, ou un format email@domain.com dans la section client
   - **customer_vat_number** : Le numéro de TVA du client. Cherche "TVA", "VAT", "Numéro de TVA", "VAT number", "TVA intracommunautaire", "Intra-community VAT", "Numéro TVA client" dans la section client. Formats : FR12345678901, BE123456789, DE123456789, etc.
2. **MONTANTS (OBLIGATOIRE)** : Cherche et extrait TOUS ces montants (mets null si absent) :
   - **subtotal** (Sous-total HT) : Cherche "Sous-total HT", "Total HT", "HT", "Subtotal", "Sub-total", "Montant HT", "Base HT"
   - **tax_amount** (Montant TVA) : Cherche "TVA", "Montant TVA", "Tax", "Tax amount", "VAT", "VAT amount", "Montant de la TVA"
   - **tax_rate** (Taux TVA) : Cherche "Taux TVA", "TVA à", "TVA %", "Tax rate", "VAT rate", "Taux de TVA", "20%", "10%", "5.5%" (si c'est le taux de TVA)
   - Si tu trouves "Total TTC" et "Total HT", calcule tax_amount = TTC - HT
   - Si tu trouves "Taux TVA" et "Total HT", calcule tax_amount = HT × (taux/100)
3. **Coordonnées fournisseur (OBLIGATOIRE)** : Extrait l'adresse complète, ville, pays, téléphone, email, site web (généralement en haut/en-tête de la facture). Mets null si absent.
4. **Mode de paiement (OBLIGATOIRE)** : Cherche "Paiement par", "Payment method", "Mode de paiement", "Carte", "Virement", etc. Mets null si absent.
5. **Dates (OBLIGATOIRE)** : Format ISO YYYY-MM-DD. Mets null si absent.
6. **Line items (OBLIGATOIRE)** : Extrait TOUTES les lignes de la facture. Mets null si absent.

⚠️ IMPORTANT : Tous les champs listés dans la structure JSON ci-dessus DOIVENT être présents dans ta réponse, même s'ils sont null. Ne supprime JAMAIS un champ de ta réponse JSON. Les montants doivent être des nombres uniquement (pas de symboles €/$).`;

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'Tu es un expert comptable. Tu réponds UNIQUEMENT avec du JSON valide. Extrais TOUTES les données possibles de la facture/reçu. ⚠️ OBLIGATOIRE : Tu DOIS inclure TOUS les champs demandés dans ta réponse JSON, même s\'ils sont null. Ne supprime JAMAIS un champ. Extrait absolument : subtotal (HT), tax_amount (TVA), tax_rate (taux TVA), ET toutes les coordonnées client (nom, adresse, ville, pays, téléphone, email, numéro de TVA). Les coordonnées client sont généralement dans une section "Facturé à", "Bill to", "Client", "Customer", "Destinataire", ou dans le coin supérieur droit. Elles sont DIFFÉRENTES des coordonnées fournisseur (en-tête). EXEMPLES : "Bill to: John, 123 Main St, Paris, France" OU "Facturé à: Jean, 15 Rue X, Lyon, France" OU "Client: Société ABC, 10 Avenue Y, Marseille, France" → Extrait toujours customer_name, customer_address, customer_city, customer_country, customer_email.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.1,
              max_tokens: 3000, // Augmenté pour inclure tous les champs (coordonnées fournisseur, client, etc.)
            });
            
            const responseText = completion.choices[0].message.content || '{}';
            console.log(`📄 [GPT-4o HTML] Réponse brute (premiers 1000 caractères):`, responseText.substring(0, 1000));
            console.log(`📄 [GPT-4o HTML] Réponse brute (derniers 500 caractères):`, responseText.substring(Math.max(0, responseText.length - 500)));
            
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              let analysisResult;
              try {
                analysisResult = JSON.parse(jsonMatch[0]);
                console.log(`✅ [GPT-4o HTML] JSON parsé avec succès`);
                console.log(`🔍 [DEBUG HTML] customer_name dans la réponse GPT:`, analysisResult.customer_name);
                console.log(`🔍 [DEBUG HTML] customer_address dans la réponse GPT:`, analysisResult.customer_address);
                console.log(`🔍 [DEBUG HTML] customer_city dans la réponse GPT:`, analysisResult.customer_city);
                console.log(`🔍 [DEBUG HTML] customer_country dans la réponse GPT:`, analysisResult.customer_country);
                console.log(`🔍 [DEBUG HTML] customer_email dans la réponse GPT:`, analysisResult.customer_email);
              } catch (parseError) {
                console.error(`❌ [GPT-4o HTML] Erreur parsing JSON:`, parseError);
                console.error(`❌ [GPT-4o HTML] JSON brut:`, jsonMatch[0]);
                throw parseError;
              }
              
              console.log(`📊 Résultats extraction HTML:`);
              console.log(`   - vendor: ${analysisResult.vendor || 'null'}`);
              console.log(`   - invoice_number: ${analysisResult.invoice_number || 'null'}`);
              console.log(`   - receipt_number: ${analysisResult.receipt_number || 'null'}`);
              console.log(`   - total_amount: ${analysisResult.total_amount || 'null'} ${analysisResult.currency || 'EUR'}`);
              console.log(`   - subtotal: ${analysisResult.subtotal || 'null'}`);
              console.log(`   - tax_amount: ${analysisResult.tax_amount || 'null'}`);
              console.log(`   - tax_rate: ${analysisResult.tax_rate || 'null'}%`);
              console.log(`   - payment_method: ${analysisResult.payment_method || 'null'}`);
              console.log(`   - vendor_address: ${analysisResult.vendor_address || 'null'}`);
              console.log(`   - vendor_city: ${analysisResult.vendor_city || 'null'}`);
              console.log(`   👤 CLIENT:`);
              console.log(`      - customer_name: ${analysisResult.customer_name || 'null'}`);
              console.log(`      - customer_address: ${analysisResult.customer_address || 'null'}`);
              console.log(`      - customer_city: ${analysisResult.customer_city || 'null'}`);
              console.log(`      - customer_country: ${analysisResult.customer_country || 'null'}`);
              console.log(`      - customer_phone: ${analysisResult.customer_phone || 'null'}`);
              console.log(`      - customer_email: ${analysisResult.customer_email || 'null'}`);
              console.log(`      - customer_vat_number: ${analysisResult.customer_vat_number || 'null'}`);
              
              // Extraire les données (TOUS les champs)
              extractedData = {
                vendor: analysisResult.vendor || from,
                category: 'Charges exceptionnelles', // Par défaut, peut être amélioré avec GPT
                vendor_address: analysisResult.vendor_address || null,
                vendor_city: analysisResult.vendor_city || null,
                vendor_country: analysisResult.vendor_country || null,
                vendor_phone: analysisResult.vendor_phone || null,
                vendor_email: analysisResult.vendor_email || null,
                vendor_website: analysisResult.vendor_website || null,
                customer_name: analysisResult.customer_name || null,
                customer_address: analysisResult.customer_address || null,
                customer_city: analysisResult.customer_city || null,
                customer_country: analysisResult.customer_country || null,
                customer_phone: analysisResult.customer_phone || null,
                customer_email: analysisResult.customer_email || null,
                customer_vat_number: analysisResult.customer_vat_number || null,
                amount: analysisResult.total_amount || null,
                subtotal: analysisResult.subtotal || null,
                tax_amount: analysisResult.tax_amount || null,
                tax_rate: analysisResult.tax_rate || null,
                currency: analysisResult.currency || 'EUR',
                date: analysisResult.date || date,
                due_date: analysisResult.due_date || null,
                invoice_number: analysisResult.invoice_number || analysisResult.receipt_number || subject,
                payment_status: 'paid',
                payment_method: analysisResult.payment_method || null,
                payment_date: analysisResult.payment_date || null,
                items: analysisResult.items || null,
                extraction_status: 'completed',
                confidence_score: 80,
              };
              
              console.log(`✅ Facture/reçu HTML extrait`);
              invoicesDetected++;

              // 📸 Capturer une image du contenu HTML de l'email (OPTIONNEL)
              try {
                console.log(`📸 Tentative de capture d'image du contenu de l'email...`);
                
                const htmlForScreenshot = cleanHtmlForScreenshot(emailHtml);
                
                // Convertir en image avec timeout de 10 secondes max
                const imageBuffer = await Promise.race([
                  convertHtmlToImage(htmlForScreenshot, 800),
                  new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: capture image trop longue')), 10000)
                  )
                ]);
                
                const timestamp = Date.now();
                const sanitizedSubject = subject.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                const fileName = `email_${timestamp}_${sanitizedSubject}.png`;
                const filePath = `${userId}/${fileName}`;
                
                const { data: uploadData, error: uploadError } = await supabaseService.storage
                  .from('invoices')
                  .upload(filePath, imageBuffer, {
                    contentType: 'image/png',
                    upsert: false,
                  });
                
                if (uploadError) {
                  console.error(`❌ Erreur upload image email:`, uploadError);
                } else {
                  console.log(`✅ Image email uploadée: ${filePath}`);
                  
                  const { data: publicUrlData } = supabaseService.storage
                    .from('invoices')
                    .getPublicUrl(filePath);
                  
                  extractedData.original_file_url = publicUrlData.publicUrl;
                  extractedData.original_file_name = fileName;
                  extractedData.original_mime_type = 'image/png';
                  htmlImageUrl = publicUrlData.publicUrl;
                  htmlMimeType = 'image/png';
                }
              } catch (screenshotError: any) {
                console.warn(`⚠️ Capture image email ignorée (non bloquant):`, screenshotError?.message || screenshotError);
              }
            } else {
              console.log(`❌ Erreur: impossible d'analyser le contenu HTML (JSON invalide)`);
              emailsRejected++;
              return;
            }
          } catch (error) {
            console.error(`❌ Erreur analyse HTML:`, error);
            emailsRejected++;
            return;
          }
        } else if (!invoiceExtracted) {
          // Si aucune pièce jointe valide ET pas d'Option C, rejeter l'email
          console.log(`❌ Email rejeté: pas de PDF/image valide ni de HTML`);
          emailsRejected++;
          return;
        }
        
        // Si on arrive ici, c'est une facture validée (PDF/image ou HTML)
        // invoicesDetected a déjà été incrémenté dans les blocs précédents
        
        // Sauvegarder la facture
        const cleanedData = sanitizeForPostgres(extractedData);
        const cleanedVendor = sanitizeForPostgres(extractedData.vendor || from);
        const cleanedSubject = sanitizeForPostgres(subject);

        // Plus de workspace - toujours null (simplifié)
        const workspaceIdToUse = null;

        // ========== RÉ-EXTRACTION FORCÉE : On insère/met à jour toutes les factures ==========
        // Normaliser les valeurs pour la clé de session
        const normalizedVendor = normalizeString(cleanedVendor);
        const normalizedInvoiceNumber = normalizeString(cleanedData.invoice_number);
        const normalizedAmount = normalizeAmount(cleanedData.amount);
        const invoiceDate = cleanedData.date ? new Date(cleanedData.date).toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0];
        
        // Vérification session uniquement pour éviter les doublons dans la même extraction
        const sessionCacheKey = `${normalizedVendor}|${normalizedInvoiceNumber}|${normalizedAmount}|${invoiceDate}`;
        if (sessionInsertedInvoices.has(sessionCacheKey)) {
          console.log(`⚠️ Facture #${invoicesDetected} déjà traitée dans cette session, ignorée: ${cleanedVendor} - ${cleanedData.invoice_number} - ${cleanedData.amount} ${cleanedData.currency || 'EUR'} - ${invoiceDate}`);
          return;
        }

        // Vérifier si la facture existe déjà par email_id pour décider entre insert et update
        const existingByEmailId = invoicesByEmailId.get(message.id);
        const isUpdate = existingByEmailId !== undefined;
        
        // Vérifier la limite mensuelle AVANT d'insérer (seulement pour les nouvelles factures, pas les mises à jour)
        if (!isUpdate && !isUnlimited) {
          // Vérifier si on peut encore extraire (utiliser le compteur en mémoire + factures déjà insérées)
          if (currentMonthlyCount >= monthlyLimit) {
            console.warn(`⚠️ [EXTRACTION] Limite mensuelle atteinte pendant l'extraction: ${currentMonthlyCount}/${monthlyLimit} factures. Arrêt de l'extraction.`);
            // Arrêter l'extraction en mettant à jour le statut du job
            await supabaseService
              .from('extraction_jobs')
              .update({
                status: 'failed',
                error_message: `Limite mensuelle de ${monthlyLimit} factures atteinte. ${currentMonthlyCount} factures extraites ce mois.`
              })
              .eq('id', jobId);
            return; // Arrêter le traitement
          }
        }
        
        console.log(`${isUpdate ? '🔄 Mise à jour' : '✅ Insertion'} de la facture: ${cleanedVendor} - ${cleanedData.invoice_number || 'N/A'} - ${cleanedData.amount} ${cleanedData.currency || 'EUR'}`);

        // Construire extracted_data avec TOUTES les données
        const fullExtractedData = {
          ...cleanedData,
          // Ajouter les métadonnées supplémentaires
          account_email: emailAccount.email,
        };
        
        // 🔍 DEBUG : Vérifier que les coordonnées client sont bien présentes avant sauvegarde
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] customer_name dans cleanedData:`, cleanedData.customer_name);
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] customer_address dans cleanedData:`, cleanedData.customer_address);
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] customer_city dans cleanedData:`, cleanedData.customer_city);
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] customer_country dans cleanedData:`, cleanedData.customer_country);
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] customer_email dans cleanedData:`, cleanedData.customer_email);
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] fullExtractedData.customer_name:`, fullExtractedData.customer_name);
        console.log(`🔍 [DEBUG AVANT SAUVEGARDE] fullExtractedData.customer_address:`, fullExtractedData.customer_address);

        // Utiliser upsert pour insérer ou mettre à jour selon si email_id existe déjà
        const invoiceData = {
          user_id: userId,
          connection_id: job.connection_id,
          email_id: message.id,
          // workspace_id supprimé - simplification
          // NOTE: subtotal, tax_amount, tax_rate, customer_*, account_email
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
          original_file_name: cleanedData.original_file_name || (pdfAttachments[0]?.filename || imageAttachments[0]?.filename) || (htmlImageUrl ? extractedData.original_file_name : null),
          original_mime_type: cleanedData.original_mime_type || (pdfAttachments.length > 0 ? 'application/pdf' : (htmlMimeType || null)),
          original_file_url: cleanedData.original_file_url || fileUrl || htmlImageUrl,
          source: 'gmail',
          items: cleanedData.items || null, // Stocker les items dans la colonne items (JSONB)
          // 🔧 FIX : Ajouter les colonnes customer_* pour qu'elles soient sauvegardées dans les colonnes dédiées
          customer_name: cleanedData.customer_name || null,
          customer_address: cleanedData.customer_address || null,
          customer_city: cleanedData.customer_city || null,
          customer_country: cleanedData.customer_country || null,
          customer_phone: cleanedData.customer_phone || null,
          customer_email: cleanedData.customer_email || null,
          customer_vat_number: cleanedData.customer_vat_number || null,
          // 🔧 FIX : Ajouter les colonnes subtotal, tax_amount, tax_rate pour qu'elles soient sauvegardées dans les colonnes dédiées
          subtotal: cleanedData.subtotal || null,
          tax_amount: cleanedData.tax_amount || null,
          tax_rate: cleanedData.tax_rate || null,
          // 🔧 FIX : Ajouter account_email pour qu'il soit sauvegardé dans la colonne dédiée (affiché dans la colonne "Source")
          account_email: emailAccount.email || null,
          extracted_data: fullExtractedData, // Toutes les données supplémentaires dans extracted_data (JSONB)
        };

        // Vérifier si la facture existe déjà par email_id et faire update ou insert
        let dbError = null;
        
        if (isUpdate && existingByEmailId) {
          // Mise à jour de la facture existante
          const { error: updateError } = await supabaseService
            .from('invoices')
            .update(invoiceData)
            .eq('email_id', message.id)
            .eq('user_id', userId);
          
          dbError = updateError;
        } else {
          // Insertion d'une nouvelle facture
          const { error: insertError } = await supabaseService
            .from('invoices')
            .insert(invoiceData);
          
          dbError = insertError;
        }

        if (!dbError) {
          invoicesFound++;
          // Incrémenter le compteur mensuel seulement pour les nouvelles factures
          if (!isUpdate) {
            currentMonthlyCount++;
          }
          // Ajouter au cache en mémoire pour éviter les doublons dans la même session
          sessionInsertedInvoices.set(sessionCacheKey, true);
          console.log(`${isUpdate ? '🔄 Facture #' + invoicesFound + ' mise à jour' : '✅ Facture #' + invoicesFound + ' sauvegardée'}: ${extractedData.vendor || from} - ${cleanedData.amount || 'N/A'} ${cleanedData.currency || 'EUR'} (${currentMonthlyCount}/${isUnlimited ? '∞' : monthlyLimit})`);
          // ⚠️ LOG SPÉCIAL pour Cursor/Replit (DIAGNOSTIC)
          if (from.toLowerCase().includes('cursor') || from.toLowerCase().includes('replit') || subject.toLowerCase().includes('cursor') || subject.toLowerCase().includes('replit')) {
            console.log(`🎉 [CURSOR/REPLIT ${isUpdate ? 'MIS À JOUR' : 'ACCEPTÉ'}] Sujet: "${subject}" | De: ${from} | Vendor: ${extractedData.vendor} | Montant: ${cleanedData.amount} ${cleanedData.currency}`);
          }
          // Mettre à jour le progress immédiatement après chaque facture sauvegardée (force = true)
          await updateProgress(true);
        } else {
          // Erreur d'insertion/mise à jour
          console.error(`❌ Erreur ${isUpdate ? 'mise à jour' : 'insertion'} facture #${invoicesDetected}:`, dbError);
          console.error(`   Vendor: ${cleanedVendor}`);
          console.error(`   Amount: ${cleanedData.amount}`);
          // workspace supprimé
          console.error(`   Email ID: ${message.id}`);
        }
      } catch (error) {
        console.error(`❌ Erreur traitement email:`, error);
      }
      
      // Ajouter l'email_id au cache de session pour éviter de le retraiter
      sessionInsertedInvoices.set(`email_id:${message.id}`, true);
    }; // Fin de la fonction processEmail

    // ========== OPTIMISATION 4: TRAITEMENT PAR BATCHES PARALLÈLES ==========
    // Traiter les emails par batches de 10 en parallèle (GPT-4o-mini est plus rapide)
    const BATCH_SIZE = 10;
    const batches: any[][] = [];
    
    // Découper les messages en batches
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      batches.push(messages.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`🚀 Traitement de ${messages.length} emails en ${batches.length} batches de ${BATCH_SIZE} (parallèle)`);
    
    // Traiter chaque batch en parallèle
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length}: traitement de ${batch.length} emails...`);
      
      // Traiter tous les emails du batch en parallèle
      await Promise.all(batch.map(message => processEmail(message)));
      
      // Mettre à jour le progress après chaque batch
      await updateProgress(false);
      
      console.log(`✅ Batch ${batchIndex + 1}/${batches.length} terminé (${emailsAnalyzed}/${messages.length} emails analysés, ${invoicesFound} factures trouvées)`);
    }

    const gptAnalysisCount = emailsAnalyzed - emailsRejected; // Nombre d'emails analysés par GPT
    
    console.log(`\n📊 RÉSUMÉ EXTRACTION:`);
    console.log(`   📬 ${messages.length} emails récupérés`);
    console.log(`   📧 ${emailsAnalyzed} emails traités`);
    console.log(`   ❌ ${emailsRejected} emails rejetés`);
    console.log(`   🤖 ${gptAnalysisCount} emails analysés par GPT-4o-mini`);
    console.log(`   🔍 ${invoicesDetected} factures détectées`);
    console.log(`   ✅ ${invoicesFound} factures sauvegardées`);
    console.log(`   📈 Taux de détection: ${gptAnalysisCount > 0 ? ((invoicesDetected / gptAnalysisCount) * 100).toFixed(2) : 0}%`);
    console.log(`   💾 Taux de sauvegarde: ${invoicesDetected > 0 ? ((invoicesFound / invoicesDetected) * 100).toFixed(2) : 0}%`);
    console.log(`   💰 Coût GPT estimé: ${gptAnalysisCount} appels × $0.0006 = ~$${(gptAnalysisCount * 0.0006).toFixed(2)}`);
    console.log(`   💸 Économie vs GPT-4o: ~$${((gptAnalysisCount * 0.018) - (gptAnalysisCount * 0.0006)).toFixed(2)} économisés (30x moins cher)\n`);

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
    try {
      await supabaseService
        .from('extraction_jobs')
        .update({
          status: 'failed',
          error_message: error.message || String(error),
        })
        .eq('id', jobId);
    } catch (updateError: any) {
      console.error('❌ Erreur mise à jour statut job:', updateError);
    }
  }
}

