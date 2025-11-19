import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const dynamic = 'force-dynamic'

// GET : Récupérer les méthodes de paiement
export async function GET() {
  try {
    const supabase = await createClient()
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [] })
    }

    // Récupérer les méthodes de paiement du client
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    })

    // Récupérer le client pour connaître la méthode par défaut
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    const defaultPaymentMethodId = typeof customer === 'object' && !customer.deleted 
      ? customer.invoice_settings?.default_payment_method 
      : null

    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      } : null,
      isDefault: pm.id === defaultPaymentMethodId,
      created: new Date(pm.created * 1000).toISOString(),
    }))

    return NextResponse.json({ 
      paymentMethods: formattedMethods,
      defaultPaymentMethodId 
    })
  } catch (error) {
    console.error('Erreur récupération méthodes de paiement:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des méthodes de paiement' }, { status: 500 })
  }
}

// POST : Créer un setup intent pour ajouter une nouvelle méthode
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun client Stripe associé' }, { status: 400 })
    }

    // Créer un setup intent pour ajouter une nouvelle méthode de paiement
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
    })

    return NextResponse.json({ 
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id
    })
  } catch (error) {
    console.error('Erreur création setup intent:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du setup intent' }, { status: 500 })
  }
}

// DELETE : Supprimer une méthode de paiement
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentMethodId = searchParams.get('id')

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'ID de méthode de paiement requis' }, { status: 400 })
    }

    // Détacher la méthode de paiement du client
    await stripe.paymentMethods.detach(paymentMethodId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur suppression méthode de paiement:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la suppression' }, { status: 500 })
  }
}

// PATCH : Définir une méthode comme défaut
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paymentMethodId } = await request.json()

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'ID de méthode de paiement requis' }, { status: 400 })
    }

    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun client Stripe associé' }, { status: 400 })
    }

    // Mettre à jour la méthode de paiement par défaut du client
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur mise à jour méthode par défaut:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

