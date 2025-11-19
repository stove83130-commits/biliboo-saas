/**
 * Service d'analyse et d'extraction des données de factures
 * Utilise OpenAI GPT-4 Vision pour extraire les données structurées
 */

import OpenAI from 'openai';

export interface InvoiceData {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  customerName: string | null;
  subtotal: number | null;
  totalTax: number | null;
  invoiceTotal: number | null;
  currency: string | null;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export class InvoiceParser {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Parse une facture (PDF ou image) en utilisant OpenAI GPT-4 Vision
   * @param fileBuffer Buffer du fichier (PDF ou image)
   * @param mimeType Type MIME du fichier
   * @returns Données structurées de la facture
   */
  async parseInvoice(fileBuffer: Buffer, mimeType: string): Promise<InvoiceData | null> {
    try {
      // Convertir le buffer en base64
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log(`🔍 Analyse de la facture (${mimeType})...`);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extrais toutes les informations de cette facture au format JSON strict avec les champs suivants:
{
  "invoiceNumber": "string ou null",
  "invoiceDate": "YYYY-MM-DD ou null",
  "dueDate": "YYYY-MM-DD ou null",
  "vendorName": "string ou null",
  "vendorAddress": "string ou null",
  "customerName": "string ou null",
  "subtotal": number ou null,
  "totalTax": number ou null,
  "invoiceTotal": number ou null,
  "currency": "EUR/USD/GBP/etc ou null",
  "items": [
    {
      "description": "string",
      "quantity": number ou null,
      "unitPrice": number ou null,
      "amount": number ou null
    }
  ]
}

IMPORTANT:
- Retourne UNIQUEMENT le JSON, sans texte avant ou après
- Si une information n'est pas trouvée, mets null
- Pour les montants, utilise des nombres décimaux (ex: 123.45)
- Pour les dates, utilise le format YYYY-MM-DD
- Pour les items, extrais tous les produits/services facturés`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1, // Basse température pour plus de précision
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('❌ Aucune réponse de OpenAI');
        return null;
      }

      // Parser le JSON
      const cleanedContent = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const invoiceData: InvoiceData = JSON.parse(cleanedContent);

      console.log('✅ Facture analysée avec succès');
      console.log(`   - Numéro: ${invoiceData.invoiceNumber}`);
      console.log(`   - Date: ${invoiceData.invoiceDate}`);
      console.log(`   - Fournisseur: ${invoiceData.vendorName}`);
      console.log(`   - Total: ${invoiceData.invoiceTotal} ${invoiceData.currency}`);
      console.log(`   - Items: ${invoiceData.items.length}`);

      return invoiceData;
    } catch (error: any) {
      console.error('❌ Erreur analyse facture:', error.message);
      
      // Si c'est une erreur de parsing JSON, essayer de nettoyer davantage
      if (error instanceof SyntaxError) {
        console.error('❌ Erreur parsing JSON. Contenu reçu:', error.message);
      }
      
      return null;
    }
  }

  /**
   * Parse une facture en utilisant une approche simplifiée (extraction basique)
   * Utilisé comme fallback si OpenAI échoue
   */
  async parseInvoiceBasic(text: string): Promise<Partial<InvoiceData>> {
    const data: Partial<InvoiceData> = {
      items: [],
    };

    // Extraire le numéro de facture
    const invoiceNumberMatch = text.match(/(?:invoice|facture|n°|#)\s*:?\s*([A-Z0-9-]+)/i);
    if (invoiceNumberMatch) {
      data.invoiceNumber = invoiceNumberMatch[1];
    }

    // Extraire la date
    const dateMatch = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      data.invoiceDate = dateMatch[0];
    }

    // Extraire le montant total
    const totalMatch = text.match(/(?:total|montant)\s*:?\s*([\d,]+\.?\d{0,2})\s*([€$£]|EUR|USD|GBP)?/i);
    if (totalMatch) {
      data.invoiceTotal = parseFloat(totalMatch[1].replace(',', '.'));
      data.currency = totalMatch[2] || 'EUR';
    }

    return data;
  }
}

/**
 * Fonction utilitaire pour parser une facture
 */
export async function parseInvoiceFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<InvoiceData | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY non définie');
    return null;
  }

  const parser = new InvoiceParser(apiKey);
  return parser.parseInvoice(fileBuffer, mimeType);
}



