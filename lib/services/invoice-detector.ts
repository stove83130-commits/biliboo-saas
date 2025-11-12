/**
 * 🎯 MODULE DE DÉTECTION INTELLIGENTE DES FACTURES
 * 
 * Filtre les PDFs avant l'extraction GPT pour réduire les coûts
 * en rejetant les documents qui ne sont clairement pas des factures.
 * 
 * Système de scoring en 2 étapes :
 * 1. Score métadonnées (nom fichier, expéditeur, sujet)
 * 2. Score contenu (texte extrait du PDF)
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface InvoiceDetectionResult {
  shouldProcess: boolean; // Si le PDF doit être traité
  metadataScore: number; // Score basé sur les métadonnées
  contentScore: number | null; // Score basé sur le contenu (null si pas analysé)
  totalScore: number; // Score total
  reason: string; // Raison du rejet ou acceptation
}

export interface PDFMetadata {
  filename: string | null;
  senderDomain: string; // Domaine de l'expéditeur
  subject: string; // Sujet de l'email
  size: number; // Taille en bytes
}

/**
 * ÉTAPE 1 : Calcul du score métadonnées
 * Analyse le nom du fichier, l'expéditeur et le sujet
 */
export function calculateMetadataScore(metadata: PDFMetadata): {
  score: number;
  details: string[];
} {
  let score = 0;
  const details: string[] = [];
  const filenameLower = (metadata.filename || '').toLowerCase();
  const subjectLower = metadata.subject.toLowerCase();
  const senderLower = metadata.senderDomain.toLowerCase();

  // +3 si nom contient invoice, receipt, facture, recu, reçu
  const strongInvoiceKeywords = ['invoice', 'receipt', 'facture', 'recu', 'reçu'];
  if (strongInvoiceKeywords.some(kw => filenameLower.includes(kw))) {
    score += 3;
    details.push(`+3: Nom fichier contient mot-clé facture fort`);
  }

  // +2 si nom contient order, billing, statement, payment
  const mediumInvoiceKeywords = ['order', 'billing', 'statement', 'payment'];
  if (mediumInvoiceKeywords.some(kw => filenameLower.includes(kw))) {
    score += 2;
    details.push(`+2: Nom fichier contient mot-clé facture moyen`);
  }

  // Note: On ne privilégie plus les domaines spécifiques pour être équitable avec tous les expéditeurs
  // Les indépendants et petites entreprises doivent avoir les mêmes chances que les grandes marques

  // +2 si sujet contient un mot-clé facture
  const invoiceKeywords = /\b(invoice|facture|receipt|reçu|bill|payment|paiement|order|commande|subscription|abonnement|billing|paid|payé|transaction|purchase|achat|charge|débit|confirmation|confirme|successful|réussi)\b/i;
  if (invoiceKeywords.test(subjectLower)) {
    score += 2;
    details.push(`+2: Sujet contient mot-clé facture`);
  }

  // −3 si nom contient terms, policy, privacy, cgu, cgv, guide, manual, newsletter
  const exclusionKeywords = ['terms', 'policy', 'privacy', 'cgu', 'cgv', 'guide', 'manual', 'newsletter'];
  if (exclusionKeywords.some(kw => filenameLower.includes(kw))) {
    score -= 3;
    details.push(`-3: Nom fichier contient mot-clé exclusion`);
  }

  // +1 si taille entre 3 KB et 5 MB
  const sizeKB = metadata.size / 1024;
  const sizeMB = metadata.size / (1024 * 1024);
  if (sizeKB >= 3 && sizeMB <= 5) {
    score += 1;
    details.push(`+1: Taille fichier dans la plage normale (${sizeKB.toFixed(1)} KB)`);
  }

  return { score, details };
}

/**
 * ÉTAPE 2 : Extraction du texte du PDF et calcul du score contenu
 * Utilise OpenAI pour extraire le texte (ou OCR fallback)
 */
