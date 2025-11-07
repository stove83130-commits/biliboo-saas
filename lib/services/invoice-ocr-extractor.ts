/**
 * 🤖 SERVICE D'EXTRACTION DE DONNÉES DE FACTURES
 * 
 * Workflow d'extraction SIMPLIFIÉ et ROBUSTE :
 * 1. Upload le PDF vers OpenAI Files API
 * 2. Utilise GPT-4o pour lire et extraire les données directement du PDF
 * 3. Retourne les données structurées avec score de confiance
 * 
 * Compatible avec Next.js (pas de workers, pas de binaires natifs)
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ExtractedInvoiceData {
  // Informations principales
  invoice_number: string | null;
  vendor_name: string | null;
  category: string | null; // Catégorie comptable
  invoice_date: string | null; // Format ISO: YYYY-MM-DD
  due_date: string | null;
  
  // Montants
  total_amount: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  tax_rate: number | null;
  currency: string | null;
  
  // Coordonnées fournisseur (émetteur de la facture)
  vendor_address: string | null;
  vendor_city: string | null;
  vendor_country: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  vendor_website: string | null;
  
  // Coordonnées client (destinataire de la facture)
  customer_name: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_country: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_vat_number: string | null; // Numéro de TVA du client
  
  // Paiement
  payment_status: 'paid' | 'unpaid' | 'pending' | 'overdue' | null;
  payment_method: string | null;
  payment_date: string | null;
  
  // Lignes de facture
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }> | null;
  
  // 🔍 CLASSIFICATION DU DOCUMENT (NOUVEAU !)
  document_type: 'invoice' | 'receipt' | 'terms_and_conditions' | 'pricing_sheet' | 'notification' | 'contract' | 'other' | null;
  
  // Métadonnées d'extraction
  extraction_status: 'success' | 'partial' | 'failed';
  confidence_score: number; // 0-100%
  ocr_text: string; // Texte brut extrait par OCR
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Upload un PDF vers OpenAI et extrait les données avec GPT-4o
 */
