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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = session.subscription as string
        
        if (!subscriptionId) {
          console.log('No subscription ID in session')
          break
        }
        
        // Récupérer la subscription pour avoir les détails
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        // Déterminer le plan basé sur le price_id
        const checkoutPriceId = subscription.items.data[0]?.price?.id
        let planId = session.metadata?.plan_id || null
        
        // Si pas de plan_id dans les métadonnées, le déterminer depuis le price_id
        if (!planId && checkoutPriceId) {
          if (checkoutPriceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || checkoutPriceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
            planId = 'starter'
          } else if (checkoutPriceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || checkoutPriceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) {
            planId = 'pro'
          } else if (checkoutPriceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || checkoutPriceId === process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID) {
            planId = 'business'
          }
        }

        // Tenter d'identifier l'item metered (overage) et le stocker pour émission d'usage
        const meteredItem = subscription.items.data.find(
          (it) => it.price && it.price.recurring && it.price.recurring.usage_type === 'metered'
        )
        const overageItemId = meteredItem?.id || null

        // Essayer de trouver l'utilisateur via le customer email si pas de metadata supabase_user_id
        let targetUserId: string | null = null
        
        if (session.metadata?.supabase_user_id) {
          targetUserId = session.metadata.supabase_user_id
        } else if (subscription.customer) {
          // Récupérer le customer pour avoir l'email et les métadonnées
          const customer = typeof subscription.customer === 'string' 
            ? await stripe.customers.retrieve(subscription.customer)
            : subscription.customer
          
          // Vérifier d'abord les métadonnées du customer
          if (customer.metadata?.supabase_user_id) {
            targetUserId = customer.metadata.supabase_user_id
          } else {
            // Sinon chercher par email
            const customerEmail = customer.email || session.customer_email
            
            if (customerEmail) {
              // Chercher l'utilisateur par email dans Supabase
              const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
              
              if (!listError && users) {
                const user = users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase())
                if (user) {
                  targetUserId = user.id
                  // Mettre à jour les métadonnées du customer pour les prochaines fois
                  await stripe.customers.update(customer.id, {
                    metadata: {
                      ...customer.metadata,
                      supabase_user_id: user.id
                    }
                  })
                }
              }
            }
          }
        } else if (session.customer_email) {
          // Dernier recours : chercher uniquement par email de session
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
          
          if (!listError && users) {
            const user = users.find(u => u.email?.toLowerCase() === session.customer_email?.toLowerCase())
            if (user) {
              targetUserId = user.id
            }
          }
        }

        if (targetUserId && planId) {
          // Mettre à jour l'utilisateur trouvé
          const { data: userData } = await supabase.auth.admin.getUserById(targetUserId)
          
          if (userData?.user) {
            await supabase.auth.admin.updateUserById(targetUserId, {
              user_metadata: {
                ...userData.user.user_metadata,
                selected_plan: planId,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || userData.user.user_metadata?.stripe_customer_id,
                subscription_status: subscription.status,
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                is_trial: Boolean(subscription.trial_end && subscription.status === 'trialing'),
                trial_started_at: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : undefined,
                trial_consumed: Boolean(subscription.trial_end),
                overage_subscription_item_id: overageItemId,
              }
            })
            console.log('✅ Plan attribué via checkout:', planId, 'pour utilisateur:', targetUserId)
          }
        } else {
          // Fallback: utiliser updateUser (nécessite que l'utilisateur soit connecté lors du checkout)
          await supabase.auth.updateUser({
            data: {
              selected_plan: planId,
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
          console.log('Checkout session completed (fallback):', session.id, 'Plan:', planId)
        }
        
        break
      }

      case 'customer.subscription.updated': {
        const updatedSubscription = event.data.object as Stripe.Subscription
        
        // Déterminer le plan basé sur le price_id de l'abonnement
        const updatePriceId = updatedSubscription.items.data[0]?.price?.id
        let updatePlanId = null
        
        if (updatePriceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || updatePriceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
          updatePlanId = 'starter'
        } else if (updatePriceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || updatePriceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) {
          updatePlanId = 'pro'
        } else if (updatePriceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || updatePriceId === process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID) {
          updatePlanId = 'business'
        }
        
        // Trouver l'utilisateur via le customer Stripe
        let updateTargetUserId: string | null = null
        
        // Essayer d'abord via les métadonnées de l'abonnement
        if (updatedSubscription.metadata?.supabase_user_id) {
          updateTargetUserId = updatedSubscription.metadata.supabase_user_id
        } else if (updatedSubscription.customer) {
          // Récupérer le customer Stripe
          const customer = typeof updatedSubscription.customer === 'string' 
            ? await stripe.customers.retrieve(updatedSubscription.customer)
            : updatedSubscription.customer
          
          // Vérifier les métadonnées du customer
          if (customer.metadata?.supabase_user_id) {
            updateTargetUserId = customer.metadata.supabase_user_id
          } else if (customer.email) {
            // Chercher par email
            const { data: { users } } = await supabase.auth.admin.listUsers()
            const user = users.find(u => u.email === customer.email)
            if (user) {
              updateTargetUserId = user.id
            }
          }
        }
        
        if (updateTargetUserId && updatePlanId) {
          // Mettre à jour via l'API admin
          const { data: userData } = await supabase.auth.admin.getUserById(updateTargetUserId)
          
          if (userData?.user) {
            await supabase.auth.admin.updateUserById(updateTargetUserId, {
              user_metadata: {
                ...userData.user.user_metadata,
                selected_plan: updatePlanId,
                subscription_status: updatedSubscription.status,
                current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
                stripe_subscription_id: updatedSubscription.id,
                stripe_customer_id: typeof updatedSubscription.customer === 'string' ? updatedSubscription.customer : updatedSubscription.customer?.id || userData.user.user_metadata?.stripe_customer_id,
                // Réinitialiser les métadonnées d'annulation si l'abonnement est réactivé
                ...(updatedSubscription.status === 'active' && updatedSubscription.cancel_at_period_end === false ? {
                  cancellation_date: null,
                  subscription_ends_at: null,
                } : {}),
              }
            })
            console.log('✅ Subscription updated via webhook:', updatedSubscription.id, 'Plan:', updatePlanId, 'User:', updateTargetUserId)
          }
        } else {
          console.warn('⚠️ Impossible de trouver l\'utilisateur pour subscription:', updatedSubscription.id, 'Customer:', updatedSubscription.customer)
        }
        
        break
      }

      case 'customer.subscription.deleted': {
        const deletedSubscription = event.data.object as Stripe.Subscription
        
        // Trouver l'utilisateur via le customer Stripe
        let deletedTargetUserId: string | null = null
        
        // Essayer d'abord via les métadonnées de l'abonnement
        if (deletedSubscription.metadata?.supabase_user_id) {
          deletedTargetUserId = deletedSubscription.metadata.supabase_user_id
        } else if (deletedSubscription.customer) {
          // Récupérer le customer Stripe
          const customer = typeof deletedSubscription.customer === 'string' 
            ? await stripe.customers.retrieve(deletedSubscription.customer)
            : deletedSubscription.customer
          
          // Vérifier les métadonnées du customer
          if (customer.metadata?.supabase_user_id) {
            deletedTargetUserId = customer.metadata.supabase_user_id
          } else if (customer.email) {
            // Chercher par email
            const { data: { users } } = await supabase.auth.admin.listUsers()
            const user = users.find(u => u.email === customer.email)
            if (user) {
              deletedTargetUserId = user.id
            }
          }
        }
        
        if (deletedTargetUserId) {
          // Mettre à jour via l'API admin
          const { data: userData } = await supabase.auth.admin.getUserById(deletedTargetUserId)
          
          if (userData?.user) {
            await supabase.auth.admin.updateUserById(deletedTargetUserId, {
              user_metadata: {
                ...userData.user.user_metadata,
                subscription_status: 'canceled',
                stripe_subscription_id: null,
              }
            })
            console.log('✅ Subscription canceled via webhook:', deletedSubscription.id, 'User:', deletedTargetUserId)
          }
        } else {
          console.warn('⚠️ Impossible de trouver l\'utilisateur pour subscription deleted:', deletedSubscription.id)
        }
        
        break
      }

      case 'invoice.payment_succeeded': {
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
              let planId = userData.user.user_metadata?.selected_plan || null
              
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
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice
        
        await supabase.auth.updateUser({
          data: {
            subscription_status: 'past_due',
          }
        })
        
        console.log('Payment failed:', failedInvoice.id)
        break
      }

      default:
        console.log(`Event non géré: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Erreur webhook:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

