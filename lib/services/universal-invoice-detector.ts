// lib/services/universal-invoice-detector.ts (VERSION FINALE)

export class UniversalInvoiceDetector {
  
  /**
   * NIVEAU 1 : Mots-clés dans le sujet (COMPLET)
   */
  static analyzeSubject(subject: string): { hasKeyword: boolean; patterns: string[]; score: number } {
    const patterns: string[] = [];
    let score = 0;
    const subjectLower = subject.toLowerCase();
    
    // Pattern 1 : "facture" ou "invoice"
    if (/\b(?:facture|invoice)\b/i.test(subject)) {
      patterns.push('facture_directe');
      score += 45;
    }
    
    // Pattern 2 : "receipt" ou "reçu" ⭐ RENFORCE pour Apple
    if (/\b(?:receipt|re[çc]u)\b/i.test(subject)) {
      patterns.push('recu');
      score += 45; // Augmenté de 40 à 45
    }
    
    // Pattern 3 : "payment" ou "paiement"
    if (/\b(?:payment|paiement|paid|pay[ée])\b/i.test(subject)) {
      patterns.push('paiement');
      score += 35;
    }
    
    // Pattern 4 : "commande" ou "order"
    if (/\b(?:commande|order)\b/i.test(subject)) {
      patterns.push('commande');
      score += 30;
    }
    
    // Pattern 5 : Mention "Apple", "Google", "Microsoft" ⭐ NOUVEAU
    if (/\b(?:apple|google|microsoft|app store|play store)\b/i.test(subject)) {
      patterns.push('digital_store_mention');
      score += 20;
    }
    
    // Pattern 6 : Numéro dans sujet
    if (/#[A-Z0-9\-]{3,}|[A-Z]{2,}\d{3,}/i.test(subject)) {
      patterns.push('numero_identifiant');
      score += 15;
    }
    
    // Pattern 7 : "thank you" (merci)
    if (/thank you|merci/i.test(subject)) {
      patterns.push('remerciement');
      score += 10;
    }
    
    return {
      hasKeyword: patterns.length > 0,
      patterns,
      score,
    };
  }

  /**
   * NIVEAU 2 : Analyse du contenu (ENRICHI pour HTML sans PDF)
   */
  static analyzeContent(html: string, text: string): { hasIndicators: boolean; indicators: string[]; score: number } {
    const indicators: string[] = [];
    let score = 0;
    const fullContent = `${html} ${text}`.toLowerCase();
    
    // Indicateur 1 : "Ci-joint la facture"
    if (/ci-joint\s+(?:la|le)\s+(?:facture|re[çc]u)/i.test(fullContent)) {
      indicators.push('ci_joint_facture');
      score += 40;
    }
    
    // Indicateur 2 : "invoice is below" / "votre reçu"
    if (/(?:invoice|facture|re[çc]u)\s+(?:is below|est joint|ci-joint)/i.test(fullContent)) {
      indicators.push('facture_jointe');
      score += 35;
    }
    
    // Indicateur 3 : Confirmation de paiement
    const paymentPhrases = [
      'thank you for your payment',
      'merci pour votre paiement',
      'payment received',
      'paiement re[çc]u',
      'subscription renewed',
      'abonnement renouvel[ée]',
      'achat intégré', // ⭐ NOUVEAU (Apple)
      'achat effectué'
    ];
    if (paymentPhrases.some(phrase => new RegExp(phrase, 'i').test(fullContent))) {
      indicators.push('confirmation_paiement');
      score += 30;
    }
    
    // Indicateur 4 : Date de paiement
    if (/(?:date|payment date|paid)\s+(?:de la facture|:)?\s*\d{1,2}\s+\w+\s+\d{4}/i.test(fullContent)) {
      indicators.push('date_paiement');
      score += 20;
    }
    
    // Indicateur 5 : Montant AVEC devise
    if (/[\$€£]\s*\d+[,.]\d{2}|\d+[,.]\d{2}\s*[\$€£]|(?:total|amount|montant)\s*:?\s*\d+[,.]\d{2}\s*[€\$£]/i.test(fullContent)) {
      indicators.push('montant_detecte');
      score += 25;
    }
    
    // Indicateur 6 : TVA détaillée ⭐ NOUVEAU (Apple, factures FR)
    if (/tva\s+(?:à|a)?\s*\d+\s*%|vat\s+\d+%|tax\s+\d+%/i.test(fullContent)) {
      indicators.push('tva_detaillee');
      score += 20;
    }
    
    // Indicateur 7 : Numéro de commande/document ⭐ NOUVEAU
    if (/n°\s+(?:de\s+)?(?:commande|document|séquence)\s*:?\s*[A-Z0-9\-]+/i.test(fullContent)) {
      indicators.push('numero_reference');
      score += 15;
    }
    
    return {
      hasIndicators: indicators.length > 0,
      indicators,
      score,
    };
  }

