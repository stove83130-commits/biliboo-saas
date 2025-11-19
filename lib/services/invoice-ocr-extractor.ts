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
 * Upload un PDF vers OpenAI et extrait les données avec GPT-4o Assistants API
 * ✅ Compatible Vercel/Next.js (OpenAI gère tout côté serveur)
 * ✅ Avec timeout de 90s pour éviter les blocages
 */
async function extractDataDirectlyFromPDF(
  pdfBuffer: Buffer,
  emailContext?: { from: string; subject: string; date: string }
): Promise<Partial<ExtractedInvoiceData>> {
  console.log('📤 [GPT-4o] Upload du PDF vers OpenAI...');
  
  let file: any = null;
  let assistant: any = null;
  
  try {
    // Créer un fichier temporaire
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    // Upload vers OpenAI Files API
    file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });
    
    console.log(`✅ [GPT-4o] PDF uploadé: ${file.id}`);
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempFilePath);
    
    // Créer un assistant temporaire pour lire le PDF
    assistant = await openai.beta.assistants.create({
      name: 'Invoice Data Extractor',
      instructions: 'Tu es un expert comptable. Tu extrais TOUTES les données de factures au format JSON. ⚠️ OBLIGATOIRE : Tu DOIS inclure TOUS les champs demandés dans ta réponse JSON, même s\'ils sont null. Ne supprime JAMAIS un champ. Extrait absolument : subtotal (HT), tax_amount (TVA), tax_rate (taux TVA), ET toutes les coordonnées client (nom, adresse, ville, pays, téléphone, email, numéro de TVA). Les coordonnées client sont généralement dans une section "Facturé à", "Bill to", "Client", "Customer", "Destinataire", ou dans le coin supérieur droit. Elles sont DIFFÉRENTES des coordonnées fournisseur (en-tête). EXEMPLES : "Bill to: John, 123 Main St, Paris, France" OU "Facturé à: Jean, 15 Rue X, Lyon, France" OU "Client: Société ABC, 10 Avenue Y, Marseille, France" → Extrait toujours customer_name, customer_address, customer_city, customer_country, customer_email.',
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

⚠️ PRIORITÉ ABSOLUE : Extrait les coordonnées CLIENT (destinataire) qui sont généralement dans une section "Facturé à", "Bill to", "Client", "Customer", "Destinataire", "Billing address", ou coin supérieur droit. Elles sont DIFFÉRENTES des coordonnées fournisseur (en-tête).

EXEMPLES CONCRETS (formats variés) :
- Format anglais "Bill to:" : "Bill to: stove83130-7604's projects, 126 rue andre vuillet 83100, 83100 Toulon, France, stove83130@gmail.com"
- Format français "Facturé à:" : "Facturé à: Jean Dupont, 15 Avenue des Champs, 75008 Paris, France, jean@example.com"
- Format "Client:" : "Client: Société ABC, 10 Rue de la Paix, 69001 Lyon, France"
- Format "Customer:" : "Customer: John Smith, 123 Main Street, New York, NY 10001, USA"
→ Dans TOUS ces cas, ce sont les coordonnées CLIENT à extraire dans customer_name, customer_address, customer_city, customer_country, customer_email.

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

💳 STATUT DE PAIEMENT (OBLIGATOIRE) :
- "paid" : Document indique "PAID", "PAYÉ", ou c'est un reçu
- "unpaid" : Facture sans indication de paiement
- "pending" : En attente
- "overdue" : Date d'échéance dépassée

CATÉGORIES COMPTABLES (si invoice/receipt) :
- "Matériel informatique et logiciels"
- "Marketing et publicité"
- "Transports et déplacements"
- "Énergie"
- "Télécommunications"
- "Salaires et charges sociales"
- "Loyer et charges locales"
- "Services externes (comptable, avocat, consultant)"
- "Entretien et réparations"
- "Assurances"
- "Frais bancaires et financiers"
- "Fournitures de bureau"

⚠️ OBLIGATOIRE : Retourne un JSON avec cette structure EXACTE. TOUS les champs ci-dessous DOIVENT être présents dans ta réponse (mets null si absent, mais ne les oublie JAMAIS) :
{
  "document_type": "invoice|receipt|contract|other",
  "invoice_number": "numéro de facture/commande/reçu",
  "receipt_number": "numéro de reçu (si différent de invoice_number)",
  "vendor_name": "nom du fournisseur/entreprise",
  "category": "catégorie comptable",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD ou null",
  "total_amount": nombre (montant TTC),
  "subtotal": nombre (montant HT/Sous-total HT) ou null,
  "tax_amount": nombre (montant TVA) ou null,
  "tax_rate": nombre (taux TVA en %) ou null,
  "currency": "EUR/USD/GBP/etc",
  "payment_status": "paid|unpaid|pending|overdue",
  "payment_method": "mode de paiement (carte bancaire, virement, PayPal, chèque, espèces, etc.)" ou null,
  "payment_date": "YYYY-MM-DD ou null",
  "vendor_address": "adresse complète du fournisseur" ou null,
  "vendor_city": "ville du fournisseur" ou null,
  "vendor_country": "pays du fournisseur" ou null,
  "vendor_phone": "téléphone du fournisseur" ou null,
  "vendor_email": "email du fournisseur" ou null,
  "vendor_website": "site web du fournisseur" ou null,
  "customer_name": "nom du client/destinataire" ou null,
  "customer_address": "adresse complète du client" ou null,
  "customer_city": "ville du client" ou null,
  "customer_country": "pays du client" ou null,
  "customer_phone": "téléphone du client" ou null,
  "customer_email": "email du client" ou null,
  "customer_vat_number": "numéro de TVA intracommunautaire du client" ou null,
  "line_items": [
    {
      "description": "description du produit/service",
      "quantity": nombre,
      "unit_price": nombre,
      "total": nombre
    }
  ] ou null,
  "confidence_score": nombre entre 0-100
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

⚠️ IMPORTANT : Tous les champs listés dans la structure JSON ci-dessus DOIVENT être présents dans ta réponse, même s'ils sont null. Ne supprime JAMAIS un champ de ta réponse JSON. Les montants doivent être des nombres uniquement (pas de symboles €/$). Retourne UNIQUEMENT le JSON, sans texte avant/après.`,
          attachments: [{ file_id: file.id, tools: [{ type: 'file_search' }] }],
        },
      ],
    });
    
    // Exécuter l'assistant avec TIMEOUT de 90 secondes
    const runPromise = openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: GPT-4o a pris plus de 90 secondes')), 90000);
    });
    
    const run = await Promise.race([runPromise, timeoutPromise]) as any;
    
    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const responseMessage = messages.data[0];
      
      if (responseMessage.content[0].type === 'text') {
        const responseText = responseMessage.content[0].text.value;
        console.log(`📄 [GPT-4o] Réponse:`, responseText.substring(0, 500));
        
        // Parser le JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let data;
          try {
            data = JSON.parse(jsonMatch[0]);
            console.log(`✅ [GPT-4o PDF] JSON parsé avec succès`);
            console.log(`🔍 [DEBUG PDF] customer_name dans la réponse GPT:`, data.customer_name);
            console.log(`🔍 [DEBUG PDF] customer_address dans la réponse GPT:`, data.customer_address);
            console.log(`🔍 [DEBUG PDF] customer_city dans la réponse GPT:`, data.customer_city);
            console.log(`🔍 [DEBUG PDF] customer_country dans la réponse GPT:`, data.customer_country);
            console.log(`🔍 [DEBUG PDF] customer_email dans la réponse GPT:`, data.customer_email);
          console.log(`✅ [GPT-4o] Données extraites (confiance: ${data.confidence_score}%)`);
          } catch (parseError) {
            console.error(`❌ [GPT-4o PDF] Erreur parsing JSON:`, parseError);
            console.error(`❌ [GPT-4o PDF] JSON brut:`, jsonMatch[0]);
            throw parseError;
          }
          return data;
        }
      }
    }
    
    throw new Error(`Assistant run failed: ${run.status}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [GPT-4o] Erreur extraction:', errorMessage);
    throw new Error(`Échec extraction GPT-4o: ${errorMessage}`);
  } finally {
    // Nettoyer les ressources OpenAI (même en cas d'erreur/timeout)
    try {
      if (assistant?.id) {
        await openai.beta.assistants.del(assistant.id);
        console.log('🧹 [Cleanup] Assistant supprimé');
      }
      if (file?.id) {
        await openai.files.del(file.id);
        console.log('🧹 [Cleanup] Fichier supprimé');
      }
    } catch (cleanupError) {
      console.warn('⚠️ [Cleanup] Erreur nettoyage:', cleanupError);
    }
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

⚠️ OBLIGATOIRE : Retourne un JSON avec cette structure EXACTE. TOUS les champs ci-dessous DOIVENT être présents dans ta réponse (mets null si absent, mais ne les oublie JAMAIS) :

{
  "invoice_number": "numéro de facture/commande/reçu",
  "receipt_number": "numéro de reçu (si différent de invoice_number)",
  "vendor_name": "nom du fournisseur/entreprise",
  "category": "catégorie comptable" ou null,
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD ou null",
  "total_amount": nombre (montant TTC),
  "subtotal": nombre (montant HT/Sous-total HT) ou null,
  "tax_amount": nombre (montant TVA) ou null,
  "tax_rate": nombre (taux TVA en %) ou null,
  "currency": "EUR/USD/GBP/etc",
  "vendor_address": "adresse complète du fournisseur" ou null,
  "vendor_city": "ville du fournisseur" ou null,
  "vendor_country": "pays du fournisseur" ou null,
  "vendor_phone": "téléphone du fournisseur" ou null,
  "vendor_email": "email du fournisseur" ou null,
  "vendor_website": "site web du fournisseur" ou null,
  "customer_name": "nom du client/destinataire" ou null,
  "customer_address": "adresse complète du client" ou null,
  "customer_city": "ville du client" ou null,
  "customer_country": "pays du client" ou null,
  "customer_phone": "téléphone du client" ou null,
  "customer_email": "email du client" ou null,
  "customer_vat_number": "numéro de TVA intracommunautaire du client" ou null,
  "payment_status": "paid/unpaid/pending/overdue" ou null,
  "payment_method": "mode de paiement (carte bancaire, virement, PayPal, chèque, espèces, etc.)" ou null,
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

⚠️ IMPORTANT : Tous les champs listés dans la structure JSON ci-dessus DOIVENT être présents dans ta réponse, même s'ils sont null. Ne supprime JAMAIS un champ de ta réponse JSON. Le confidence_score doit refléter la qualité du texte OCR et la clarté des infos. Retourne UNIQUEMENT le JSON, sans texte avant/après.

Réponds avec le JSON maintenant:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en extraction de données de factures. Tu réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire. ⚠️ OBLIGATOIRE : Tu DOIS inclure TOUS les champs demandés dans ta réponse JSON, même s\'ils sont null. Ne supprime JAMAIS un champ. Extrait absolument : subtotal (HT), tax_amount (TVA), tax_rate (taux TVA), ET toutes les coordonnées client (nom, adresse, ville, pays, téléphone, email, numéro de TVA). Les coordonnées client sont généralement dans une section "Facturé à", "Bill to", "Client", "Customer", "Destinataire", ou dans le coin supérieur droit. Elles sont DIFFÉRENTES des coordonnées fournisseur (en-tête). EXEMPLES : "Bill to: John, 123 Main St, Paris, France" OU "Facturé à: Jean, 15 Rue X, Lyon, France" OU "Client: Société ABC, 10 Avenue Y, Marseille, France" → Extrait toujours customer_name, customer_address, customer_city, customer_country, customer_email.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Bas pour plus de cohérence
      max_tokens: 3000, // Augmenté pour inclure tous les champs (coordonnées fournisseur, client, etc.)
    });

    const responseText = completion.choices[0].message.content || '{}';
    console.log(`📄 [GPT-4o OCR] Réponse brute (premiers 1000 caractères):`, responseText.substring(0, 1000));
    console.log(`📄 [GPT-4o OCR] Réponse brute (derniers 500 caractères):`, responseText.substring(Math.max(0, responseText.length - 500)));
    
    // Parser le JSON (avec gestion des markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let data;
      try {
        data = JSON.parse(jsonMatch[0]);
        console.log(`✅ [GPT-4o OCR] JSON parsé avec succès`);
        console.log(`🔍 [DEBUG OCR] customer_name dans la réponse GPT:`, data.customer_name);
        console.log(`🔍 [DEBUG OCR] customer_address dans la réponse GPT:`, data.customer_address);
        console.log(`🔍 [DEBUG OCR] customer_city dans la réponse GPT:`, data.customer_city);
        console.log(`🔍 [DEBUG OCR] customer_country dans la réponse GPT:`, data.customer_country);
        console.log(`🔍 [DEBUG OCR] customer_email dans la réponse GPT:`, data.customer_email);
      console.log(`✅ [GPT-4o] Données structurées avec confiance: ${data.confidence_score}%`);
      } catch (parseError) {
        console.error(`❌ [GPT-4o OCR] Erreur parsing JSON:`, parseError);
        console.error(`❌ [GPT-4o OCR] JSON brut:`, jsonMatch[0]);
        throw parseError;
      }
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
 * 🔍 VALIDATION : Vérifie si un document est une facture/reçu avant extraction complète
 * - Pour les images : utilise GPT-4o-mini Vision
 * - Pour les PDFs : utilise GPT-4o-mini avec l'API Files/Assistants
 * Coût : ~$0.0002-0.001 par validation
 */
export async function validateDocumentIsInvoice(
  documentBuffer: Buffer,
  filename?: string
): Promise<{ isValid: boolean; reason?: string }> {
  console.log('🔍 [VALIDATION] Vérification si le document est une facture/reçu...');
  
  const isPdf = filename?.toLowerCase().endsWith('.pdf') || (!filename && documentBuffer[0] === 0x25 && documentBuffer[1] === 0x50 && documentBuffer[2] === 0x44 && documentBuffer[3] === 0x46); // Signature PDF: %PDF
  
  try {
    if (isPdf) {
      // Pour les PDFs : utiliser l'API Files/Assistants
      console.log('📄 [VALIDATION] PDF détecté, utilisation de l\'API Files/Assistants...');
      
      // Créer un fichier temporaire
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `validation-${Date.now()}.pdf`);
      fs.writeFileSync(tempFilePath, documentBuffer);
      
      let file: any = null;
      let assistant: any = null;
      
      try {
        // Upload vers OpenAI Files API
        file = await openai.files.create({
          file: fs.createReadStream(tempFilePath),
          purpose: 'assistants',
        });
        
        // Créer un assistant avec GPT-4o-mini
        assistant = await openai.beta.assistants.create({
          model: 'gpt-4o-mini',
          instructions: `Tu es un expert en classification de documents. Analyse le document fourni et détermine s'il s'agit d'une facture, d'un reçu, d'un document de paiement, ou d'un bon de commande.

Critères à vérifier pour une facture/reçu :
- Présence d'un numéro de facture/commande/reçu
- Présence d'un montant total avec devise (€, $, etc.)
- Présence d'une date de facture/paiement/émission
- Présence d'informations de vendeur/fournisseur
- Structure typique d'une facture (articles, quantités, prix, total)

Documents à REJETER (répondre NON) :
- RIB (Relevé d'Identité Bancaire) : contient IBAN, BIC, coordonnées bancaires, numéro de compte
- Contrat : clauses, conditions générales, termes et conditions
- CGU/CGV : mentions légales, politique de confidentialité
- Newsletter : contenu marketing, promotions
- Document administratif : attestation, certificat, justificatif non-financier
- Tout autre document qui n'est pas une facture/reçu/document de paiement

Réponds UNIQUEMENT "OUI" si c'est une facture/reçu/document de paiement/bon de commande, ou "NON" sinon.
Si NON, explique brièvement pourquoi en une phrase.`,
          tools: [{ type: 'file_search' }],
        });
        
        // Créer un thread et ajouter le fichier
        const thread = await openai.beta.threads.create({
          messages: [
            {
              role: 'user',
              content: 'Analyse ce document et réponds "OUI" si c\'est une facture/reçu/document de paiement, ou "NON" sinon.',
              attachments: [
                {
                  file_id: file.id,
                  tools: [{ type: 'file_search' }],
                },
              ],
            },
          ],
        });
        
        // Lancer l'assistant
        const run = await openai.beta.threads.runs.create(thread.id, {
          assistant_id: assistant.id,
        });
        
        // Attendre la réponse (timeout de 30s)
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        const startTime = Date.now();
        const timeout = 30000; // 30 secondes
        
        while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
          if (Date.now() - startTime > timeout) {
            throw new Error('Timeout validation PDF');
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        }
        
        if (runStatus.status === 'completed') {
          // Récupérer les messages
          const messages = await openai.beta.threads.messages.list(thread.id);
          const responseText = (messages.data[0]?.content[0] as any)?.text?.value || '';
          const responseUpper = responseText.trim().toUpperCase();
          const isValid = responseUpper.includes('OUI') || responseUpper.includes('YES');
          const reason = isValid ? undefined : responseText;
          
          if (isValid) {
            console.log('✅ [VALIDATION] Document validé : c\'est une facture/reçu');
          } else {
            console.log(`❌ [VALIDATION] Document rejeté : ${reason || 'Ce n\'est pas une facture/reçu'}`);
          }
          
          // Nettoyer
          fs.unlinkSync(tempFilePath);
          
          return { isValid, reason };
        } else {
          throw new Error(`Assistant run failed: ${runStatus.status}`);
        }
      } finally {
        // Nettoyer les ressources
        try {
          if (assistant?.id) {
            await openai.beta.assistants.del(assistant.id);
          }
          if (file?.id) {
            await openai.files.del(file.id);
          }
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          console.warn('⚠️ [VALIDATION] Erreur nettoyage:', cleanupError);
        }
      }
    } else {
      // Pour les images : utiliser GPT-4o-mini Vision
      console.log('🖼️ [VALIDATION] Image détectée, utilisation de l\'API Vision...');
      
      const base64 = documentBuffer.toString('base64');
      const mimeType = filename?.toLowerCase().endsWith('.png')
        ? 'image/png'
        : filename?.toLowerCase().endsWith('.jpg') || filename?.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png'; // Par défaut PNG
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyse ce document et détermine s'il s'agit d'une facture, d'un reçu, d'un document de paiement, ou d'un bon de commande.

Critères à vérifier pour une facture/reçu :
- Présence d'un numéro de facture/commande/reçu
- Présence d'un montant total avec devise (€, $, etc.)
- Présence d'une date de facture/paiement/émission
- Présence d'informations de vendeur/fournisseur
- Structure typique d'une facture (articles, quantités, prix, total)

Documents à REJETER (répondre NON) :
- RIB (Relevé d'Identité Bancaire) : contient IBAN, BIC, coordonnées bancaires, numéro de compte
- Contrat : clauses, conditions générales, termes et conditions
- CGU/CGV : mentions légales, politique de confidentialité
- Newsletter : contenu marketing, promotions
- Document administratif : attestation, certificat, justificatif non-financier
- Tout autre document qui n'est pas une facture/reçu/document de paiement

Réponds UNIQUEMENT "OUI" si c'est une facture/reçu/document de paiement/bon de commande, ou "NON" sinon.
Si NON, explique brièvement pourquoi en une phrase.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 50, // Réponse courte : OUI ou NON
        temperature: 0.1, // Faible température pour réponse déterministe
      });
      
      const responseText = completion.choices[0].message.content?.trim().toUpperCase() || '';
      const isValid = responseText.includes('OUI') || responseText.includes('YES');
      const reason = isValid ? undefined : responseText;
      
      if (isValid) {
        console.log('✅ [VALIDATION] Document validé : c\'est une facture/reçu');
      } else {
        console.log(`❌ [VALIDATION] Document rejeté : ${reason || 'Ce n\'est pas une facture/reçu'}`);
      }
      
      return { isValid, reason };
    }
    
  } catch (error: any) {
    console.error('❌ [VALIDATION] Erreur lors de la validation:', error?.message || error);
    // ⚠️ IMPORTANT : En cas d'erreur, on REJETTE le document par sécurité (pour éviter les faux positifs comme les RIBs)
    console.log('⚠️ [VALIDATION] Erreur de validation, document REJETÉ par sécurité (pour éviter les faux positifs)');
    return { isValid: false, reason: `Erreur de validation: ${error?.message || 'Erreur inconnue'}` };
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
      category: null,
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
      customer_name: null,
      customer_address: null,
      customer_city: null,
      customer_country: null,
      customer_phone: null,
      customer_email: null,
      customer_vat_number: null,
      payment_status: null,
      payment_method: null,
      payment_date: null,
      line_items: null,
      document_type: null,
      extraction_status: 'failed',
      confidence_score: 0,
      ocr_text: '',
    };
  }
}