async function extractDataDirectlyFromPDF(
  pdfBuffer: Buffer,
  emailContext?: { from: string; subject: string; date: string }
): Promise<Partial<ExtractedInvoiceData>> {
  console.log('📤 [GPT-4o] Upload du PDF vers OpenAI...');
  
  try {
    // Créer un fichier temporaire
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    // Upload vers OpenAI Files API
    const file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });
    
    console.log(`✅ [GPT-4o] PDF uploadé: ${file.id}`);
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempFilePath);
    
    // Créer un assistant temporaire pour lire le PDF
    const assistant = await openai.beta.assistants.create({
      name: 'Invoice Data Extractor',
      instructions: 'Tu es un expert comptable. Tu extrais les données de factures au format JSON.',
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
    });
    
    // Créer un thread avec le fichier
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: `Analyse cette facture PDF et extrait TOUTES les données au format JSON.

${emailContext ? `CONTEXTE EMAIL:
- De: ${emailContext.from}
- Sujet: ${emailContext.subject}
- Date: ${emailContext.date}
` : ''}

IMPORTANT : 
1. **IDENTIFIE D'ABORD LE TYPE DE DOCUMENT** (voir ci-dessous)
2. Si c'est une facture/reçu, catégorise selon le type de dépense.

🔍 TYPE DE DOCUMENT (OBLIGATOIRE - choisis le plus approprié) :
- "invoice" : Facture commerciale avec montant à payer et numéro de facture
- "receipt" : Reçu/ticket de caisse confirmant un paiement déjà effectué
- "terms_and_conditions" : Conditions générales, CGV, CGU, mentions légales
- "pricing_sheet" : Grille tarifaire, barème de prix, liste de tarifs
- "notification" : Notification, alerte, changement de service (sans montant dû)
- "contract" : Contrat, accord commercial, convention
- "other" : Autre type de document

⚠️ ATTENTION : Si le document contient UNIQUEMENT des tarifs/frais FUTURS (ex: "nos nouveaux tarifs", "grille tarifaire") 
   → c'est un "pricing_sheet", PAS une facture !

💳 STATUT DE PAIEMENT (OBLIGATOIRE - analyse le document pour déterminer) :
- "paid" : Si le document indique "PAID", "PAYÉ", "Payment received", "Reçu", ou si c'est un REÇU (receipt)
- "unpaid" : Si c'est une FACTURE (invoice) sans indication de paiement, ou "UNPAID", "À PAYER"
- "pending" : Si le document indique "En attente", "Pending", "Processing"
- "overdue" : Si la date d'échéance (due_date) est dépassée et non payé

📌 RÈGLE SIMPLE :
- document_type = "receipt" → payment_status = "paid" (un reçu = déjà payé)
- document_type = "invoice" + aucune mention de paiement → payment_status = "unpaid"
- document_type = "invoice" + "PAID" visible → payment_status = "paid"

CATÉGORIES COMPTABLES (si document_type = "invoice" ou "receipt") :
- "Salaires et charges sociales" : paie, cotisations sociales, URSSAF
- "Loyer et charges locales" : loyer bureau, charges immeuble, copropriété
- "Matières premières" : matériaux, stocks, fournitures production
- "Services externes (comptable, avocat, consultant)" : honoraires professionnels
- "Matériel informatique et logiciels" : ordinateurs, licences, SaaS, abonnements tech
- "Marketing et publicité" : campagnes pub, SEO, réseaux sociaux, communication
- "Transports et déplacements" : carburant, péages, billets train/avion, hôtels
- "Énergie" : électricité, gaz, eau
- "Entretien et réparations" : maintenance, réparations équipements
- "Assurances" : assurances professionnelles, RC, véhicules
- "Frais bancaires et financiers" : frais bancaires, intérêts, commissions
- "Fournitures de bureau" : papeterie, mobilier bureau
- "Sous-traitance" : prestations externes, freelances
- "Télécommunications" : téléphone, internet, mobile
- "Formation et développement" : formations, séminaires, coaching
- "Taxes et cotisations" : taxes professionnelles, CFE, impôts
- "Amortissements" : amortissements comptables
- "Charges exceptionnelles" : charges non récurrentes, imprévues

Retourne un JSON avec cette structure EXACTE:
{
  "document_type": "invoice|receipt|terms_and_conditions|pricing_sheet|notification|contract|other (OBLIGATOIRE)",
  "invoice_number": "numéro",
  "vendor_name": "nom fournisseur (émetteur)",
  "category": "UNE DES CATÉGORIES CI-DESSUS (si invoice/receipt, sinon null)",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD ou null",
  "total_amount": nombre,
  "subtotal": nombre ou null,
  "tax_amount": nombre ou null,
  "tax_rate": nombre ou null,
  "currency": "EUR/USD/GBP",
  "vendor_address": "adresse fournisseur" ou null,
  "vendor_city": "ville fournisseur" ou null,
  "vendor_country": "pays fournisseur" ou null,
  "vendor_phone": "téléphone fournisseur" ou null,
  "vendor_email": "email fournisseur" ou null,
  "vendor_website": "site fournisseur" ou null,
  "customer_name": "nom du client (destinataire)" ou null,
  "customer_address": "adresse client" ou null,
  "customer_city": "ville client" ou null,
  "customer_country": "pays client" ou null,
  "customer_phone": "téléphone client" ou null,
  "customer_email": "email client" ou null,
  "customer_vat_number": "numéro TVA client" ou null,
  "payment_status": "paid|unpaid|pending|overdue (OBLIGATOIRE - détermine selon le contexte)",
  "payment_method": "méthode" ou null,
  "payment_date": "YYYY-MM-DD" ou null,
  "line_items": [{"description": "...", "quantity": 1, "unit_price": 10, "total": 10}] ou null,
  "confidence_score": 0-100
}

Réponds UNIQUEMENT avec le JSON, sans texte avant/après.`,
          attachments: [{ file_id: file.id, tools: [{ type: 'file_search' }] }],
        },
      ],
    });
    
    // Exécuter l'assistant
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });
    
    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const responseMessage = messages.data[0];
      
      if (responseMessage.content[0].type === 'text') {
        const responseText = responseMessage.content[0].text.value;
        console.log(`📄 [GPT-4o] Réponse:`, responseText.substring(0, 500));
        
        // Parser le JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          console.log(`✅ [GPT-4o] Données extraites (confiance: ${data.confidence_score}%)`);
          
          // Nettoyer
          await openai.beta.assistants.del(assistant.id);
          await openai.files.del(file.id);
          
          return data;
        }
      }
    }
    
    throw new Error(`Assistant run failed: ${run.status}`);
  } catch (error) {
    console.error('❌ [GPT-4o] Erreur extraction:', error);
    throw new Error(`Échec extraction GPT-4o: ${error}`);
  }
}

/**
 * Structure les données extraites avec GPT-4o
 */
