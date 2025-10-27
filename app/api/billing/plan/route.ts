import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlan, getMonthlyInvoiceLimit, getPricePerExtraInvoice, hasActivePlan, canAccessDashboard } from '@/lib/billing/plans'


export const dynamic = 'force-dynamic'
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  console.log('🔍 Plan API - Métadonnées utilisateur:', {
    selected_plan: user.user_metadata?.selected_plan,
    subscription_status: user.user_metadata?.subscription_status,
    stripe_subscription_id: user.user_metadata?.stripe_subscription_id,
    user_id: user.id
  })

  const planKey = (user.user_metadata?.selected_plan as string) || 'starter'
  const plan = getPlan(planKey)

  const limit = getMonthlyInvoiceLimit(planKey)
  const priceExtra = getPricePerExtraInvoice(planKey)
  
  // Vérifier si l'utilisateur a un plan actif
  const subscriptionStatus = user.user_metadata?.subscription_status || null
  const isTrial = Boolean(user.user_metadata?.is_trial)
  const trialEndsAt = user.user_metadata?.trial_ends_at ?? null
  const hasActive = hasActivePlan(planKey, subscriptionStatus, isTrial, trialEndsAt)
  
  // Vérifier si l'utilisateur a déjà eu un plan (même expiré/annulé)
  const hasEverHadPlan = Boolean(
    user.user_metadata?.selected_plan || 
    user.user_metadata?.stripe_subscription_id || 
    user.user_metadata?.trial_consumed ||
    user.user_metadata?.subscription_status
  )
  
  // Vérifier si l'utilisateur peut accéder au dashboard
  const canAccess = canAccessDashboard(planKey, subscriptionStatus, isTrial, trialEndsAt, hasEverHadPlan)

  return NextResponse.json({
    planKey,
    plan,
    subscription_status: subscriptionStatus,
    subscription_ends_at: user.user_metadata?.subscription_ends_at || null,
    hasActivePlan: hasActive,
    hasEverHadPlan: hasEverHadPlan,
    canAccessDashboard: canAccess,
    limits: {
      monthlyInvoicesIncluded: limit,
      pricePerExtraInvoiceEur: priceExtra,
      emailAccounts: plan?.emailAccounts ?? 0,
      unlimited: plan?.unlimited ?? false,
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
