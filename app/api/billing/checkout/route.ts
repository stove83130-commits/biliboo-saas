import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  try {
    const { planId, isAnnual, source } = await request.json()
    
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID requis' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Configuration des plans avec essai gratuit de 7 jours (non cumulable)
    const plans = {
      'starter': {
        name: 'Starter',
        priceIdMonthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!,
        priceIdAnnual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID!,
        trialDays: 7,
        features: ['100 factures/mois', '1 compte e-mail', 'Export CSV/PDF/ZIP']
      },
      'pro': {
        name: 'Pro', 
        priceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
        priceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
        trialDays: 7,
        features: ['300 factures/mois', '3 comptes e-mail', 'Organisations', 'Export automatique']
      },
      'business': {
        name: 'Business',
        priceIdMonthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!,
        priceIdAnnual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID!,
        trialDays: 7,
        features: ['1200 factures/mois', '10 comptes e-mail', 'Multi-organisations', 'Utilisateurs illimités']
      },
      'entreprise': {
        name: 'Entreprise',
        priceIdMonthly: null,
        priceIdAnnual: null,
        overagePriceId: null,
        trialDays: 7,
        features: ['Factures illimitées', 'Infrastructure dédiée', 'SLA 99.9%', 'Support 24/7'],
        isCustom: true
      }
    }

    const plan = plans[planId as keyof typeof plans]
    if (!plan) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    // Créer ou récupérer le customer Stripe
    let customerId = user.user_metadata?.stripe_customer_id
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
      
      // Sauvegarder simplement l'ID customer (ne PAS changer de plan ici)
      await supabase.auth.updateUser({
        data: {
          stripe_customer_id: customerId,
        }
      })
    }

    // Pour le plan Entreprise, rediriger vers contact (pas de Stripe)
    if (plan.isCustom) {
      return NextResponse.json({ 
        url: `http://localhost:3001/contact?plan=entreprise&trial=7days` 
      })
    }

    // Déterminer si l'utilisateur a déjà consommé un essai gratuit
    // Vérifier dans Stripe s'il a déjà eu un abonnement avec essai
    let trialAlreadyConsumed = Boolean(
      user.user_metadata?.trial_consumed || user.user_metadata?.trial_started_at
    )

    // Vérification supplémentaire dans Stripe pour les abonnements précédents
    if (!trialAlreadyConsumed) {
      const previousSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10
      })
      
      // Si l'utilisateur a déjà eu un abonnement avec trial_end, il a utilisé son essai
      trialAlreadyConsumed = previousSubscriptions.data.some(sub => 
        sub.trial_end && (sub.status === 'active' || sub.status === 'canceled' || sub.status === 'past_due')
      )
    }

    console.log('🎯 Logique essai:', {
      trialAlreadyConsumed,
      trial_consumed: user.user_metadata?.trial_consumed,
      trial_started_at: user.user_metadata?.trial_started_at,
      planId
    })

    // Calcul du nombre de jours d'essai à accorder (0 si déjà consommé)
    const trialDaysToGrant = trialAlreadyConsumed ? 0 : (plan.trialDays || 0)

    // Créer la session de checkout avec essai gratuit si disponible
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: isAnnual ? plan.priceIdAnnual : plan.priceIdMonthly,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        ...(trialDaysToGrant > 0 ? { trial_period_days: trialDaysToGrant } : {}),
        metadata: {
          plan_id: planId,
          supabase_user_id: user.id,
        },
      },
      success_url: `http://localhost:3001/dashboard?success=true`,
      cancel_url: source === 'upgrade' 
        ? `http://localhost:3001/dashboard` 
        : `http://localhost:3001/onboarding?preview=1`,
      metadata: {
        plan_id: planId,
        supabase_user_id: user.id,
        source: source || 'onboarding',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Erreur checkout Stripe:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
