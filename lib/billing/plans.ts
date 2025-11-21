/**
 * Version simplifiée - Pas de limites pour l'extraction
 * Le système d'extraction fonctionne sans restrictions
 */

export function canExtractInvoices(planId: string | null, currentMonthlyCount: number): boolean {
  // Pas de limites - toujours autorisé
  return true
}

export function getMonthlyInvoiceLimit(planId: string | null): number {
  // Pas de limites - retourner -1 pour illimité
  return -1
}
