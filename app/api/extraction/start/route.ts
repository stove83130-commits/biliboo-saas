/**
 * API Endpoint pour démarrer une extraction de factures
 * POST /api/extraction/start
 */


export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { extractInvoicesForClient } from '@/lib/services/email-extractor';
import { invoiceStorageService } from '@/lib/services/invoice-storage';
import OpenAI from 'openai';
import { extractInvoiceData } from '@/lib/services/invoice-ocr-extractor';
import { convertHtmlToImage, cleanHtmlForScreenshot } from '@/lib/utils/html-to-image';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Nettoie les caractères Unicode invalides pour PostgreSQL
 * PostgreSQL refuse les caractères null (\u0000) et autres caractères de contrôle
 */
function sanitizeForPostgres(value: any): any {
  if (typeof value === 'string') {
    // Supprimer les caractères null et autres caractères de contrôle problématiques
    return value
      .replace(/\u0000/g, '') // Caractère null
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '') // Autres caractères de contrôle
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
    console.log('🚀 API: Démarrage extraction nouvelle architecture');

    // 1. Authentification utilisateur
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Parse du body
    const body = await req.json();
    const { emailConfigId, searchSince, searchUntil, searchKeywords, workspaceId } = body;

    if (!emailConfigId) {
      return NextResponse.json(
        { error: 'Paramètre emailConfigId requis' },
        { status: 400 }
      );
    }

    if (!searchUntil) {
      return NextResponse.json(
        { error: 'Paramètre searchUntil requis' },
        { status: 400 }
      );
    }

    // 3. Récupérer la connexion email existante (email_accounts)
    const { data: emailAccount, error: accountError } = await supabaseService
      .from('email_accounts')
      .select('*')
      .eq('id', emailConfigId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !emailAccount) {
      console.error('❌ Erreur récupération compte:', accountError);
      return NextResponse.json(
        { error: 'Compte email introuvable' },
        { status: 404 }
      );
    }

    if (!emailAccount.is_active) {
      return NextResponse.json(
        { error: 'Compte email inactif' },
        { status: 400 }
      );
    }

    // 4. Créer un job d'extraction (utiliser l'ancienne table extraction_jobs)
    const { data: job, error: jobError } = await supabaseService
      .from('extraction_jobs')
      .insert({
        user_id: user.id,
        connection_id: emailConfigId,
        status: 'pending',
        start_date: searchSince || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: searchUntil || new Date().toISOString().split('T')[0],
        progress: {
          emailsAnalyzed: 0,
          invoicesFound: 0,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Erreur création job:', jobError);
      return NextResponse.json(
        { error: 'Erreur création job' },
        { status: 500 }
      );
    }

    console.log(`✅ Job créé: ${job.id}`);

    // 5. Lancer l'extraction en arrière-plan (extraction DIRECTE avec Gmail API)
    setImmediate(async () => {
      try {
        console.log(`🚀 Démarrage extraction job ${job.id}`);

        // Mettre à jour le statut
        await supabaseService
          .from('extraction_jobs')
          .update({
            status: 'processing',
          })
          .eq('id', job.id);

        // Configurer OAuth2 pour Gmail
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

        // Calculer les dates
        const startDate = searchSince || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = searchUntil || new Date().toISOString().split('T')[0];
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime() + 86400000;

        console.log(`📧 Récupération emails Gmail du ${startDate} au ${endDate}`);

        // Récupérer TOUS les emails avec pagination
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

        // Traiter TOUS les emails (pas de limite)
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
                // 🚫 FILTRE 1 : Exclure les PDF non-factures par nom de fichier
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
                } else {
                  console.log(`🚫 PDF exclu (non-facture): ${part.filename}`);
                }
              }
            }

            // 🔍 DÉTECTION STRICTE DES FACTURES
            const subjectLower = subject.toLowerCase();
            const fromLower = from.toLowerCase();
            
            // Mots-clés de facture dans le sujet
            const invoiceKeywords = ['facture', 'invoice', 'receipt', 'reçu', 'bill'];
            const hasInvoiceKeywordInSubject = invoiceKeywords.some(kw => subjectLower.includes(kw));
            
            // Expéditeurs de confiance (domaines de facturation connus)
            const trustedDomains = [
              'stripe.com', 'paypal.com', 'square.com', 'invoice', 'billing',
              'noreply', 'no-reply', 'notifications', 'receipts'
            ];
            const isTrustedSender = trustedDomains.some(domain => fromLower.includes(domain));
            
            // Exclure les emails personnels (gmail.com, outlook.com, etc.)
            const personalDomains = ['@gmail.com', '@outlook.com', '@hotmail.com', '@yahoo.com', '@icloud.com'];
            const isPersonalEmail = personalDomains.some(domain => fromLower.includes(domain));
            
            // RÈGLES DE DÉTECTION :
            // 1. PDF attaché = toujours accepté (même depuis emails personnels)
            // 2. Mot-clé facture + expéditeur de confiance = accepté
            // 3. Mot-clé facture + email personnel SANS PDF = REJETÉ (évite les faux positifs)
            const isInvoice = hasPdfAttachment || 
                             (hasInvoiceKeywordInSubject && isTrustedSender && !isPersonalEmail);

            // Détecter si c'est une facture
            if (isInvoice) {
              if (hasPdfAttachment) {
                console.log(`✅ PDF trouvé (${pdfAttachment.filename}) - "${subject}"`);
              } else {
                console.log(`✅ Mot-clé trouvé - "${subject}"`);
              }

              // 📥 TÉLÉCHARGER LE PDF ET L'UPLOADER
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
                    // Décoder le base64
                    pdfBuffer = Buffer.from(attachment.data.data, 'base64');
                    
                    // Upload le PDF original dans Supabase Storage
                    const fileName = `${user.id}/${message.id}_${pdfAttachment.filename}`;
                    const { data: uploadData, error: uploadError } = await supabaseService.storage
                      .from('invoices')
                      .upload(fileName, pdfBuffer, {
                        contentType: 'application/pdf',
                        upsert: true,
                      });

                    if (!uploadError && uploadData) {
                      // Générer l'URL publique
                      const { data: urlData } = supabaseService.storage
                        .from('invoices')
                        .getPublicUrl(fileName);
                      
                      fileUrl = urlData.publicUrl;
                      console.log(`📎 PDF uploadé: ${fileName}`);
                    }
                  }
                } catch (error) {
                  console.error(`❌ Erreur upload PDF:`, error);
                }
              }

              // 🤖 EXTRACTION ROBUSTE AVEC TESSERACT OCR + GPT-4o
              let extractedData: any = {};
              
              if (pdfBuffer) {
                // 📄 CAS 1 : PDF avec pièce jointe → OCR + GPT-4o (extraction complète)
                try {
                  console.log(`🚀 Extraction complète OCR+GPT pour ${pdfAttachment?.filename}...`);
                  
                  const fullExtraction = await extractInvoiceData(pdfBuffer, {
                    from,
                    subject,
                    date,
                  });
                  
                  // 🚫 FILTRE 2A : Vérifier le TYPE de document (NOUVEAU !)
                  if (fullExtraction.document_type && 
                      fullExtraction.document_type !== 'invoice' && 
                      fullExtraction.document_type !== 'receipt') {
                    console.log(`🚫 Document rejeté (type: ${fullExtraction.document_type}) : ${pdfAttachment?.filename}`);
                    console.log(`   → Ce n'est pas une facture/reçu, c'est : ${fullExtraction.document_type}`);
                    continue; // Passer à l'email suivant
                  }
                  
                  // 🚫 FILTRE 2B : Vérifier que c'est vraiment une facture (données minimales)
                  if (!fullExtraction.invoice_number && !fullExtraction.total_amount) {
                    console.log(`🚫 PDF rejeté (pas de numéro ni montant) : ${pdfAttachment?.filename}`);
                    continue; // Passer à l'email suivant
                  }
                  
                  // Mapper les champs vers le format de la BDD
                  extractedData = {
                    vendor: fullExtraction.vendor_name,
                    category: fullExtraction.category || 'Charges exceptionnelles', // Catégorie par défaut
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
                    // 🎨 LOGO (nouveau !)
                    vendor_logo_description: fullExtraction.vendor_logo_description,
                    vendor_logo_colors: fullExtraction.vendor_logo_colors,
                    vendor_logo_text: fullExtraction.vendor_logo_text,
                    // Métadonnées d'extraction
                    extraction_status: fullExtraction.extraction_status,
                    confidence_score: fullExtraction.confidence_score,
                    ocr_text: fullExtraction.ocr_text,
                  };
                  
                  console.log(`✅ Extraction terminée : ${fullExtraction.extraction_status} (${fullExtraction.confidence_score}%)`);
                  
                } catch (error) {
                  console.error(`❌ Erreur extraction complète:`, error);
                  // Fallback : au moins les métadonnées de l'email
                  extractedData = {
                    vendor: from,
                    date: date,
                    invoice_number: subject,
                    extraction_status: 'failed',
                    confidence_score: 0,
                  };
                }
              } else if (hasInvoiceKeywordInSubject && isTrustedSender && !isPersonalEmail && emailHtml) {
                // 📧 CAS 2 : Email sans PDF mais avec mots-clés + expéditeur de confiance → Analyse HTML + Capture d'image
                try {
                  console.log(`📧 Analyse HTML de l'email pour ${subject}...`);
                  
                  const openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY,
                  });
                  
                  // Nettoyer le HTML pour l'analyse texte
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
                    extractedData.extraction_status = 'partial'; // Email seul = partiel
                    console.log(`✅ Données HTML extraites (confiance: ${extractedData.confidence_score}%)`);
                  }

                  // 📸 NOUVEAU : Capturer une image du contenu HTML de l'email (OPTIONNEL)
                  // ⚠️ Si Puppeteer échoue, on continue quand même l'extraction
                  try {
                    console.log(`📸 Tentative de capture d'image du contenu de l'email...`);
                    
                    // Nettoyer le HTML pour un meilleur rendu visuel
                    const htmlForScreenshot = cleanHtmlForScreenshot(emailHtml);
                    
                    // Convertir en image avec timeout de 10 secondes max
                    const imageBuffer = await Promise.race([
                      convertHtmlToImage(htmlForScreenshot, 800),
                      new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout: capture image trop longue')), 10000)
                      )
                    ]);
                    
                    // Générer un nom de fichier unique
                    const timestamp = Date.now();
                    const sanitizedSubject = subject.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                    const fileName = `email_${timestamp}_${sanitizedSubject}.png`;
                    const filePath = `${user.id}/${fileName}`;
                    
                    // Uploader l'image dans Supabase Storage
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
                      
                      // Récupérer l'URL publique
                      const { data: publicUrlData } = supabaseService.storage
                        .from('invoices')
                        .getPublicUrl(filePath);
                      
                      // Ajouter l'URL de l'image aux données extraites
                      extractedData.original_file_url = publicUrlData.publicUrl;
                      extractedData.original_file_name = fileName;
                      extractedData.original_mime_type = 'image/png';
                    }
                  } catch (screenshotError: any) {
                    console.warn(`⚠️ Capture image email ignorée (non bloquant):`, screenshotError?.message || screenshotError);
                    // ✅ On continue l'extraction même si la capture échoue
                    // Les données texte sont déjà extraites par GPT-4o
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

              // 🧹 Nettoyer les données avant insertion (supprimer caractères Unicode invalides)
              const cleanedData = sanitizeForPostgres(extractedData);
              const cleanedVendor = sanitizeForPostgres(extractedData.vendor || from);
              const cleanedSubject = sanitizeForPostgres(subject);

              // Sauvegarder dans la base de données avec les données extraites
              const { error: insertError } = await supabaseService
                .from('invoices')
                .insert({
                  user_id: user.id,
                  connection_id: emailConfigId,
                  email_id: message.id,
                  workspace_id: workspaceId || null, // 🏢 Associer au workspace actif
                  account_email: emailAccount.email, // Email du compte utilisé pour l'extraction
                  vendor: cleanedVendor,
                  amount: cleanedData.amount || null,
                  currency: cleanedData.currency || 'EUR',
                  date: cleanedData.date ? new Date(cleanedData.date).toISOString() : new Date(date).toISOString(),
                  invoice_number: cleanedData.invoice_number || cleanedSubject,
                  description: cleanedData.description || null,
                  category: cleanedData.category || 'Charges exceptionnelles', // Catégorie GPT-4o ou défaut
                  subtotal: cleanedData.subtotal || null,
                  tax_amount: cleanedData.tax_amount || null,
                  tax_rate: cleanedData.tax_rate || null,
                  // Coordonnées fournisseur (TOUTES)
                  vendor_address: cleanedData.vendor_address || null,
                  vendor_city: cleanedData.vendor_city || null,
                  vendor_country: cleanedData.vendor_country || null,
                  vendor_phone: cleanedData.vendor_phone || null,
                  vendor_email: cleanedData.vendor_email || null,
                  vendor_website: cleanedData.vendor_website || null,
                  // Coordonnées client (NOUVEAU !)
                  customer_name: cleanedData.customer_name || null,
                  customer_address: cleanedData.customer_address || null,
                  customer_city: cleanedData.customer_city || null,
                  customer_country: cleanedData.customer_country || null,
                  customer_phone: cleanedData.customer_phone || null,
                  customer_email: cleanedData.customer_email || null,
                  customer_vat_number: cleanedData.customer_vat_number || null,
                  // 🎨 Logo fournisseur (NOUVEAU !)
                  vendor_logo_description: cleanedData.vendor_logo_description || null,
                  vendor_logo_colors: cleanedData.vendor_logo_colors || null,
                  vendor_logo_text: cleanedData.vendor_logo_text || null,
                  // Informations de paiement (TOUTES)
                  payment_status: cleanedData.payment_status || 'unpaid',
                  payment_method: cleanedData.payment_method || null,
                  payment_date: cleanedData.payment_date ? new Date(cleanedData.payment_date).toISOString() : null,
                  due_date: cleanedData.due_date ? new Date(cleanedData.due_date).toISOString() : null,
                  // Fichier original (PDF ou image HTML)
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
                console.error(`   Vendor: ${extractedData.vendor || from}`);
                console.error(`   Détails:`, insertError.message || insertError);
              }
            }
          } catch (error) {
            console.error(`❌ Erreur traitement email:`, error);
          }
        }

        console.log(`💰 ${invoicesFound} factures détectées`);

        if (invoicesFound > 0) {
          console.log(`✅ ${invoicesFound} factures sauvegardées avec succès`);
        }

        // Mettre à jour le job
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
          .eq('id', job.id);

        console.log(`✅ Job ${job.id} terminé avec succès`);
      } catch (error: any) {
        console.error(`❌ Erreur extraction job ${job.id}:`, error);

        await supabaseService
          .from('extraction_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', job.id);
      }
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Extraction lancée avec succès',
    });
  } catch (error: any) {
    console.error('❌ Erreur API extraction:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

