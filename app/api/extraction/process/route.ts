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
import { extractLogoFromPDFImages } from '@/lib/services/logo-pdf-extractor';

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

    // 4. Vérifier que le job n'est pas déjà terminé
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(`⚠️ Job ${jobId} déjà terminé avec le statut: ${job.status}`);
      return NextResponse.json({
        success: true,
        message: 'Job déjà terminé',
        status: job.status,
      });
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

    // 9. Récupérer TOUS les emails avec pagination
    let allMessages: any[] = [];
    let pageToken: string | undefined = undefined;
    
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${Math.floor(startTimestamp / 1000)} before:${Math.floor(endTimestamp / 1000)}`,
        maxResults: 500,
        pageToken,
      });

      const messages = response.data.messages || [];
      allMessages = allMessages.concat(messages);
      pageToken = response.data.nextPageToken || undefined;

      console.log(`📬 ${messages.length} emails récupérés (total: ${allMessages.length})`);
    } while (pageToken);

    const messages = allMessages;
    console.log(`✅ TOTAL: ${messages.length} emails trouvés sur la période`);

    let invoicesFound = 0;
    let invoicesDetected = 0; // Compteur pour les factures détectées (même si rejetées ensuite)
    let emailsAnalyzed = 0;
    let emailsRejected = 0;
    let rejectionReasons: { [key: string]: number } = {};
    let lastProgressUpdate = Date.now();

    // Fonction pour mettre à jour le progress périodiquement
    const updateProgress = async (force = false) => {
      const now = Date.now();
      // Mettre à jour toutes les 5 secondes ou si forcé
      if (force || now - lastProgressUpdate > 5000) {
        try {
          await supabaseService
            .from('extraction_jobs')
            .update({
              progress: {
                emailsAnalyzed,
                invoicesFound,
                invoicesDetected,
                emailsRejected,
              },
            })
            .eq('id', jobId);
          lastProgressUpdate = now;
          console.log(`📊 Progress mis à jour: ${invoicesFound} factures sauvegardées, ${emailsAnalyzed} emails analysés`);
        } catch (error) {
          console.error('❌ Erreur mise à jour progress:', error);
        }
      }
    };

    // 10. Traiter TOUS les emails
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
        const excludedSenders = [
          'receiptor', 'automation', 'noreply@qonto', 'no-reply@qonto',
          'notifications@qonto', 'support@qonto'
        ];
        const isExcludedSender = excludedSenders.some(excluded => fromLower.includes(excluded));
        
        // 2. EXCLUSION DE PATTERNS DANS LE SUJET (automation, notification, etc.)
        const excludedSubjectPatterns = [
          'automation', 'notification', 'alert', 'reminder', 'update', 'newsletter',
          'confirmation', 'welcome', 'account', 'security', 'password', 'verify',
          'conditions générales', 'cgv', 'cgu', 'terms and conditions', 'privacy policy',
          'politique de confidentialité', 'mentions légales'
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
        
        // 5. DÉTECTION DES EXPÉDITEURS DE CONFIANCE
        const trustedDomains = [
          'stripe.com', 'paypal.com', 'square.com', 'invoice', 'billing',
          'noreply', 'no-reply', 'notifications', 'receipts'
        ];
        const isTrustedSender = trustedDomains.some(domain => fromLower.includes(domain));
        
        // 6. EXCLUSION DES EMAILS PERSONNELS
        const personalDomains = ['@gmail.com', '@outlook.com', '@hotmail.com', '@yahoo.com', '@icloud.com'];
        const isPersonalEmail = personalDomains.some(domain => fromLower.includes(domain));
        
        // ========== RÈGLES DE DÉTECTION FINALE ==========
        // RÈGLE 1: PDF attaché avec indicateur de facture = ACCEPTÉ
        // RÈGLE 2: Mot-clé facture + expéditeur de confiance + pas email personnel = ACCEPTÉ
        // RÈGLE 3: Expéditeur exclu = REJETÉ
        // RÈGLE 4: Pattern d'exclusion dans sujet = REJETÉ
        
        const isInvoice = !isExcludedSender && 
                         !hasExcludedSubjectPattern &&
                         (hasPdfAttachment || 
                          (hasInvoiceKeywordInSubject && isTrustedSender && !isPersonalEmail));

        // Logs détaillés pour comprendre pourquoi un email est rejeté
        if (!isInvoice) {
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
            } else if (!isTrustedSender) {
              reason = `Mot-clé facture mais expéditeur non de confiance: ${from}`;
            }
          } else {
            reason = 'Pas de PDF ni mot-clé facture';
          }
          // Logger tous les emails rejetés pour debug (limité aux 20 premiers pour éviter trop de logs)
          if (emailsRejected <= 20) {
            console.log(`🔍 Email ${emailsAnalyzed} rejeté: "${subject.substring(0, 50)}" de ${from.substring(0, 40)} - Raison: ${reason}`);
          }
        }

        if (isInvoice) {
          invoicesDetected++; // Incrémenter le compteur de factures détectées
          console.log(`✅ Facture détectée (#${invoicesDetected}): "${subject}" de ${from}${hasPdfAttachment ? ' (PDF attaché)' : ' (mot-clé + expéditeur de confiance)'}`);
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
                console.log(`❌ Facture #${invoicesDetected} rejetée après extraction GPT: type document = ${fullExtraction.document_type} (attendu: invoice/receipt)`);
                continue;
              }
              
              // Validation stricte: doit avoir au moins un numéro de facture OU un montant
              if (!fullExtraction.invoice_number && !fullExtraction.total_amount) {
                console.log(`❌ Facture #${invoicesDetected} rejetée après extraction GPT: pas de numéro de facture ni de montant`);
                continue;
              }
              
              // Validation supplémentaire: score de confiance minimum
              const minConfidenceScore = 50; // Score minimum de 50%
              if (fullExtraction.confidence_score !== undefined && fullExtraction.confidence_score < minConfidenceScore) {
                console.log(`❌ Facture #${invoicesDetected} rejetée après extraction GPT: score de confiance trop bas (${fullExtraction.confidence_score} < ${minConfidenceScore})`);
                continue;
              }
              
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
                vendor_logo_description: fullExtraction.vendor_logo_description,
                vendor_logo_colors: fullExtraction.vendor_logo_colors,
                vendor_logo_text: fullExtraction.vendor_logo_text,
                vendor_logo_is_embedded_image: fullExtraction.vendor_logo_is_embedded_image,
                vendor_logo_image_position: fullExtraction.vendor_logo_image_position,
                extraction_status: fullExtraction.extraction_status,
                confidence_score: fullExtraction.confidence_score,
                ocr_text: fullExtraction.ocr_text,
              };
              
              // 🎨 Extraire le logo depuis les images embarquées du PDF (rapide avec pdf-lib)
              if (pdfBuffer && extractedData.vendor && extractedData.vendor_logo_is_embedded_image) {
                try {
                  console.log(`🎨 Extraction du logo pour ${extractedData.vendor}...`);
                  const logoUrl = await extractLogoFromPDFImages(
                    pdfBuffer,
                    userId,
                    message.id!,
                    {
                      vendor_logo_is_embedded_image: extractedData.vendor_logo_is_embedded_image,
                      vendor_logo_image_position: extractedData.vendor_logo_image_position,
                      vendor_logo_description: extractedData.vendor_logo_description,
                    }
                  );
                  
                  if (logoUrl) {
                    extractedData.vendor_logo_url = logoUrl;
                    console.log(`✅ Logo extrait: ${logoUrl}`);
                  } else {
                    console.log(`⚠️ Aucun logo extrait pour ${extractedData.vendor}`);
                  }
                } catch (logoError) {
                  console.error(`❌ Erreur extraction logo:`, logoError);
                  // Ne pas bloquer l'extraction si l'extraction du logo échoue
                }
              }
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
          } else if (hasInvoiceKeywordInSubject && isTrustedSender && !isPersonalEmail && emailHtml) {
            try {
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
              
              const prompt = `Analyse cet email de facture et extrait les données:

CONTEXTE:
- De: ${from}
- Sujet: ${subject}
- Date: ${date}

CONTENU EMAIL:
${cleanHtml}

Retourne un JSON avec :
{
  "vendor": "nom fournisseur",
  "amount": montant_ttc,
  "currency": "EUR/USD",
  "date": "YYYY-MM-DD",
  "invoice_number": "numéro",
  "payment_status": "paid/unpaid",
  "payment_method": "méthode",
  "confidence_score": 0-100
}`;

              const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                  { role: 'system', content: 'Tu réponds uniquement avec du JSON valide.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 1000,
              });
              
              const responseText = completion.choices[0].message.content || '{}';
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
                extractedData.extraction_status = 'partial';
              }
            } catch (error) {
              console.error(`❌ Erreur analyse HTML:`, error);
              extractedData = {
                vendor: from,
                date: date,
                extraction_status: 'failed',
              };
            }
          }

          // Sauvegarder la facture
          const cleanedData = sanitizeForPostgres(extractedData);
          const cleanedVendor = sanitizeForPostgres(extractedData.vendor || from);
          const cleanedSubject = sanitizeForPostgres(subject);

          // Vérifier que le workspace_id existe avant de l'insérer
          let workspaceIdToUse = null;
          if (job.workspace_id) {
            const { data: workspaceExists } = await supabaseService
              .from('workspaces')
              .select('id')
              .eq('id', job.workspace_id)
              .single();
            if (workspaceExists) {
              workspaceIdToUse = job.workspace_id;
            } else {
              console.warn(`⚠️ Workspace ${job.workspace_id} n'existe pas, utilisation de null`);
            }
          }

          // ========== VÉRIFICATION DE DOUBLONS AVANT INSERTION ==========
          // Vérifier si cette facture existe déjà dans la base de données
          // Critères de détection de doublon :
          // 1. Même email_id (même email traité plusieurs fois)
          // 2. Même vendor + invoice_number + amount + date (même facture)
          // 3. Même vendor + amount + date (si pas de numéro de facture)
          
          const invoiceDate = cleanedData.date ? new Date(cleanedData.date).toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0];
          const invoiceAmount = cleanedData.amount || null;
          const invoiceNumber = cleanedData.invoice_number || cleanedSubject;
          
          // Vérification 1: Même email_id (même email = doublon garanti)
          const { data: existingByEmailId } = await supabaseService
            .from('invoices')
            .select('id, vendor, invoice_number, amount, date, payment_status')
            .eq('user_id', userId)
            .eq('email_id', message.id)
            .limit(1);
          
              if (existingByEmailId && existingByEmailId.length > 0) {
                console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - même email_id): ${message.id} - Facture déjà existante (ID: ${existingByEmailId[0].id}), ignorée`);
                continue;
              }
          
          // Vérification 2: Même vendor + invoice_number + amount + date (même facture, même workspace)
          // Note: On ignore le payment_status car c'est la même facture même si le statut change
          if (cleanedVendor && invoiceNumber && invoiceAmount) {
            // Charger toutes les factures correspondantes, puis filtrer côté client
            const { data: allMatchingInvoices } = await supabaseService
              .from('invoices')
              .select('id, vendor, invoice_number, amount, date, payment_status, workspace_id')
              .eq('user_id', userId)
              .eq('vendor', cleanedVendor)
              .eq('invoice_number', invoiceNumber)
              .eq('amount', invoiceAmount)
              .eq('date', invoiceDate);
            
            // Filtrer par workspace côté client
            let existingByDetails = (allMatchingInvoices || []).filter((inv: any) => {
              if (workspaceIdToUse) {
                return inv.workspace_id === workspaceIdToUse;
              } else {
                return inv.workspace_id === null || inv.workspace_id === 'personal' || !inv.workspace_id;
              }
            });
            
            if (existingByDetails && existingByDetails.length > 0) {
              console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - vendor + numéro + montant + date): ${cleanedVendor} - ${invoiceNumber} - ${invoiceAmount} ${cleanedData.currency || 'EUR'} - ${invoiceDate} - Facture déjà existante (ID: ${existingByDetails[0].id}, statut: ${existingByDetails[0].payment_status}), ignorée`);
              continue;
            }
          }
          
          // Vérification 3: Même vendor + amount + date (si pas de numéro de facture fiable)
          // Note: On ignore le payment_status car c'est la même facture même si le statut change
          if (cleanedVendor && invoiceAmount && (!invoiceNumber || invoiceNumber === cleanedSubject)) {
            // Tolérance de ±0.01 pour les montants (arrondis)
            const amountMin = parseFloat(invoiceAmount.toString()) - 0.01;
            const amountMax = parseFloat(invoiceAmount.toString()) + 0.01;
            
            // Charger toutes les factures correspondantes, puis filtrer côté client
            const { data: allMatchingInvoices } = await supabaseService
              .from('invoices')
              .select('id, vendor, invoice_number, amount, date, payment_status, workspace_id')
              .eq('user_id', userId)
              .eq('vendor', cleanedVendor)
              .gte('amount', amountMin)
              .lte('amount', amountMax)
              .eq('date', invoiceDate)
              .limit(10); // Limiter à 10 pour éviter trop de résultats
            
            // Filtrer par workspace côté client
            let existingByVendorAmountDate = (allMatchingInvoices || []).filter((inv: any) => {
              if (workspaceIdToUse) {
                return inv.workspace_id === workspaceIdToUse;
              } else {
                return inv.workspace_id === null || inv.workspace_id === 'personal' || !inv.workspace_id;
              }
            });
            
            if (existingByVendorAmountDate && existingByVendorAmountDate.length > 0) {
              // Vérifier si c'est vraiment un doublon (même montant exact)
              const exactMatch = existingByVendorAmountDate.find((inv: any) => 
                Math.abs(parseFloat(inv.amount?.toString() || '0') - parseFloat(invoiceAmount.toString())) < 0.01
              );
              
              if (exactMatch) {
                console.log(`⚠️ Facture #${invoicesDetected} rejetée (doublon - vendor + montant + date): ${cleanedVendor} - ${invoiceAmount} ${cleanedData.currency || 'EUR'} - ${invoiceDate} - Facture déjà existante (ID: ${exactMatch.id}, statut: ${exactMatch.payment_status}), ignorée`);
                continue;
              }
            }
          }

          console.log(`✅ Aucun doublon détecté, insertion de la facture: ${cleanedVendor} - ${invoiceNumber} - ${invoiceAmount} ${cleanedData.currency || 'EUR'}`);

          const { error: insertError } = await supabaseService
            .from('invoices')
            .insert({
              user_id: userId,
              connection_id: job.connection_id,
              email_id: message.id,
              workspace_id: workspaceIdToUse,
              account_email: emailAccount.email,
              vendor: cleanedVendor,
              amount: cleanedData.amount || null,
              currency: cleanedData.currency || 'EUR',
              date: cleanedData.date ? new Date(cleanedData.date).toISOString() : new Date(date).toISOString(),
              invoice_number: cleanedData.invoice_number || cleanedSubject,
              description: cleanedData.description || null,
              category: cleanedData.category || 'Charges exceptionnelles',
              subtotal: cleanedData.subtotal || null,
              tax_amount: cleanedData.tax_amount || null,
              tax_rate: cleanedData.tax_rate || null,
              vendor_address: cleanedData.vendor_address || null,
              vendor_city: cleanedData.vendor_city || null,
              vendor_country: cleanedData.vendor_country || null,
              vendor_phone: cleanedData.vendor_phone || null,
              vendor_email: cleanedData.vendor_email || null,
              vendor_website: cleanedData.vendor_website || null,
              customer_name: cleanedData.customer_name || null,
              customer_address: cleanedData.customer_address || null,
              customer_city: cleanedData.customer_city || null,
              customer_country: cleanedData.customer_country || null,
              customer_phone: cleanedData.customer_phone || null,
              customer_email: cleanedData.customer_email || null,
              customer_vat_number: cleanedData.customer_vat_number || null,
              vendor_logo_url: cleanedData.vendor_logo_url || null,
              vendor_logo_description: cleanedData.vendor_logo_description || null,
              vendor_logo_colors: cleanedData.vendor_logo_colors || null,
              vendor_logo_text: cleanedData.vendor_logo_text || null,
              payment_status: cleanedData.payment_status || 'unpaid',
              payment_method: cleanedData.payment_method || null,
              payment_date: cleanedData.payment_date ? new Date(cleanedData.payment_date).toISOString() : null,
              due_date: cleanedData.due_date ? new Date(cleanedData.due_date).toISOString() : null,
              original_file_name: cleanedData.original_file_name || pdfAttachment?.filename || (htmlImageUrl ? `${message.id}_email_screenshot.png` : null),
              original_mime_type: cleanedData.original_mime_type || (pdfAttachment ? 'application/pdf' : (htmlMimeType || null)),
              original_file_url: cleanedData.original_file_url || fileUrl || htmlImageUrl,
              source: 'gmail',
              extracted_data: cleanedData,
            });

          if (!insertError) {
            invoicesFound++;
            console.log(`✅ Facture sauvegardée: ${extractedData.vendor || from}`);
            // Mettre à jour le progress après chaque facture sauvegardée
            await updateProgress();
          } else {
            console.error(`❌ Erreur insertion facture:`, insertError);
          }
        }
      } catch (error) {
        console.error(`❌ Erreur traitement email:`, error);
      }
      
      // Mettre à jour le progress périodiquement (tous les 10 emails)
      if (emailsAnalyzed % 10 === 0) {
        await updateProgress();
      }
    }

    console.log(`\n📊 RÉSUMÉ EXTRACTION:`);
    console.log(`   🔍 ${invoicesDetected} factures détectées`);
    console.log(`   ✅ ${invoicesFound} factures sauvegardées`);
    console.log(`   📧 ${emailsAnalyzed} emails analysés`);
    console.log(`   ❌ ${emailsRejected} emails rejetés`);
    console.log(`   📈 Taux de détection: ${emailsAnalyzed > 0 ? ((invoicesDetected / emailsAnalyzed) * 100).toFixed(2) : 0}%`);
    console.log(`   💾 Taux de sauvegarde: ${invoicesDetected > 0 ? ((invoicesFound / invoicesDetected) * 100).toFixed(2) : 0}%\n`);

    // 11. Mettre à jour le job (dernière mise à jour avec tous les compteurs)
    await updateProgress(true); // Forcer la mise à jour finale
    await supabaseService
      .from('extraction_jobs')
      .update({
        status: 'completed',
        progress: {
          emailsAnalyzed,
          invoicesFound,
          invoicesDetected,
          emailsRejected,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`✅ Job ${jobId} terminé avec succès`);
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

