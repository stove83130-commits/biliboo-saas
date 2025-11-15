import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer le plan de l'utilisateur
    const planId = user.user_metadata?.selected_plan as string | null
    
    // Déterminer la période d'abonnement réelle (pas juste le mois calendaire)
    const now = new Date()
    const currentPeriodStart = user.user_metadata?.current_period_start || null
    const currentPeriodEnd = user.user_metadata?.current_period_end || null
    const trialStartAt = user.user_metadata?.trial_started_at || null
    const trialEndsAt = user.user_metadata?.trial_ends_at || null
    
    // Utiliser la période d'abonnement si disponible, sinon le mois en cours
    let periodStart: Date
    let periodEnd: Date
    
    if (currentPeriodStart && currentPeriodEnd) {
      // Période d'abonnement Stripe (utiliser les dates exactes)
      periodStart = new Date(currentPeriodStart)
      periodEnd = new Date(currentPeriodEnd)
    } else if (trialStartAt && trialEndsAt) {
      // Période d'essai (utiliser les dates exactes)
      periodStart = new Date(trialStartAt)
      periodEnd = new Date(trialEndsAt)
    } else if (currentPeriodEnd) {
      // Seulement la fin de période disponible, estimer le début (1 mois avant)
      periodEnd = new Date(currentPeriodEnd)
      periodStart = new Date(periodEnd)
      periodStart.setMonth(periodStart.getMonth() - 1)
      periodStart.setHours(0, 0, 0, 0)
    } else if (trialEndsAt) {
      // Seulement la fin d'essai disponible, estimer le début (14 jours avant)
      periodEnd = new Date(trialEndsAt)
      periodStart = new Date(periodEnd)
      periodStart.setDate(periodStart.getDate() - 14)
      periodStart.setHours(0, 0, 0, 0)
    } else {
      // Fallback: mois calendaire en cours
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    }

    // Compter les factures extraites dans la période d'abonnement (basé sur created_at)
    const { count: invoicesCount, error: invoicesError } = await supabaseService
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())

    if (invoicesError) {
      console.error('❌ Erreur comptage factures:', invoicesError)
    }

    // Compter les comptes email actifs
    const { count: emailAccountsCount, error: emailAccountsError } = await supabaseService
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (emailAccountsError) {
      console.error('❌ Erreur comptage comptes email:', emailAccountsError)
    }

    // Récupérer les limites du plan
    const { getPlan, getMonthlyInvoiceLimit } = await import('@/lib/billing/plans')
    const plan = planId ? getPlan(planId) : null
    const monthlyInvoiceLimit = planId ? getMonthlyInvoiceLimit(planId) : 0

    // Calculer le pourcentage d'utilisation
    const invoicesUsed = invoicesCount || 0
    const invoicesLimit = monthlyInvoiceLimit === -1 ? null : monthlyInvoiceLimit
    const invoicesPercentage = invoicesLimit 
      ? Math.min(100, Math.round((invoicesUsed / invoicesLimit) * 100))
      : 0

    // Calculer les factures restantes
    const invoicesRemaining = invoicesLimit 
      ? Math.max(0, invoicesLimit - invoicesUsed)
      : null

    // Compter les organisations (seulement les workspaces de type 'organization', pas 'personal')
    const { count: organizationsCount, error: organizationsError } = await supabaseService
      .from('workspaces')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('type', 'organization')

    if (organizationsError) {
      console.error('❌ Erreur comptage organisations:', organizationsError)
    }

    return NextResponse.json({
      invoices: {
        used: invoicesUsed,
        limit: invoicesLimit,
        remaining: invoicesRemaining,
        percentage: invoicesPercentage,
        unlimited: monthlyInvoiceLimit === -1
      },
      emailAccounts: {
        used: emailAccountsCount || 0,
        limit: plan?.maxEmailAccounts ?? 0,
        remaining: plan?.maxEmailAccounts 
          ? Math.max(0, (plan.maxEmailAccounts === -1 ? null : plan.maxEmailAccounts) - (emailAccountsCount || 0))
          : null,
        unlimited: plan?.maxEmailAccounts === -1
      },
      organizations: {
        used: organizationsCount || 0,
        limit: plan?.maxOrganizations ?? 0,
        remaining: plan?.maxOrganizations
          ? Math.max(0, (plan.maxOrganizations === -1 ? null : plan.maxOrganizations) - (organizationsCount || 0))
          : null,
        unlimited: plan?.maxOrganizations === -1
      },
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        month: periodStart.getMonth() + 1,
        year: periodStart.getFullYear()
      },
      plan: plan ? {
        id: plan.id,
        name: plan.name
      } : null
    })
  } catch (error: any) {
    console.error('❌ Erreur récupération usage:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur', details: error.message },
      { status: 500 }
    )
  }
}

