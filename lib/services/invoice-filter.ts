/**
 * 🎯 SYSTÈME DE FILTRAGE INTELLIGENT DES FACTURES
 * 
 * Objectifs :
 * 1. Réduire les appels GPT (coûts)
 * 2. Améliorer la précision (scoring)
 * 3. Filtrer strictement à la source (Gmail API)
 * 
 * Système de scoring :
 * - 40 pts : Numéro de facture détecté
 * - 35 pts : Confirmation de paiement
 * - 30 pts : Montant avec TVA
 * - 25 pts : Mot-clé facture dans contexte positif
 * 
 * Score >= 90 : Facture évidente (pas de GPT)
 * Score 50-90 : Validation GPT nécessaire
 * Score < 50 : Rejet automatique
 */

import { EmailFilterConfig, ScoringResult, ScoringFlags } from '@/lib/types/invoice-filter';

export class IntelligentInvoiceFilter {
  /**
   * Construit une query Gmail API INTELLIGENTE
   * Mots-clés facture OBLIGATOIRES (pièce jointe optionnelle)
   */
  static buildStrictGmailQuery(config?: EmailFilterConfig): string {
    const queryParts: string[] = [];

    // 1. Mots-clés facture (ÉLARGI pour capturer plus de reçus)
    const invoiceKeywords = [
      'facture', 'invoice', 'reçu', 'receipt', 
      'quittance', 'bill', 'paid', 'payé',
      'paiement', 'payment', 'order', 'commande',
      'subscription', 'abonnement', 'billing', 'facturation',
      'transaction', 'purchase', 'achat', 'charge', 'débit',
      'confirmation', 'confirme', 'successful', 'réussi'
    ];
    
    const keywordQuery = invoiceKeywords
      .map(kw => `"${kw}"`)
      .join(' OR ');
    
    // 2. Services SaaS connus (Cursor, Replit, etc.) - même sans mots-clés
    // Ces services envoient souvent des reçus sans format standard
    const saasServiceDomains = [
      'cursor.com', 'replit.com', 'stripe.com', 'github.com',
      'vercel.com', 'notion.so', 'slack.com', 'zoom.us', 'figma.com',
      'canva.com', 'adobe.com', 'linear.app', 'anthropic.com',
    ];
    
    const saasQuery = saasServiceDomains
      .map(domain => `from:${domain}`)
      .join(' OR ');
    
    // 3. Combiner : (mots-clés) OU (services SaaS)
    queryParts.push(`(${keywordQuery} OR ${saasQuery})`);

    // 4. Date range
    if (config?.dateRange) {
      queryParts.push(`after:${config.dateRange.after}`);
      queryParts.push(`before:${config.dateRange.before}`);
    }

    // NOTE: Pièce jointe NON obligatoire car beaucoup de factures sont en HTML
    // Le scoring intelligent va filtrer les emails non pertinents

    return queryParts.join(' ');
  }