async function structureDataWithGPT(ocrText: string, emailContext?: {
  from: string;
  subject: string;
  date: string;
}): Promise<Partial<ExtractedInvoiceData>> {
  console.log('🤖 [GPT-4o] Structuration des données...');
  
  const prompt = `Tu es un expert comptable spécialisé dans l'extraction de données de factures.

TEXTE EXTRAIT PAR OCR (peut contenir des erreurs):
${ocrText.substring(0, 15000)} 

${emailContext ? `
CONTEXTE EMAIL:
- Expéditeur: ${emailContext.from}
- Sujet: ${emailContext.subject}
- Date: ${emailContext.date}
` : ''}

TÂCHE:
Analyse ce texte et extrait TOUTES les informations de facture disponibles.
Retourne un JSON avec cette structure EXACTE:

{
  "invoice_number": "numéro de facture",
  "vendor_name": "nom du fournisseur/entreprise",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD ou null",
  "total_amount": nombre (montant TTC),
  "subtotal": nombre (montant HT) ou null,
  "tax_amount": nombre (montant TVA) ou null,
  "tax_rate": nombre (taux TVA en %) ou null,
  "currency": "EUR/USD/GBP",
  "vendor_address": "adresse complète" ou null,
  "vendor_city": "ville" ou null,
  "vendor_country": "pays" ou null,
  "vendor_phone": "téléphone" ou null,
  "vendor_email": "email" ou null,
  "vendor_website": "site web" ou null,
  "payment_status": "paid/unpaid/pending/overdue" ou null,
  "payment_method": "card/bank_transfer/paypal/etc" ou null,
  "payment_date": "YYYY-MM-DD ou null",
  "line_items": [
    {
      "description": "description du produit/service",
      "quantity": nombre,
      "unit_price": nombre,
      "total": nombre
    }
  ] ou null,
  "confidence_score": nombre entre 0-100 (ton niveau de confiance dans l'extraction)
}

RÈGLES IMPORTANTES:
1. Cherche TOUS les montants (Total, Subtotal, Tax, etc.)
2. Les dates doivent être au format ISO: YYYY-MM-DD
3. Les montants doivent être des NOMBRES (pas de symboles €/$)
4. Si une info n'est pas trouvée, mets null (pas de string vide)
5. Pour line_items, extrait TOUTES les lignes de la facture
6. Le confidence_score doit refléter la qualité du texte OCR et la clarté des infos
7. Retourne UNIQUEMENT le JSON, sans texte avant/après

Réponds avec le JSON maintenant:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en extraction de données de factures. Tu réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Bas pour plus de cohérence
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content || '{}';
    console.log(`📄 [GPT-4o] Réponse brute:`, responseText.substring(0, 500));
    
    // Parser le JSON (avec gestion des markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      console.log(`✅ [GPT-4o] Données structurées avec confiance: ${data.confidence_score}%`);
      return data;
    } else {
      console.warn('⚠️ [GPT-4o] Pas de JSON trouvé dans la réponse');
      return { confidence_score: 0 };
    }
  } catch (error) {
    console.error('❌ [GPT-4o] Erreur structuration:', error);
    throw new Error(`Échec GPT-4o: ${error}`);
  }
}

/**
 * FONCTION PRINCIPALE : Extrait les données complètes d'une facture
 * Utilise l'API Assistants d'OpenAI pour lire directement le PDF
 */
export async function extractInvoiceData(
  pdfBuffer: Buffer,
  emailContext?: {
    from: string;
    subject: string;
    date: string;
  }
): Promise<ExtractedInvoiceData> {
  console.log('\n🚀 [EXTRACTION] Début du processus complet...');
  
  try {
    // Extraction directe avec GPT-4o (lit le PDF nativement)
    const structuredData = await extractDataDirectlyFromPDF(pdfBuffer, emailContext);
    
    // Déterminer le statut d'extraction
    const confidenceScore = structuredData.confidence_score || 0;
    let extraction_status: 'success' | 'partial' | 'failed' = 'failed';
    
    if (confidenceScore >= 80) {
      extraction_status = 'success';
    } else if (confidenceScore >= 50) {
      extraction_status = 'partial';
    }
    
    console.log(`✅ [EXTRACTION] Terminé avec statut: ${extraction_status} (${confidenceScore}%)`);
    
    return {
      ...structuredData,
      extraction_status,
      confidence_score: confidenceScore,
      ocr_text: '', // Pas d'OCR dans cette approche
    } as ExtractedInvoiceData;
    
  } catch (error) {
    console.error('❌ [EXTRACTION] Erreur fatale:', error);
    
    return {
      invoice_number: null,
      vendor_name: emailContext?.from || null,
      invoice_date: emailContext?.date || null,
      due_date: null,
      total_amount: null,
      subtotal: null,
      tax_amount: null,
      tax_rate: null,
      currency: null,
      vendor_address: null,
      vendor_city: null,
      vendor_country: null,
      vendor_phone: null,
      vendor_email: null,
      vendor_website: null,
      payment_status: null,
      payment_method: null,
      payment_date: null,
      line_items: null,
      extraction_status: 'failed',
      confidence_score: 0,
      ocr_text: '',
    };
  }
}

