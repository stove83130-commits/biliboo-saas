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

export async function POST(req: NextRequest) {
  try {
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

    // 10. Traiter TOUS les emails
    for (const message of messages) {
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

        // Vérifier si c'est une facture (PDF attaché OU mots-clés)
        const parts = fullMessage.data.payload?.parts || [];
        let hasPdfAttachment = false;
        let pdfAttachment: any = null;

        for (const part of parts) {
          if (
            part.mimeType === 'application/pdf' ||
            part.filename?.toLowerCase().endsWith('.pdf')
          ) {
            const filename = part.filename?.toLowerCase() || '';
            const excludedPatterns = [
              'condition', 'cgu', 'cgv', 'terms', 'tcu', 'policy', 'politique',
              'contrat', 'contract', 'agreement', 'accord', 'legal', 'privacy',
              'confidentialit', 'rgpd', 'gdpr', 'mention', 'statut'
            ];
            
            const isExcludedFile = excludedPatterns.some(pattern => filename.includes(pattern));
            
            if (!isExcludedFile) {
              hasPdfAttachment = true;
              pdfAttachment = part;
              break;
            }
          }
        }

        // Détection des factures
        const subjectLower = subject.toLowerCase();
        const fromLower = from.toLowerCase();
        
        const invoiceKeywords = ['facture', 'invoice', 'receipt', 'reçu', 'bill'];
        const hasInvoiceKeywordInSubject = invoiceKeywords.some(kw => subjectLower.includes(kw));
        
        const trustedDomains = [
          'stripe.com', 'paypal.com', 'square.com', 'invoice', 'billing',
          'noreply', 'no-reply', 'notifications', 'receipts'
        ];
        const isTrustedSender = trustedDomains.some(domain => fromLower.includes(domain));
        
        const personalDomains = ['@gmail.com', '@outlook.com', '@hotmail.com', '@yahoo.com', '@icloud.com'];
        const isPersonalEmail = personalDomains.some(domain => fromLower.includes(domain));
        
        const isInvoice = hasPdfAttachment || 
                         (hasInvoiceKeywordInSubject && isTrustedSender && !isPersonalEmail);

        if (isInvoice) {
          // Télécharger le PDF si présent
          let fileUrl = null;
          let pdfBuffer: Buffer | null = null;
          if (hasPdfAttachment && pdfAttachment.body?.attachmentId) {
            try {
              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id!,
                id: pdfAttachment.body.attachmentId,
              });

              if (attachment.data.data) {
                pdfBuffer = Buffer.from(attachment.data.data, 'base64');
                
                const fileName = `${user.id}/${message.id}_${pdfAttachment.filename}`;
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
                continue;
              }
              
              if (!fullExtraction.invoice_number && !fullExtraction.total_amount) {
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

          const { error: insertError } = await supabaseService
            .from('invoices')
            .insert({
              user_id: user.id,
              connection_id: job.connection_id,
              email_id: message.id,
              workspace_id: job.workspace_id || null,
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
              vendor_logo_description: cleanedData.vendor_logo_description || null,
              vendor_logo_colors: cleanedData.vendor_logo_colors || null,
              vendor_logo_text: cleanedData.vendor_logo_text || null,
              payment_status: cleanedData.payment_status || 'unpaid',
              payment_method: cleanedData.payment_method || null,
              payment_date: cleanedData.payment_date ? new Date(cleanedData.payment_date).toISOString() : null,
              due_date: cleanedData.due_date ? new Date(cleanedData.due_date).toISOString() : null,
              original_file_name: cleanedData.original_file_name || pdfAttachment?.filename || null,
              original_mime_type: cleanedData.original_mime_type || (pdfAttachment ? 'application/pdf' : null),
              original_file_url: cleanedData.original_file_url || fileUrl,
              source: 'gmail',
              extracted_data: cleanedData,
            });

          if (!insertError) {
            invoicesFound++;
            console.log(`✅ Facture sauvegardée: ${extractedData.vendor || from}`);
          } else {
            console.error(`❌ Erreur insertion facture:`, insertError);
          }
        }
      } catch (error) {
        console.error(`❌ Erreur traitement email:`, error);
      }
    }

    console.log(`💰 ${invoicesFound} factures détectées`);

    // 11. Mettre à jour le job
    await supabaseService
      .from('extraction_jobs')
      .update({
        status: 'completed',
        progress: {
          emailsAnalyzed: messages.length,
          invoicesFound,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`✅ Job ${jobId} terminé avec succès`);

    return NextResponse.json({
      success: true,
      message: 'Extraction terminée',
      invoicesFound,
    });
  } catch (error: any) {
    console.error(`❌ Erreur traitement extraction:`, error);

    // Mettre à jour le job en erreur
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (jobId) {
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

    return NextResponse.json(
      {
        error: 'Erreur lors du traitement de l\'extraction',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

