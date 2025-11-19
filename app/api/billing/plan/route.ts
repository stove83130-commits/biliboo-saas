import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlan, getMonthlyInvoiceLimit, getPricePerExtraInvoice, hasActivePlan, canAccessDashboard } from '@/lib/billing/plans'


export const dynamic = 'force-dynamic'
export async function GET() {
  const supabase = createClient()
  // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token en production
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  const user = session?.user || null
  
  // Si pas d'utilisateur, retourner des valeurs par défaut au lieu d'une erreur 401
  // (cette API peut être appelée même pour les utilisateurs non connectés)
  if (!user) {
    return NextResponse.json({
      planKey: null,
      plan: null,
      subscription_status: null,
      subscription_ends_at: null,
      hasActivePlan: false,
      hasEverHadPlan: false,
      canAccessDashboard: false,
      limits: {
        monthlyInvoicesIncluded: 0,
        pricePerExtraInvoiceEur: 0,
        emailAccounts: 0,
        unlimited: false,
      },
      usage: {},
      allowOverage: false,
      trial: {
        startedAt: null,
        endsAt: null,
        isTrial: false,
        consumed: false,
        daysLeft: 0,
      },
    })
  }

  // Log uniquement en mode développement pour éviter trop de logs en production
  if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Plan API - Métadonnées utilisateur:', {
    selected_plan: user.user_metadata?.selected_plan,
    subscription_status: user.user_metadata?.subscription_status,
    stripe_subscription_id: user.user_metadata?.stripe_subscription_id,
    user_id: user.id
  })
  }

  // Ne pas assigner de plan par défaut - l'utilisateur doit choisir un plan
  const planKey = (user.user_metadata?.selected_plan as string) || null
  const plan = planKey ? getPlan(planKey) : null

  const limit = planKey ? getMonthlyInvoiceLimit(planKey) : 0
  const priceExtra = planKey ? getPricePerExtraInvoice(planKey) : 0
  
  // Vérifier si l'utilisateur a un plan actif
  const subscriptionStatus = user.user_metadata?.subscription_status || null
  const isTrial = Boolean(user.user_metadata?.is_trial)
  const trialEndsAt = user.user_metadata?.trial_ends_at ?? null
  
  // Vérifier si le plan existe ET si l'abonnement Stripe est actif
  const planExists = planKey ? hasActivePlan(planKey) : false
  const subscriptionIsActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
  const trialIsActive = isTrial && trialEndsAt && new Date(trialEndsAt) > new Date()
  
  // L'utilisateur a un plan actif si : le plan existe ET (abonnement actif OU essai actif)
  const hasActive = planExists && (subscriptionIsActive || trialIsActive)
  
  // Log uniquement en mode développement pour éviter trop de logs en production
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Vérification plan actif:', {
      planKey,
      planExists,
      subscriptionStatus,
      subscriptionIsActive,
      isTrial,
      trialEndsAt,
      trialIsActive,
      hasActive
    })
  }
  
  // Vérifier si l'utilisateur a déjà eu un plan (même expiré/annulé)
  const hasEverHadPlan = Boolean(
    user.user_metadata?.selected_plan || 
    user.user_metadata?.stripe_subscription_id || 
    user.user_metadata?.trial_consumed ||
    user.user_metadata?.subscription_status
  )
  
  // Vérifier si l'utilisateur peut accéder au dashboard (permettre l'accès même sans plan pour voir la page de sélection)
  const canAccess = planKey ? canAccessDashboard(planKey) : true

  return NextResponse.json({
    planKey: planKey || null,
    plan,
    subscription_status: subscriptionStatus,
    subscription_ends_at: user.user_metadata?.subscription_ends_at || null,
    hasActivePlan: hasActive,
    hasEverHadPlan: hasEverHadPlan,
    canAccessDashboard: canAccess,
    limits: {
      monthlyInvoicesIncluded: limit,
      pricePerExtraInvoiceEur: priceExtra,
      emailAccounts: plan?.maxEmailAccounts ?? 0,
      unlimited: plan?.monthlyInvoiceLimit === -1 || false,
    },
    usage: user.user_metadata?.usage || {},
    allowOverage: Boolean(user.user_metadata?.allow_overage),
    trial: {
      startedAt: user.user_metadata?.trial_started_at ?? null,
      endsAt: trialEndsAt,
      isTrial: isTrial,
      consumed: Boolean(user.user_metadata?.trial_consumed),
      daysLeft: (() => {
        const end = trialEndsAt
        if (!end) return 0
        const diff = Math.ceil((new Date(end).getTime() - Date.now()) / (24*60*60*1000))
        return Math.max(0, diff)
      })()
    },
  })
}