  /**
   * NIVEAU 3 : Analyse des pièces jointes
   * ⚠️ Maintenant OPTIONNEL (car Apple n'a pas de PDF)
   */
  static analyzeAttachments(attachments: any[]): { hasInvoice: boolean; fileTypes: string[]; score: number } {
    if (!attachments || attachments.length === 0) {
      // Pas de pénalité, juste 0 points
      return { hasInvoice: false, fileTypes: [], score: 0 };
    }
    
    const fileTypes: string[] = [];
    let score = 0;
    
    for (const att of attachments) {
      const filename = (att.filename || '').toLowerCase();
      
      if (/^(?:facture|invoice)/i.test(filename)) {
        fileTypes.push('facture_nom_direct');
        score += 40;
        continue;
      }
      
      if (/receipt|re[çc]u/i.test(filename)) {
        fileTypes.push('recu_nom');
        score += 35;
        continue;
      }
      
      if (/invoice_\d+/i.test(filename)) {
        fileTypes.push('invoice_numero');
        score += 30;
        continue;
      }
      
      if (/^[A-Z0-9]{4,}_/i.test(filename)) {
        fileTypes.push('commande_pattern');
        score += 25;
        continue;
      }
      
      if (filename.endsWith('.pdf')) {
        fileTypes.push('pdf_generique');
        score += 10;
      }
    }
    
    return {
      hasInvoice: fileTypes.length > 0,
      fileTypes,
      score,
    };
  }

  /**
   * DÉTECTION PRINCIPALE (VERSION FINALE)
   */
  static detect(email: {
    from: string;
    subject: string;
    htmlContent?: string;
    textContent?: string;
    attachments?: any[];
  }): {
    is_invoice: boolean;
    confidence: number;
    score: number;
    breakdown: any;
    reasons: string[];
  } {
    const subject = this.analyzeSubject(email.subject);
    const content = this.analyzeContent(email.htmlContent || '', email.textContent || '');
    const attachments = this.analyzeAttachments(email.attachments || []);
    
    const totalScore = subject.score + content.score + attachments.score;
    
    const reasons: string[] = [];
    
    if (subject.hasKeyword) {
      reasons.push(`✅ Sujet : ${subject.patterns.join(', ')} (+${subject.score})`);
    }
    
    if (content.hasIndicators) {
      reasons.push(`✅ Contenu : ${content.indicators.join(', ')} (+${content.score})`);
    }
    
    if (attachments.hasInvoice) {
      reasons.push(`✅ Pièces jointes : ${attachments.fileTypes.join(', ')} (+${attachments.score})`);
    } else if (!attachments.hasInvoice && totalScore >= 60) {
      reasons.push(`ℹ️ Pas de PDF (facture dans HTML)`);
    }
    
    // Décision : seuil à 60 points
    // Score max possible : ~200 points (45+45+35+30+20+15+10 + 40+35+30+25+20+20+15 + 40+35+30+25+10)
    const is_invoice = totalScore >= 60;
    const confidence = Math.min(100, Math.round((totalScore / 200) * 100));
    
    if (!is_invoice) {
      reasons.push(`❌ Score insuffisant : ${totalScore}/200 (seuil: 60)`);
    }
    
    return {
      is_invoice,
      confidence,
      score: totalScore,
      breakdown: { subject, content, attachments },
      reasons,
    };
  }
}