  /**
   * Calcule la probabilité qu'un email contienne une facture
   * Système de scoring sur 100 points
   */
  static calculateInvoiceProbability(emailData: {
    subject: string;
    from: string;
    snippet: string;
    body?: string;
  }): ScoringResult {
    let score = 0;
    const flags: ScoringFlags = {
      has_invoice_number: false,
      has_payment_confirmation: false,
      has_amount_with_tax: false,
      has_invoice_keyword: false,
      has_exclusion_keyword: false,
      is_from_trusted_sender: false,
    };

    const subject = (emailData.subject || '').toLowerCase();
    const snippet = (emailData.snippet || '').toLowerCase();
    const body = (emailData.body || '').toLowerCase();
    const fullText = `${subject} ${snippet} ${body}`;

    // 1. Numéro de facture (+40 points) - LE PLUS IMPORTANT
    const invoiceNumberPatterns = [
      /facture[:\s#]*[A-Z0-9\-]{3,}/i,
      /invoice[:\s#]*[A-Z0-9\-]{3,}/i,
      /n°[:\s]*[A-Z0-9\-]{3,}/i,
      /num[ée]ro[:\s]*[A-Z0-9\-]{3,}/i,
      /ref[:\s]*[A-Z0-9\-]{5,}/i,
    ];

    if (invoiceNumberPatterns.some(pattern => pattern.test(fullText))) {
      score += 40;
      flags.has_invoice_number = true;
    }

    // 2. Confirmation de paiement (+35 points)
    const paymentKeywords = [
      'paid', 'payé', 'paiement effectué',
      'payment received', 'paiement reçu',
      'payment confirmation', 'confirmation de paiement',
      'payment successful', 'paiement réussi',
      'transaction completed', 'transaction effectuée',
      'débité', 'charged', 'prélevé'
    ];

    if (paymentKeywords.some(kw => fullText.includes(kw))) {
      score += 35;
      flags.has_payment_confirmation = true;
    }

    // 3. Montant avec TVA (+30 points)
    const taxPatterns = [
      /tva[:\s]*\d+/i,
      /vat[:\s]*\d+/i,
      /tax[:\s]*\d+/i,
      /h\.?t\.?[:\s]*[\d,\.]+\s*€/i,
      /t\.?t\.?c\.?[:\s]*[\d,\.]+\s*€/i,
      /total\s+ttc/i,
      /montant\s+ttc/i,
      /total\s+ht/i,
      /hors\s+taxe/i,
      /toutes\s+taxes/i,
    ];

    if (taxPatterns.some(pattern => pattern.test(fullText))) {
      score += 30;
      flags.has_amount_with_tax = true;
    }

    // 4. Mot-clé "facture" ou "invoice" (+25 points)
    const invoiceKeywords = [
      'facture', 'invoice', 'reçu', 'receipt', 
      'quittance', 'bill', 'relevé de facturation'
    ];
    
    for (const keyword of invoiceKeywords) {
      if (fullText.includes(keyword)) {
        // Vérifie contexte négatif
        const negativeContexts = [
          `demande de ${keyword}`,
          `demander ${keyword}`,
          `prochaine ${keyword}`,
          `future ${keyword}`,
          `sans ${keyword}`,
        ];
        
        const isNegativeContext = negativeContexts.some(ctx => 
          fullText.includes(ctx)
        );
        
        if (!isNegativeContext) {
          score += 25;
          flags.has_invoice_keyword = true;
          break;
        }
      }
    }

    // Bonus : Détection de montant simple (sans TVA) - AMÉLIORÉ
    const amountPatterns = [
      /\d+[,.]?\d*\s*(€|EUR|USD|\$|£|GBP|CHF|CAD|AUD)/i, // Devises
      /(total|montant|amount|price|prix|cost|coût|paid|payé)[:\s]*\d+[,.]?\d*/i, // "Total: 20" ou "Paid: 20.99"
      /\$\s*\d+[,.]?\d*/, // $20 ou $20.99
      /\d+[,.]?\d*\s*€/, // 20,99 €
      /€\s*\d+[,.]?\d*/, // € 20,99
    ];
    
    if (amountPatterns.some(pattern => pattern.test(fullText)) && !flags.has_amount_with_tax) {
      score += 20; // +20 points (augmenté de 15 à 20) pour un montant simple
    }
    
    // Bonus supplémentaire : Email de service SaaS connu (Cursor, Replit, etc.)
    // Ces services envoient souvent des reçus sans mot-clé "facture" explicite
    const saasServicePatterns = [
      /cursor/i, /replit/i, /stripe/i, /github/i, /vercel/i,
      /notion/i, /slack/i, /zoom/i, /figma/i, /canva/i,
      /adobe/i, /microsoft/i, /google/i, /apple/i,
      /linear/i, /anthropic/i,
    ];
    
    const isSaaSService = saasServicePatterns.some(pattern => pattern.test(fullText));
    
    if (isSaaSService) {
      // Service SaaS connu : +15 points (même sans montant)
      // +10 points supplémentaires si montant détecté
      score += 15;
      if (amountPatterns.some(p => p.test(fullText))) {
        score += 10; // +10 points bonus supplémentaire pour service SaaS avec montant
      }
    }

    // Score final (max 145, normalisé à 100)
    score = Math.min(100, score);

    // Seuil abaissé à 35 au lieu de 50 pour ne pas rater les factures HTML simples
    const isLikelyInvoice = score >= 35;
    
    let rejectionReason: string | undefined;
    if (!isLikelyInvoice) {
      rejectionReason = `Score trop faible (${score}/100) - Ne ressemble pas à une facture`;
    }

    return {
      score,
      flags,
      isLikelyInvoice,
      confidence: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW',
      rejectionReason,
    };
  }

  /**
   * Facture évidente (pas besoin de GPT-4)
   * Score >= 90 + numéro de facture + (paiement OU TVA)
   */
  static isObviousInvoice(scoringResult: ScoringResult): boolean {
    return (
      scoringResult.score >= 90 &&
      scoringResult.flags.has_invoice_number &&
      (
        scoringResult.flags.has_payment_confirmation ||
        scoringResult.flags.has_amount_with_tax
      )
    );
  }

  /**
   * Nécessite validation GPT-4o-mini
   * Score entre 35 et 90 OU score >= 90 mais pas évident
   */
  static needsGPT4Validation(scoringResult: ScoringResult): boolean {
    return (
      (scoringResult.score >= 35 && scoringResult.score < 90) ||
      (scoringResult.score >= 90 && !this.isObviousInvoice(scoringResult))
    );
  }
}

