import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  try {
    // Vérifier que la clé Stripe est configurée
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY manquante')
      return NextResponse.json({ error: 'Configuration Stripe manquante' }, { status: 500 })
    }

    const { planId, isAnnual, source } = await request.json()
    
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID requis' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ Erreur authentification:', authError)
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    console.log('✅ Utilisateur authentifié:', user.id, 'Plan demandé:', planId)

    // Configuration des plans avec essai gratuit de 7 jours (non cumulable)
    const plans = {
      'starter': {
        name: 'Starter',
        priceIdMonthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '',
        priceIdAnnual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || '',
        trialDays: 7,
        features: ['100 factures/mois', '1 compte e-mail', 'Export CSV/PDF/ZIP']
      },
      'pro': {
        name: 'Pro', 
        priceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
        priceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '',
        trialDays: 7,
        features: ['300 factures/mois', '3 comptes e-mail', 'Organisations', 'Export automatique']
      },
      'business': {
        name: 'Business',
        priceIdMonthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '',
        priceIdAnnual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID || '',
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
      console.error('❌ Plan invalide:', planId)
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    // Vérifier que les Price ID sont configurés
    const priceId = isAnnual ? plan.priceIdAnnual : plan.priceIdMonthly
    if (!priceId || priceId.trim() === '') {
      const missingVarName = isAnnual 
        ? `STRIPE_${planId.toUpperCase()}_ANNUAL_PRICE_ID`
        : `STRIPE_${planId.toUpperCase()}_MONTHLY_PRICE_ID`
      
      console.error('❌ Price ID manquant:', {
        planId,
        planName: plan.name,
        isAnnual,
        missingVarName,
        value: priceId,
        allEnvVars: {
          STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✅ Configurée' : '❌ Manquante',
          STRIPE_STARTER_MONTHLY_PRICE_ID: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ? '✅ Configurée' : '❌ Manquante',
          STRIPE_PRO_MONTHLY_PRICE_ID: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ? '✅ Configurée' : '❌ Manquante',
          STRIPE_BUSINESS_MONTHLY_PRICE_ID: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID ? '✅ Configurée' : '❌ Manquante',
        }
      })
      
      return NextResponse.json({ 
        error: `Configuration Stripe incomplète : La variable d'environnement "${missingVarName}" n'est pas configurée. Veuillez ajouter cette variable dans Vercel (Settings > Environment Variables).`,
        missingVariable: missingVarName,
        plan: plan.name,
        period: isAnnual ? 'annuel' : 'mensuel'
      }, { status: 500 })
    }

    console.log('✅ Plan configuré:', plan.name, 'Price ID:', priceId)

    // Créer ou récupérer le customer Stripe
    let customerId = user.user_metadata?.stripe_customer_id
    
    try {
      if (!customerId) {
        console.log('📝 Création nouveau customer Stripe pour:', user.email)
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            supabase_user_id: user.id,
          },
        })
        customerId = customer.id
        console.log('✅ Customer créé:', customerId)
        
        // Sauvegarder simplement l'ID customer (ne PAS changer de plan ici)
        await supabase.auth.updateUser({
          data: {
            stripe_customer_id: customerId,
          }
        })
      } else {
        console.log('📝 Customer existant:', customerId)
        // Mettre à jour le customer existant pour s'assurer qu'il a les bonnes métadonnées
        await stripe.customers.update(customerId, {
          metadata: {
            supabase_user_id: user.id,
          }
        })
      }
    } catch (customerError: any) {
      console.error('❌ Erreur création/mise à jour customer:', customerError.message)
      return NextResponse.json({ 
        error: `Erreur lors de la gestion du customer Stripe: ${customerError.message}` 
      }, { status: 500 })
    }

    // Pour le plan Entreprise, rediriger vers contact (pas de Stripe)
    if (plan.isCustom) {
      const origin = request.headers.get('origin') || request.nextUrl.origin
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin
      return NextResponse.json({ 
        url: `${baseUrl}/contact?plan=entreprise&trial=7days` 
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

    // Vérifier si l'utilisateur a déjà complété l'onboarding
    const hasCompletedOnboarding = user.user_metadata?.onboarding_completed === true

    // Obtenir l'URL de base (production ou local)
    const origin = request.headers.get('origin') || request.nextUrl.origin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin

    // Déterminer l'URL de retour en cas d'annulation
    // Si l'utilisateur a complété l'onboarding, retourner au dashboard ou à la page d'accueil selon la source
    // Sinon, retourner à l'onboarding
    let cancelUrl: string
    if (hasCompletedOnboarding) {
      // Utilisateur expérimenté : retourner au dashboard ou à la page d'accueil selon d'où il vient
      if (source === 'homepage') {
        cancelUrl = `${baseUrl}/`
      } else {
        cancelUrl = `${baseUrl}/dashboard`
      }
    } else {
      // Nouvel utilisateur : retourner à l'onboarding
      cancelUrl = `${baseUrl}/onboarding?preview=1`
    }

    // Créer la session de checkout avec essai gratuit si disponible
    console.log('🎯 Création session checkout:', {
      customerId,
      priceId,
      planId,
      isAnnual,
      trialDaysToGrant,
      baseUrl
    })

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true, // Permet aux clients d'utiliser des codes promo
        subscription_data: {
          ...(trialDaysToGrant > 0 ? { trial_period_days: trialDaysToGrant } : {}),
          metadata: {
            plan_id: planId,
            supabase_user_id: user.id,
          },
        },
        success_url: `${baseUrl}/dashboard?success=true&payment=success&sync=true`,
        cancel_url: cancelUrl,
        metadata: {
          plan_id: planId,
          supabase_user_id: user.id,
          source: source || 'onboarding',
        },
      })

      console.log('✅ Session checkout créée:', session.id, 'URL:', session.url)
      return NextResponse.json({ url: session.url })
    } catch (sessionError: any) {
      console.error('❌ Erreur création session checkout:', {
        message: sessionError.message,
        type: sessionError.type,
        code: sessionError.code,
        statusCode: sessionError.statusCode
      })
      
      // Retourner un message d'erreur plus détaillé
      return NextResponse.json({ 
        error: `Erreur lors de la création de la session de paiement: ${sessionError.message || 'Erreur inconnue'}`,
        details: sessionError.type || 'unknown'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('❌ Erreur checkout Stripe (catch général):', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    return NextResponse.json({ 
      error: error?.message || 'Erreur interne lors de la création de la session de paiement',
      details: 'checkout_error'
    }, { status: 500 })
  }
}
