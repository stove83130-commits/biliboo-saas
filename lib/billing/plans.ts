/**
 * Gestion des plans et limites de facturation
 * Pour le système Bilibou
 */

export interface Plan {
  id: string
  name: string
  price: number
  currency: string
  monthlyInvoiceLimit: number
  pricePerExtraInvoice: number
  features: string[]
  maxEmailAccounts: number
  allowOrganizations: boolean
  maxOrganizations: number
  allowAutoExport: boolean
  supportLevel: 'basic' | 'priority' | 'enterprise'
}

export const PLANS: Record<string, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 23, // Prix annuel
    currency: 'EUR',
    monthlyInvoiceLimit: 100,
    pricePerExtraInvoice: 0.15,
    maxEmailAccounts: 1,
    allowOrganizations: false,
    maxOrganizations: 0,
    allowAutoExport: false,
    supportLevel: 'basic',
    features: [
      '100 factures/mois incluses',
      '1 compte e-mail connecté',
      'Export CSV / PDF / ZIP'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 63, // Prix annuel
    currency: 'EUR',
    monthlyInvoiceLimit: 300,
    pricePerExtraInvoice: 0.15,
    maxEmailAccounts: 3,
    allowOrganizations: true,
    maxOrganizations: 1,
    allowAutoExport: true,
    supportLevel: 'basic',
    features: [
      '300 factures/mois incluses',
      '3 comptes e-mail',
      'Espaces de travail (organisations)',
      'Export CSV / PDF / ZIP'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 159, // Prix annuel
    currency: 'EUR',
    monthlyInvoiceLimit: 1200,
    pricePerExtraInvoice: 0.12,
    maxEmailAccounts: 10,
    allowOrganizations: true,
    maxOrganizations: -1, // Illimité
    allowAutoExport: true,
    supportLevel: 'priority',
    features: [
      '1 200 factures/mois incluses',
      '10 comptes e-mail',
      'Espaces de travail (organisations)',
      'Multi-organisations et utilisateurs illimités',
      'Export CSV / PDF / ZIP'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Entreprise',
    price: 0, // Sur devis
    currency: 'EUR',
    monthlyInvoiceLimit: -1, // Illimité
    pricePerExtraInvoice: 0,
    maxEmailAccounts: -1, // Illimité
    allowOrganizations: true,
    maxOrganizations: -1, // Illimité
    allowAutoExport: true,
    supportLevel: 'enterprise',
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

// Fonctions de vérification des permissions
export function canAddEmailAccount(planId: string | null, currentEmailCount: number): boolean {
  if (!planId) return false
  const plan = getPlan(planId)
  if (!plan) return false
  if (plan.maxEmailAccounts === -1) return true // Illimité
  return currentEmailCount < plan.maxEmailAccounts
}

export function canCreateOrganization(planId: string | null, currentOrgCount: number): boolean {
  if (!planId) return false
  const plan = getPlan(planId)
  if (!plan) return false
  if (!plan.allowOrganizations) return false
  if (plan.maxOrganizations === -1) return true // Illimité
  return currentOrgCount < plan.maxOrganizations
}

export function canUseAutoExport(planId: string | null): boolean {
  if (!planId) return false
  const plan = getPlan(planId)
  if (!plan) return false
  return plan.allowAutoExport
}

export function getMaxInvoices(planId: string | null): number {
  if (!planId) return 0
  const plan = getPlan(planId)
  if (!plan) return 0
  return plan.monthlyInvoiceLimit
}

export function canExtractInvoices(planId: string | null, currentMonthlyCount: number): boolean {
  if (!planId) return false
  const plan = getPlan(planId)
  if (!plan) return false
  if (plan.monthlyInvoiceLimit === -1) return true // Illimité
  return currentMonthlyCount < plan.monthlyInvoiceLimit
}


