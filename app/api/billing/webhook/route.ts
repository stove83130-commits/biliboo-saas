import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Erreur webhook signature:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  const supabase = createClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = session.subscription as string
        
        // Récupérer la subscription pour avoir les détails
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        // Tenter d'identifier l'item metered (overage) et le stocker pour émission d'usage
        const meteredItem = subscription.items.data.find(
          (it) => it.price && it.price.recurring && it.price.recurring.usage_type === 'metered'
        )
        const overageItemId = meteredItem?.id || null
        
        await supabase.auth.updateUser({
          data: {
            // Appliquer le plan uniquement ici (après succès Stripe)
            selected_plan: session.metadata?.plan_id || null,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            is_trial: Boolean(subscription.trial_end && subscription.status === 'trialing'),
            trial_started_at: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : undefined,
            trial_consumed: Boolean(subscription.trial_end),
            overage_subscription_item_id: overageItemId,
          }
        })
        
        console.log('Checkout session completed:', session.id)
        break

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object as Stripe.Subscription
        
        // Déterminer le plan basé sur le price_id de l'abonnement
        const priceId = updatedSubscription.items.data[0]?.price?.id
        let planId = null
        
        if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
          planId = 'starter'
        } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) {
          planId = 'pro'
        } else if (priceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID) {
          planId = 'business'
        }
        
        await supabase.auth.updateUser({
          data: {
            selected_plan: planId,
            subscription_status: updatedSubscription.status,
            current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
            stripe_subscription_id: updatedSubscription.id,
            // Réinitialiser les métadonnées d'annulation si l'abonnement est réactivé
            ...(updatedSubscription.status === 'active' && updatedSubscription.cancel_at_period_end === false ? {
              cancellation_date: null,
              subscription_ends_at: null,
            } : {}),
          }
        })
        
        console.log('Subscription updated:', updatedSubscription.id, 'Plan:', planId)
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        
        await supabase.auth.updateUser({
          data: {
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          }
        })
        
        console.log('Subscription canceled:', deletedSubscription.id)
        break

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          // Récupérer la subscription pour avoir les métadonnées utilisateur
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          const supabaseUserId = subscription.metadata?.supabase_user_id
          
          if (supabaseUserId) {
            // Récupérer l'utilisateur depuis Supabase
            const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId)
            
            if (userData?.user) {
              const currentUsage = userData.user.user_metadata?.usage || {}
              const now = new Date()
              const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
              
              // Déterminer le plan basé sur le price_id de l'abonnement
              const priceId = subscription.items.data[0]?.price?.id
              let planId = userData.user.user_metadata?.selected_plan || 'starter'
              
              if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
                planId = 'starter'
              } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) {
                planId = 'pro'
              } else if (priceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID) {
                planId = 'business'
              }

              await supabase.auth.admin.updateUserById(supabaseUserId, {
                user_metadata: {
                  ...userData.user.user_metadata,
                  selected_plan: planId,
                  subscription_status: 'active',
                  last_payment_date: new Date().toISOString(),
                  // Réinitialiser le quota pour la nouvelle période
                  usage: {
                    ...currentUsage,
                    invoicesByPeriod: {
                      ...currentUsage.invoicesByPeriod,
                      [currentPeriod]: 0, // Reset quota pour la nouvelle période
                    },
                  },
                  // Désactiver le pay-as-you-go au renouvellement
                  allow_overage: false,
                  overage_reset_at: new Date().toISOString(),
                }
              })
            }
          }
        }
        
        console.log('Payment succeeded:', invoice.id)
        break

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice
        
        await supabase.auth.updateUser({
          data: {
            subscription_status: 'past_due',
          }
        })
        
        console.log('Payment failed:', failedInvoice.id)
        break

      default:
        console.log(`Event non géré: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Erreur webhook:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

