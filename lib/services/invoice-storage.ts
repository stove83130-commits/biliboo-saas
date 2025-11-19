/**
 * Service de stockage des factures
 * Gère l'upload vers Supabase Storage et la sauvegarde en base de données
 */

import { createClient } from '@supabase/supabase-js';
import { InvoiceData, parseInvoiceFile } from './invoice-parser';
import { InvoiceAttachment } from './email-extractor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SavedInvoice {
  id: string;
  clientId: string;
  emailConfigId: string;
  originalFilename: string;
  fileUrl: string;
  extractedData: InvoiceData | null;
  extractionStatus: 'success' | 'failed';
  extractionError?: string;
}

export class InvoiceStorageService {
  /**
   * Upload un fichier vers Supabase Storage
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<string> {
    try {
      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `invoices/${timestamp}-${sanitizedFilename}`;

      console.log(`📤 Upload fichier: ${key}`);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('invoices')
        .upload(key, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase Storage:', error);
        throw error;
      }

      // Obtenir l'URL publique
      const { data: publicUrlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(key);

      console.log(`✅ Fichier uploadé: ${publicUrlData.publicUrl}`);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('❌ Erreur upload fichier:', error);
      throw error;
    }
  }

  /**
   * Sauvegarder une facture complète (fichier + données extraites)
   */
  async saveInvoice(
    clientId: string,
    emailConfigId: string,
    invoiceData: InvoiceAttachment
  ): Promise<SavedInvoice> {
    try {
      console.log(`💾 Sauvegarde facture: ${invoiceData.filename}`);

      // 1. Upload du fichier vers Supabase Storage
      const fileUrl = await this.uploadFile(
        invoiceData.content,
        invoiceData.filename,
        invoiceData.contentType
      );

      // 2. Parser la facture avec OpenAI
      let extractedData: InvoiceData | null = null;
      let extractionStatus: 'success' | 'failed' = 'pending' as any;
      let extractionError: string | undefined;

      try {
        extractedData = await parseInvoiceFile(
          invoiceData.content,
          invoiceData.contentType
        );
        extractionStatus = extractedData ? 'success' : 'failed';
        if (!extractedData) {
          extractionError = 'Échec de l\'extraction des données';
        }
      } catch (error: any) {
        console.error('❌ Erreur parsing facture:', error);
        extractionStatus = 'failed';
        extractionError = error.message;
      }

      // 3. Sauvegarder en base de données
      const { data: invoice, error: dbError } = await supabase
        .from('invoices_new')
        .insert({
          client_id: clientId,
          email_config_id: emailConfigId,
          email_from: invoiceData.emailFrom,
          email_subject: invoiceData.emailSubject,
          email_date: invoiceData.emailDate.toISOString(),
          email_id: invoiceData.emailId,
          original_filename: invoiceData.filename,
          file_url: fileUrl,
          file_type: this.getFileType(invoiceData.contentType),
          file_size: invoiceData.size,
          extraction_status: extractionStatus,
          extraction_error: extractionError,
          // Données extraites
          invoice_number: extractedData?.invoiceNumber,
          invoice_date: extractedData?.invoiceDate,
          due_date: extractedData?.dueDate,
          vendor_name: extractedData?.vendorName,
          vendor_address: extractedData?.vendorAddress,
          customer_name: extractedData?.customerName,
          subtotal: extractedData?.subtotal,
          total_tax: extractedData?.totalTax,
          invoice_total: extractedData?.invoiceTotal,
          currency: extractedData?.currency || 'EUR',
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Erreur sauvegarde DB:', dbError);
        throw dbError;
      }

      // 4. Sauvegarder les items de la facture
      if (extractedData && extractedData.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(
            extractedData.items.map((item) => ({
              invoice_id: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              amount: item.amount,
            }))
          );

        if (itemsError) {
          console.error('❌ Erreur sauvegarde items:', itemsError);
        } else {
          console.log(`✅ ${extractedData.items.length} items sauvegardés`);
        }
      }

      console.log(`✅ Facture sauvegardée: ${invoice.id}`);

      return {
        id: invoice.id,
        clientId,
        emailConfigId,
        originalFilename: invoiceData.filename,
        fileUrl,
        extractedData,
        extractionStatus,
        extractionError,
      };
    } catch (error) {
      console.error('❌ Erreur sauvegarde facture:', error);
      throw error;
    }
  }

  /**
   * Sauvegarder plusieurs factures en batch
   */
  async saveInvoices(
    clientId: string,
    emailConfigId: string,
    invoices: InvoiceAttachment[]
  ): Promise<SavedInvoice[]> {
    const savedInvoices: SavedInvoice[] = [];

    for (const invoice of invoices) {
      try {
        const saved = await this.saveInvoice(clientId, emailConfigId, invoice);
        savedInvoices.push(saved);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde ${invoice.filename}:`, error);
        // Continuer avec les autres factures
      }
    }

    return savedInvoices;
  }

  /**
   * Obtenir le type de fichier à partir du MIME type
   */
  private getFileType(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
    return 'pdf'; // Par défaut
  }
}

/**
 * Instance singleton du service
 */
export const invoiceStorageService = new InvoiceStorageService();



