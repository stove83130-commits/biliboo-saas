import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'


export const dynamic = 'force-dynamic'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun client Stripe associé' }, { status: 400 })
    }

    console.log('🔄 Synchronisation du plan pour:', user.id, 'Customer:', stripeCustomerId)

    // Récupérer l'abonnement actuel depuis Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10
    })

    console.log('📋 Abonnements Stripe trouvés:', subscriptions.data.length)

    // Trouver l'abonnement actif ou en période d'essai
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    )

    if (!activeSubscription) {
      console.log('❌ Aucun abonnement actif trouvé')
      return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 404 })
    }

    console.log('📊 Détails abonnement:', {
      status: activeSubscription.status,
      trial_end: activeSubscription.trial_end,
      trial_start: activeSubscription.trial_start,
      current_period_end: activeSubscription.current_period_end
    })

    // Déterminer le plan basé sur le price_id
    const priceId = activeSubscription.items.data[0]?.price?.id
    let planId: string | null = null
    
    if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
      planId = 'starter'
    } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) {
      planId = 'pro'
    } else if (priceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID) {
      planId = 'business'
    }
    
    // Si on ne peut pas identifier le plan, ne pas assigner de plan par défaut
    if (!planId) {
      console.warn('⚠️ Impossible d\'identifier le plan pour price_id:', priceId)
      return NextResponse.json({ error: 'Plan non identifié dans Stripe' }, { status: 400 })
    }

    console.log('🎯 Plan détecté:', planId, 'Price ID:', priceId)

    // Déterminer si c'est un essai et calculer les jours restants
    const isTrial = activeSubscription.status === 'trialing' && activeSubscription.trial_end
    const trialEndsAt = isTrial ? new Date(activeSubscription.trial_end * 1000).toISOString() : null
    const trialStartedAt = activeSubscription.trial_start ? new Date(activeSubscription.trial_start * 1000).toISOString() : null
    
    console.log('🎯 Informations essai:', {
      isTrial,
      trialEndsAt,
      trialStartedAt,
      daysLeft: isTrial ? Math.ceil((activeSubscription.trial_end * 1000 - Date.now()) / (24*60*60*1000)) : 0
    })

    // Mettre à jour les métadonnées utilisateur
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        selected_plan: planId,
        subscription_status: activeSubscription.status,
        stripe_subscription_id: activeSubscription.id,
        current_period_end: new Date(activeSubscription.current_period_end * 1000).toISOString(),
        // Gestion des essais
        is_trial: isTrial,
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        trial_consumed: !isTrial && activeSubscription.trial_end ? true : false,
        // Réinitialiser les métadonnées d'annulation si l'abonnement est actif
        ...(activeSubscription.status === 'active' && !activeSubscription.cancel_at_period_end ? {
          cancellation_date: null,
          subscription_ends_at: null,
        } : {}),
        // Gérer l'annulation à la fin de période
        ...(activeSubscription.cancel_at_period_end ? {
          subscription_status: 'cancelled',
          subscription_ends_at: new Date(activeSubscription.current_period_end * 1000).toISOString(),
        } : {}),
      }
    })

    if (updateError) {
      console.error('❌ Erreur mise à jour:', updateError)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    console.log('✅ Plan synchronisé avec succès:', planId)

    return NextResponse.json({ 
      success: true, 
      plan: planId,
      subscription_status: activeSubscription.status,
      subscription_id: activeSubscription.id
    })

  } catch (error) {
    console.error('❌ Erreur synchronisation:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
