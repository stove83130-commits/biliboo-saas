/**
 * Types pour le système de filtrage intelligent des factures
 */

export interface EmailFilterConfig {
  dateRange?: {
    after: string;  // Format: YYYY/MM/DD
    before: string; // Format: YYYY/MM/DD
  };
}

export interface ScoringFlags {
  has_invoice_number: boolean;
  has_payment_confirmation: boolean;
  has_amount_with_tax: boolean;
  has_invoice_keyword: boolean;
  has_exclusion_keyword: boolean;
  is_from_trusted_sender: boolean;
}

export interface ScoringResult {
  score: number; // 0-100
  flags: ScoringFlags;
  isLikelyInvoice: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rejectionReason?: string;
}


