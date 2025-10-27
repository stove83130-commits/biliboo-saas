/**
 * Gestion des plans et limites de facturation
 * Pour le système Biliboo
 */

export interface Plan {
  id: string
  name: string
  price: number
  currency: string
  monthlyInvoiceLimit: number
  pricePerExtraInvoice: number
  features: string[]
}

export const PLANS: Record<string, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 23, // Prix annuel
    currency: 'EUR',
    monthlyInvoiceLimit: 100,
    pricePerExtraInvoice: 0.15,
    features: [
      '100 factures/mois incluses',
      '1 compte e-mail connecté',
      'Extraction complète des données',
      'Export CSV / PDF / ZIP',
      '0,15 €/facture supplémentaire'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 63, // Prix annuel
    currency: 'EUR',
    monthlyInvoiceLimit: 300,
    pricePerExtraInvoice: 0.15,
    features: [
      '300 factures/mois incluses',
      '3 comptes e-mail',
      'Espaces de travail (organisations)',
      'Export automatique vers Google Drive ou votre comptable',
      'Export CSV / PDF / ZIP',
      '0,15 €/facture supplémentaire'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 159, // Prix annuel
    currency: 'EUR',
    monthlyInvoiceLimit: 1200,
    pricePerExtraInvoice: 0.12,
    features: [
      '1 200 factures/mois incluses',
      '10 comptes e-mail',
      'Espaces de travail (organisations)',
      'Multi-organisations et utilisateurs illimités',
      'Export CSV / PDF / ZIP',
      '0,12 €/facture supplémentaire'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Entreprise',
    price: 0, // Sur devis
    currency: 'EUR',
    monthlyInvoiceLimit: -1, // Illimité
    pricePerExtraInvoice: 0,
    features: [
      'Factures illimitées',
      'Infrastructure dédiée',
      'SLA 99,9 %',
      'Support 24/7',
      'Développements sur mesure'
    ]
  }
}

export function getPlan(planId: string): Plan | null {
  return PLANS[planId] || null
}

export function getMonthlyInvoiceLimit(planId: string): number {
  const plan = getPlan(planId)
  return plan ? plan.monthlyInvoiceLimit : 0
}

export function getPricePerExtraInvoice(planId: string): number {
  const plan = getPlan(planId)
  return plan ? plan.pricePerExtraInvoice : 1.0
}

export function hasActivePlan(planId: string): boolean {
  return planId in PLANS && planId !== 'free'
}

export function canAccessDashboard(planId: string): boolean {
  return hasActivePlan(planId) || planId === 'free'
}

export function getPlanFeatures(planId: string): string[] {
  const plan = getPlan(planId)
  return plan ? plan.features : []
}

export function isUnlimitedPlan(planId: string): boolean {
  const plan = getPlan(planId)
  return plan ? plan.monthlyInvoiceLimit === -1 : false
}

export function calculateExtraCost(planId: string, extraInvoices: number): number {
  if (isUnlimitedPlan(planId)) return 0
  const pricePerExtra = getPricePerExtraInvoice(planId)
  return extraInvoices * pricePerExtra
}


