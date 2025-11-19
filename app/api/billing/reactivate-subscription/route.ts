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

    const { plan } = await request.json()
    console.log('Réactivation demandée pour le plan:', plan)

    // Récupérer l'ID de l'abonnement Stripe
    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    console.log('Stripe Customer ID:', stripeCustomerId)
    
    if (!stripeCustomerId) {
      console.error('Aucun stripe_customer_id trouvé dans les métadonnées')
      return NextResponse.json({ 
        error: 'Aucun abonnement trouvé. Veuillez vous assurer d\'avoir un abonnement actif.',
        details: 'stripe_customer_id manquant'
      }, { status: 400 })
    }

    // Récupérer les abonnements du client (actifs et annulés)
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'all',
            limit: 10
          })

    console.log('Abonnements Stripe trouvés:', subscriptions.data.length)

    // Chercher un abonnement annulé à réactiver
          const cancelledSubscription = subscriptions.data.find(sub => 
            sub.cancel_at_period_end === true || sub.status === 'canceled'
          )

    let reactivatedSubscription

          if (cancelledSubscription) {
            // Réactiver l'abonnement existant en supprimant cancel_at_period_end
            if (cancelledSubscription.status === 'canceled' && !cancelledSubscription.cancel_at_period_end) {
              // Impossible à réactiver côté Stripe si totalement annulé
              return NextResponse.json({ 
                error: 'Abonnement déjà résilié définitivement sur Stripe. Réactivation automatique impossible.',
                details: 'fully_canceled'
              }, { status: 400 })
            }
            reactivatedSubscription = await stripe.subscriptions.update(cancelledSubscription.id, {
              cancel_at_period_end: false,
              metadata: {
                reactivated_at: new Date().toISOString(),
                reactivated_plan: plan
              }
            })
            console.log('Abonnement existant réactivé:', reactivatedSubscription.id)
          } else {
            // Aucun abonnement en attente d'annulation: vérifier si un abonnement actif existe déjà
            const latest = subscriptions.data.find(sub => ['trialing','active','past_due','unpaid'].includes(sub.status as string))
            if (latest && latest.cancel_at_period_end === false) {
              // Déjà actif: synchroniser l'état côté Supabase et retourner succès
              const { error: updateError } = await supabase.auth.updateUser({
                data: {
                  subscription_status: 'active',
                  subscription_ends_at: null,
                  cancellation_date: null,
                  reactivation_date: new Date().toISOString()
                }
              })
              if (updateError) {
                console.error('Erreur de synchro métadonnées après détection déjà actif:', updateError)
              }
              return NextResponse.json({ success: true, subscription: latest })
            }
            // Sinon, rien à réactiver automatiquement
            return NextResponse.json({ 
              error: 'Aucun abonnement en attente d\'annulation trouvé. Réactivation automatique impossible.',
              details: 'no_pending_cancellation'
            }, { status: 400 })
          }

    // Mettre à jour les métadonnées utilisateur
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        subscription_status: 'active',
        reactivation_date: new Date().toISOString(),
        subscription_ends_at: null // Supprimer la date de fin
      }
    })

    if (updateError) {
      console.error('Erreur lors de la mise à jour des métadonnées:', updateError)
      // On continue quand même car la réactivation Stripe a réussi
    }

    console.log('Réactivation Stripe réussie')

    return NextResponse.json({ 
      success: true,
      message: 'Abonnement réactivé avec succès',
      subscription: {
        id: reactivatedSubscription.id,
        status: reactivatedSubscription.status
      }
    })

  } catch (error) {
    console.error('Erreur lors de la réactivation:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
