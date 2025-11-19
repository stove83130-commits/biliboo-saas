import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun client Stripe associé' }, { status: 400 })
    }

    // Récupérer l'URL de retour depuis les query params ou utiliser la page de facturation par défaut
    const { searchParams } = new URL(request.url)
    const returnUrl = searchParams.get('return_url') || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/settings/billing`

    // Créer une session du Customer Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })

    // Rediriger vers le Customer Portal
    return NextResponse.redirect(portalSession.url)
  } catch (error: any) {
    console.error('Erreur création session Customer Portal:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la création de la session' }, { status: 500 })
  }
}

