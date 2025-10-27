/**
 * 🤖 SERVICE D'EXTRACTION GOOGLE DOCUMENT AI
 * 
 * Utilise Google Cloud Document AI (Invoice Parser) pour extraire
 * automatiquement les données structurées des factures PDF.
 * 
 * Avantages :
 * - Précision : 95-98% (meilleure que GPT-4o)
 * - Spécialisé pour les factures
 * - Extraction structurée automatique
 * - Support natif des PDF
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Types pour les données extraites
export interface ExtractedInvoiceData {
  vendor: string | null;
  vendor_address: string | null;
  vendor_city: string | null;
  vendor_country: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  vendor_website: string | null;
  amount: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  tax_rate: number | null;
  currency: string | null;
  date: string | null;
  invoice_number: string | null;
  description: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_date: string | null;
  due_date: string | null;
}

/**
 * Initialise le client Google Document AI
 */
function createDocumentAIClient() {
  // Vérifier que les variables d'environnement sont présentes
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
    throw new Error('❌ GOOGLE_CLOUD_PROJECT_ID manquant dans .env.local');
  }
  if (!process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID) {
    throw new Error('❌ GOOGLE_DOCUMENT_AI_PROCESSOR_ID manquant dans .env.local');
  }

  // Créer le client avec les credentials
  const client = new DocumentProcessorServiceClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  return client;
}

/**
 * Extrait les données d'une facture PDF avec Google Document AI
 * 
 * @param pdfBuffer - Buffer du PDF à analyser
 * @param fileName - Nom du fichier (pour les logs)
 * @returns Données extraites de la facture
 */
export async function extractInvoiceWithDocumentAI(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractedInvoiceData> {
  console.log(`🤖 [Document AI] Extraction de ${fileName}...`);

  try {
    const client = createDocumentAIClient();

    // Configuration du processeur
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
    const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'eu';
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID!;

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    // Préparer la requête
    const request = {
      name,
      rawDocument: {
        content: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    console.log(`📤 [Document AI] Envoi du PDF à Google Cloud...`);

    // Appeler l'API Document AI
    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document) {
      throw new Error('❌ Aucun document retourné par Document AI');
    }

    console.log(`✅ [Document AI] Document traité avec succès`);

    // Extraire les entités (données structurées)
    const entities = document.entities || [];
    const extractedData: ExtractedInvoiceData = {
      vendor: null,
      vendor_address: null,
      vendor_city: null,
      vendor_country: null,
      vendor_phone: null,
      vendor_email: null,
      vendor_website: null,
      amount: null,
      subtotal: null,
      tax_amount: null,
      tax_rate: null,
      currency: null,
      date: null,
      invoice_number: null,
      description: null,
      payment_status: null,
      payment_method: null,
      payment_date: null,
      due_date: null,
    };

    // Mapper les entités Document AI vers notre structure
    for (const entity of entities) {
      const type = entity.type;
      const mentionText = entity.mentionText || '';
      const normalizedValue = entity.normalizedValue;

      switch (type) {
        case 'supplier_name':
        case 'vendor_name':
          extractedData.vendor = mentionText;
          break;

        case 'supplier_address':
        case 'vendor_address':
          extractedData.vendor_address = mentionText;
          break;

        case 'supplier_city':
          extractedData.vendor_city = mentionText;
          break;

        case 'supplier_country':
          extractedData.vendor_country = mentionText;
          break;

        case 'supplier_phone':
          extractedData.vendor_phone = mentionText;
          break;

        case 'supplier_email':
          extractedData.vendor_email = mentionText;
          break;

        case 'supplier_website':
          extractedData.vendor_website = mentionText;
          break;

        case 'total_amount':
        case 'invoice_total':
          extractedData.amount = normalizedValue?.moneyValue?.units
            ? parseFloat(normalizedValue.moneyValue.units.toString())
            : parseFloat(mentionText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
          extractedData.currency = normalizedValue?.moneyValue?.currencyCode || 'EUR';
          break;

        case 'net_amount':
        case 'subtotal':
          extractedData.subtotal = normalizedValue?.moneyValue?.units
            ? parseFloat(normalizedValue.moneyValue.units.toString())
            : parseFloat(mentionText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
          break;

        case 'total_tax_amount':
        case 'vat_amount':
          extractedData.tax_amount = normalizedValue?.moneyValue?.units
            ? parseFloat(normalizedValue.moneyValue.units.toString())
            : parseFloat(mentionText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
          break;

        case 'vat_rate':
        case 'tax_rate':
          extractedData.tax_rate = parseFloat(mentionText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
          break;

        case 'invoice_date':
          extractedData.date = normalizedValue?.dateValue
            ? `${normalizedValue.dateValue.year}-${String(normalizedValue.dateValue.month).padStart(2, '0')}-${String(normalizedValue.dateValue.day).padStart(2, '0')}`
            : mentionText;
          break;

        case 'invoice_id':
        case 'invoice_number':
          extractedData.invoice_number = mentionText;
          break;

        case 'due_date':
        case 'payment_due_date':
          extractedData.due_date = normalizedValue?.dateValue
            ? `${normalizedValue.dateValue.year}-${String(normalizedValue.dateValue.month).padStart(2, '0')}-${String(normalizedValue.dateValue.day).padStart(2, '0')}`
            : mentionText;
          break;

        case 'payment_terms':
          extractedData.payment_method = mentionText;
          break;

        case 'line_item/description':
          if (!extractedData.description) {
            extractedData.description = mentionText;
          } else {
            extractedData.description += `, ${mentionText}`;
          }
          break;
      }
    }

    // Logs détaillés
    console.log(`✅ [Document AI] Données extraites :`);
    console.log(`   - Vendeur: ${extractedData.vendor || 'N/A'}`);
    console.log(`   - Montant: ${extractedData.amount || 'N/A'} ${extractedData.currency || ''}`);
    console.log(`   - Sous-total: ${extractedData.subtotal || 'N/A'}`);
    console.log(`   - TVA: ${extractedData.tax_amount || 'N/A'} (${extractedData.tax_rate || 'N/A'}%)`);
    console.log(`   - Date: ${extractedData.date || 'N/A'}`);
    console.log(`   - N° facture: ${extractedData.invoice_number || 'N/A'}`);
    console.log(`   - Adresse: ${extractedData.vendor_address || 'N/A'}`);
    console.log(`   - Ville: ${extractedData.vendor_city || 'N/A'}`);
    console.log(`   - Pays: ${extractedData.vendor_country || 'N/A'}`);
    console.log(`   - Téléphone: ${extractedData.vendor_phone || 'N/A'}`);
    console.log(`   - Email: ${extractedData.vendor_email || 'N/A'}`);
    console.log(`   - Site web: ${extractedData.vendor_website || 'N/A'}`);

    return extractedData;
  } catch (error: any) {
    console.error(`❌ [Document AI] Erreur extraction:`, error.message);
    
    // Retourner des données vides en cas d'erreur
    return {
      vendor: null,
      vendor_address: null,
      vendor_city: null,
      vendor_country: null,
      vendor_phone: null,
      vendor_email: null,
      vendor_website: null,
      amount: null,
      subtotal: null,
      tax_amount: null,
      tax_rate: null,
      currency: 'EUR',
      date: null,
      invoice_number: null,
      description: null,
      payment_status: 'unpaid',
      payment_method: null,
      payment_date: null,
      due_date: null,
    };
  }
}