export async function calculateContentScore(
  pdfBuffer: Buffer,
  metadata: PDFMetadata
): Promise<{
  score: number;
  text: string;
  details: string[];
}> {
  let score = 0;
  const details: string[] = [];
  let extractedText = '';

  let file: any = null;
  let assistant: any = null;
  let thread: any = null;
  let tempFilePath: string | null = null;

  try {
    // Extraire le texte du PDF avec OpenAI
    // On utilise une approche simple : demander à GPT d'extraire le texte
    console.log(`📄 [DETECTOR] Extraction du texte du PDF pour analyse...`);

    // Créer un fichier temporaire
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.default.tmpdir();
    tempFilePath = path.default.join(tempDir, `detect-${Date.now()}.pdf`);
    fs.default.writeFileSync(tempFilePath, pdfBuffer);

    // Upload vers OpenAI
    file = await openai.files.create({
      file: fs.default.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    console.log(`✅ [DETECTOR] Fichier uploadé vers OpenAI: ${file.id}`);

    // Nettoyer le fichier temporaire immédiatement
    try {
      fs.default.unlinkSync(tempFilePath);
      tempFilePath = null;
    } catch (unlinkError) {
      console.warn(`⚠️ [DETECTOR] Erreur suppression fichier temp:`, unlinkError);
    }

    // Créer un assistant temporaire pour extraire le texte
    assistant = await openai.beta.assistants.create({
      name: 'PDF Text Extractor',
      instructions: 'Extrait uniquement le texte brut du PDF, sans formatage. Retourne le texte tel quel.',
      model: 'gpt-4o-mini', // Utiliser mini pour être plus rapide et moins cher
      tools: [{ type: 'file_search' }],
    });

    console.log(`✅ [DETECTOR] Assistant créé: ${assistant.id}`);

    // Créer un thread
    thread = await openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: 'Extrait tout le texte de ce PDF. Retourne uniquement le texte brut, sans commentaires.',
          attachments: [{ file_id: file.id, tools: [{ type: 'file_search' }] }],
        },
      ],
    });

    console.log(`✅ [DETECTOR] Thread créé: ${thread.id}, démarrage extraction...`);

    // Exécuter avec timeout (augmenté à 45s pour être plus permissif)
    const runPromise = openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout extraction texte après 45s')), 45000)
    );

    const run = await Promise.race([runPromise, timeoutPromise]) as any;

    console.log(`📊 [DETECTOR] Run terminé avec status: ${run.status}`);

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0];
      
      if (lastMessage?.content?.[0]?.type === 'text') {
        extractedText = lastMessage.content[0].text.value;
        console.log(`✅ [DETECTOR] Texte extrait: ${extractedText.length} caractères`);
      } else {
        console.warn(`⚠️ [DETECTOR] Message sans texte, type: ${lastMessage?.content?.[0]?.type}`);
      }
    } else {
      console.warn(`⚠️ [DETECTOR] Run non complété, status: ${run.status}`);
    }

  } catch (error: any) {
    console.error(`❌ [DETECTOR] Erreur extraction texte:`, error?.message || error);
    // Si l'extraction échoue, on continue avec un score de 0
    extractedText = '';
  } finally {
    // Nettoyer les ressources OpenAI dans tous les cas
    try {
      if (thread) {
        await openai.beta.threads.del(thread.id);
        console.log(`✅ [DETECTOR] Thread supprimé`);
      }
    } catch (error) {
      console.warn(`⚠️ [DETECTOR] Erreur suppression thread:`, error);
    }

    try {
      if (assistant) {
        await openai.beta.assistants.del(assistant.id);
        console.log(`✅ [DETECTOR] Assistant supprimé`);
      }
    } catch (error) {
      console.warn(`⚠️ [DETECTOR] Erreur suppression assistant:`, error);
    }

    try {
      if (file) {
        await openai.files.del(file.id);
        console.log(`✅ [DETECTOR] Fichier supprimé`);
      }
    } catch (error) {
      console.warn(`⚠️ [DETECTOR] Erreur suppression fichier:`, error);
    }

    // Nettoyer le fichier temporaire s'il existe encore
    if (tempFilePath) {
      try {
        const fs = await import('fs');
        fs.default.unlinkSync(tempFilePath);
      } catch (error) {
        // Ignorer les erreurs de suppression
      }
    }
  }

  if (!extractedText || extractedText.trim().length === 0) {
    return { score: 0, text: '', details: ['Texte non extrait'] };
  }

  const textLower = extractedText.toLowerCase();

  // +2 si mots-clés facture trouvés
  const invoiceKeywords = /\b(invoice|facture|receipt|reçu|bill|total|amount|paid|vat|tva)\b/i;
  if (invoiceKeywords.test(textLower)) {
    score += 2;
    details.push(`+2: Mots-clés facture trouvés dans le texte`);
  }

  // +1 si montant détecté (€/$/£ + chiffres)
  const amountPattern = /[€$£]\s*\d+[\d,.\s]*|\d+[\d,.\s]*\s*[€$£]|\d+[\d,.\s]*\s*(eur|usd|gbp)/i;
  if (amountPattern.test(textLower)) {
    score += 1;
    details.push(`+1: Montant détecté dans le texte`);
  }

  // +1 si date détectée
  const datePattern = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/i;
  if (datePattern.test(textLower)) {
    score += 1;
    details.push(`+1: Date détectée dans le texte`);
  }

  // +1 si identifiant détecté (invoice_number, receipt_number, ch_, rcpt_, INV-)
  const idPattern = /\b(invoice[_\s#-]?number|receipt[_\s#-]?number|ch[_\s#-]|rcpt[_\s#-]|inv[_\s#-])\s*[:\-]?\s*[A-Z0-9\-]+\b/i;
  if (idPattern.test(textLower)) {
    score += 1;
    details.push(`+1: Identifiant facture détecté dans le texte`);
  }

  // −3 si texte contient terms, policy, newsletter
  const exclusionPattern = /\b(terms|policy|newsletter|conditions[_\s]générales|cgv|cgu)\b/i;
  if (exclusionPattern.test(textLower)) {
    score -= 3;
    details.push(`-3: Mots-clés exclusion trouvés dans le texte`);
  }

  return { score, text: extractedText, details };
}

/**
 * FONCTION PRINCIPALE : Détecte si un PDF est une facture
 * 
 * @param pdfBuffer - Buffer du PDF à analyser
 * @param metadata - Métadonnées du PDF (nom, expéditeur, sujet, taille)
 * @returns Résultat de la détection avec scores et raison
 */
export async function detectInvoice(
  pdfBuffer: Buffer,
  metadata: PDFMetadata
): Promise<InvoiceDetectionResult> {
  console.log(`🔍 [DETECTOR] Analyse du PDF: ${metadata.filename || 'sans nom'}`);

  // ÉTAPE 1 : Score métadonnées
  const { score: metadataScore, details: metadataDetails } = calculateMetadataScore(metadata);
  console.log(`📊 [DETECTOR] Score métadonnées: ${metadataScore}`);
  metadataDetails.forEach(detail => console.log(`   ${detail}`));

  // Si score < 2 → ignorer le PDF (seuil très bas pour être très permissif)
  // Score 0-1 = probablement pas une facture (CGU, guides, etc.)
  // Score ≥ 2 = peut être une facture, on analyse le contenu
  // On est très permissif car même les indépendants peuvent envoyer des factures valides
  if (metadataScore < 2) {
    return {
      shouldProcess: false,
      metadataScore,
      contentScore: null,
      totalScore: metadataScore,
      reason: `Score métadonnées trop bas (${metadataScore} < 2). Détails: ${metadataDetails.join('; ')}`,
    };
  }

  // ÉTAPE 2 : Score contenu (extraction texte)
  // Si le score métadonnées est déjà très élevé (≥ 5), on peut accepter directement
  // On accepte plus facilement pour ne pas discriminer les petits expéditeurs
  if (metadataScore >= 5) {
    console.log(`✅ [DETECTOR] PDF accepté (score métadonnées élevé: ${metadataScore} ≥ 5)`);
    return {
      shouldProcess: true,
      metadataScore,
      contentScore: null,
      totalScore: metadataScore,
      reason: `PDF accepté (score métadonnées élevé: ${metadataScore} ≥ 5)`,
    };
  }

  console.log(`📄 [DETECTOR] Score métadonnées OK (${metadataScore}), analyse du contenu...`);
  const { score: contentScore, text, details: contentDetails } = await calculateContentScore(
    pdfBuffer,
    metadata
  );

  console.log(`📊 [DETECTOR] Score contenu: ${contentScore}`);
  contentDetails.forEach(detail => console.log(`   ${detail}`));

  const totalScore = metadataScore + contentScore;

  // Si score contenu < 1 → rejeter (seuil très bas pour être très permissif)
  // Score 0 = probablement pas une facture
  // Score ≥ 1 = peut être une facture, on accepte
  // On est très permissif car même les factures simples d'indépendants peuvent avoir peu de texte
  if (contentScore < 1) {
    return {
      shouldProcess: false,
      metadataScore,
      contentScore,
      totalScore,
      reason: `Score contenu trop bas (${contentScore} < 1). Détails: ${contentDetails.join('; ')}`,
    };
  }

  // Si accepté → continuer le pipeline normal
  return {
    shouldProcess: true,
    metadataScore,
    contentScore,
    totalScore,
    reason: `PDF accepté (métadonnées: ${metadataScore}, contenu: ${contentScore}, total: ${totalScore})`,
  };
}

/**
 * Parcourt récursivement les parties MIME pour trouver tous les PDFs
 * Gère les PDFs inline, octet-stream, etc.
 */
export function findPDFAttachments(parts: any[]): any[] {
  const pdfs: any[] = [];

  function traverse(part: any) {
    if (!part) return;

    // Vérifier si c'est un PDF - DÉTECTION AMÉLIORÉE
    const mimeType = part.mimeType?.toLowerCase() || '';
    const filename = part.filename?.toLowerCase() || '';
    const headers = part.headers || [];
    
    // Chercher le Content-Type dans les headers si mimeType n'est pas défini
    let contentTypeFromHeader = '';
    for (const header of headers) {
      if (header.name?.toLowerCase() === 'content-type') {
        contentTypeFromHeader = header.value?.toLowerCase() || '';
        break;
      }
    }

    // Critères de détection PDF (plus permissifs)
    const isPdf = 
      // MimeType standard
      mimeType === 'application/pdf' ||
      // MimeType avec charset ou autres paramètres
      mimeType.startsWith('application/pdf') ||
      // Content-Type dans les headers
      contentTypeFromHeader.includes('application/pdf') ||
      // Filename se termine par .pdf
      filename.endsWith('.pdf') ||
      // Octet-stream avec filename .pdf
      (mimeType === 'application/octet-stream' && filename.endsWith('.pdf')) ||
      // Binary avec filename .pdf
      (mimeType === 'application/binary' && filename.endsWith('.pdf')) ||
      // Vérifier aussi dans les headers si le Content-Disposition contient .pdf
      (headers.some((h: any) => 
        h.name?.toLowerCase() === 'content-disposition' && 
        h.value?.toLowerCase().includes('.pdf')
      ));

    if (isPdf) {
      pdfs.push(part);
      console.log(`✅ [PDF DETECTOR] PDF trouvé: ${filename || 'sans nom'} (mimeType: ${mimeType || 'N/A'}, contentTypeHeader: ${contentTypeFromHeader || 'N/A'})`);
    }

    // Parcourir récursivement les sous-parties
    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach((subPart: any) => traverse(subPart));
    }
  }

  parts.forEach(part => traverse(part));
  return pdfs;
}

