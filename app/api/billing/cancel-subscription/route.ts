import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'


export const dynamic = 'force-dynamic'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null
    
    if (authError || !user) {
      console.error('Erreur d\'authentification:', authError)
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    console.log('Utilisateur authentifié:', user.id)
    console.log('Métadonnées utilisateur:', user.user_metadata)

    const { reasons, otherReason } = await request.json()
    console.log('Données reçues:', { reasons, otherReason })

    // Vérifier si l'abonnement est déjà annulé
    if (user.user_metadata?.subscription_status === 'cancelled') {
      console.log('Abonnement déjà annulé → 409')
      return NextResponse.json({ 
        error: 'Abonnement déjà annulé',
        subscription: {
          id: 'already_cancelled',
          ends_at: user.user_metadata.subscription_ends_at ? 
            Math.floor(new Date(user.user_metadata.subscription_ends_at).getTime() / 1000) : 
            Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 jours par défaut
        }
      }, { status: 409 })
    }

    // Récupérer l'ID de l'abonnement Stripe
    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    const isTrial = Boolean(user.user_metadata?.is_trial)
    console.log('Stripe Customer ID:', stripeCustomerId)
    console.log('En essai:', isTrial)
    
    // Si l'utilisateur est en essai gratuit sans abonnement Stripe, gérer l'annulation localement
    if (!stripeCustomerId && isTrial) {
      console.log('Annulation d\'un essai gratuit sans abonnement Stripe')
      
      // Mettre à jour les métadonnées utilisateur pour marquer l'essai comme annulé
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          subscription_status: 'cancelled',
          cancellation_date: new Date().toISOString(),
          subscription_ends_at: user.user_metadata?.trial_ends_at || new Date().toISOString(),
          is_trial: false,
          trial_consumed: true
        }
      })

      if (updateError) {
        console.error('Erreur lors de la mise à jour des métadonnées:', updateError)
        return NextResponse.json({ error: 'Erreur lors de l\'annulation de l\'essai' }, { status: 500 })
      }

      console.log('Essai gratuit annulé avec succès')
      return NextResponse.json({ 
        success: true,
        subscription: {
          id: 'trial_cancelled',
          ends_at: Math.floor(new Date(user.user_metadata?.trial_ends_at || new Date()).getTime() / 1000)
        }
      })
    }
    
    if (!stripeCustomerId) {
      console.error('Aucun stripe_customer_id trouvé dans les métadonnées')
      return NextResponse.json({ 
        error: 'Aucun abonnement trouvé. Veuillez vous assurer d\'avoir un abonnement actif.',
        details: 'stripe_customer_id manquant'
      }, { status: 400 })
    }

    // Récupérer les abonnements du client (tous statuts) puis cibler le courant
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10
    })

    const candidate = subscriptions.data.find((s) =>
      ['trialing','active','past_due','unpaid'].includes(s.status as string)
    )

    if (!candidate) {
      console.error('Aucun abonnement éligible trouvé pour le client:', stripeCustomerId)
      return NextResponse.json({ 
        error: 'Aucun abonnement en cours trouvé. Vérifiez votre abonnement Stripe.',
        details: 'subscription not found'
      }, { status: 400 })
    }

    // Annuler à la fin de la période de facturation (comportement attendu)
    const cancelledSubscription = await stripe.subscriptions.update(candidate.id, {
      cancel_at_period_end: true,
      metadata: {
        cancellation_reasons: JSON.stringify(reasons),
        other_reason: otherReason || '',
        cancelled_at: new Date().toISOString()
      }
    })

    // Mettre à jour les métadonnées utilisateur
    const cancellationDate = new Date().toISOString()
    const subscriptionEndsAt = new Date(cancelledSubscription.current_period_end * 1000).toISOString()
    
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        subscription_status: 'cancelled',
        cancellation_date: cancellationDate,
        subscription_ends_at: subscriptionEndsAt
      }
    })

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour des métadonnées:', updateError)
      // On continue quand même car l'annulation Stripe a réussi
    } else {
      console.log('✅ Métadonnées Supabase mises à jour avec succès')
    }

    console.log('✅ Annulation Stripe réussie - Détails:', {
      subscription_id: cancelledSubscription.id,
      customer_id: stripeCustomerId,
      cancel_at_period_end: cancelledSubscription.cancel_at_period_end,
      current_period_end: new Date(cancelledSubscription.current_period_end * 1000).toISOString(),
      status: cancelledSubscription.status,
      user_id: user.id,
      user_email: user.email,
      supabase_update: updateError ? 'FAILED' : 'SUCCESS',
      cancellation_date: cancellationDate,
      subscription_ends_at: subscriptionEndsAt
    })

    return NextResponse.json({ 
      success: true,
      subscription: {
        id: cancelledSubscription.id,
        ends_at: cancelledSubscription.current_period_end
      }
    })

  } catch (error) {
    console.error('Erreur lors de l\'annulation:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
