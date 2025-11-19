"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CreditCard, 
  Download, 
  Calendar, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
  X,
  Receipt,
  Check
} from "lucide-react"
import { SmartCTAButton } from "@/components/ui/smart-cta-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { PLANS } from "@/lib/billing/plans"
import { AddPaymentMethodDialog } from "@/components/billing/add-payment-method-dialog"

interface Subscription {
  plan: string
  status: string
  current_period_end: string
  cancel_at_period_end: boolean
}

interface Invoice {
  id: string
  type: 'payment' | 'invoice'
  amount: number
  currency: string
  status: string
  created: string
  created_at?: string
  description: string
  receipt_url?: string | null
  invoice_pdf?: string | null
}

interface PaymentMethod {
  id: string
  type: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  } | null
  isDefault: boolean
  created: string
}

interface Workspace {
  id: string
  name: string
  type: 'personal' | 'organization'
  created_at: string
  owner_id: string
}

function BillingPageContent() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)
  const [isAnnual, setIsAnnual] = useState(true)
  const [invoiceUsage, setInvoiceUsage] = useState<{ current: number; limit: number } | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const loadBillingData = async (skipAutoSync = false) => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Récupérer les données du plan depuis user_metadata
      const planKey = user.user_metadata?.selected_plan || null
      
      // Déterminer le statut : si l'utilisateur a un plan, on considère qu'il est actif
      // sauf si le statut est explicitement 'canceled', 'expired', etc.
      let subscriptionStatus = user.user_metadata?.subscription_status
      
      // Si pas de statut mais qu'il a un plan, on met 'active' par défaut
      // MAIS seulement s'il a vraiment un plan choisi
      if (!subscriptionStatus && planKey) {
        subscriptionStatus = 'active'
      }
      
      // Si pas de plan, le statut ne peut pas être actif
      if (!planKey) {
        subscriptionStatus = null
      }
      
      // Si le statut est 'trialing', on le considère comme actif
      if (subscriptionStatus === 'trialing') {
        subscriptionStatus = 'active'
      }
      
      const currentPeriodEnd = user.user_metadata?.current_period_end || null
      const cancelAtPeriodEnd = user.user_metadata?.subscription_ends_at ? true : false
      
      console.log('📊 Données facturation:', {
        planKey,
        subscriptionStatus,
        user_metadata: user.user_metadata
      })

      // Construire l'objet subscription (données essentielles)
      setSubscription({
        plan: planKey,
        status: subscriptionStatus,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd
      })

      // OPTIMISATION: Afficher la page immédiatement après avoir chargé les données essentielles
      setLoading(false)

      // Charger les données secondaires en parallèle (non-bloquant)
      Promise.all([
        // Charger les espaces de travail
        supabase
          .from('workspaces')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .then(({ data: workspacesData, error: workspacesError }) => {
            if (workspacesData && !workspacesError) {
              setWorkspaces(workspacesData)
            }
          }),
        
        // Charger les factures depuis Stripe
        fetch('/api/billing/payments')
          .then(async (paymentsResponse) => {
            if (paymentsResponse.ok) {
              const paymentsData = await paymentsResponse.json()
              setInvoices(paymentsData.payments || [])
              console.log('✅ Factures chargées:', paymentsData.payments?.length || 0)
            } else {
              console.warn('⚠️ Erreur chargement factures:', await paymentsResponse.text())
              setInvoices([])
            }
          })
          .catch((error) => {
            console.error('❌ Erreur chargement factures:', error)
            setInvoices([])
          }),
        
        // Charger les méthodes de paiement
        loadPaymentMethods(),
        
        // Charger le nombre de factures extraites ce mois-ci
        (async () => {
          try {
            const now = new Date()
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
            
            const { count, error: countError } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', firstDayOfMonth.toISOString())
              .lte('created_at', lastDayOfMonth.toISOString())
            
            if (!countError && count !== null) {
              const planLimit = planKey ? (PLANS[planKey]?.monthlyInvoiceLimit || 0) : 0
              setInvoiceUsage({
                current: count,
                limit: planLimit === -1 ? Infinity : planLimit // -1 = illimité
              })
              console.log('✅ Usage factures chargé:', count, '/', planLimit)
            }
          } catch (error) {
            console.error('❌ Erreur chargement usage factures:', error)
          }
        })()
      ]).catch((error) => {
        console.error('❌ Erreur chargement données secondaires:', error)
      })
      
      // Synchronisation automatique si l'utilisateur a un stripe_customer_id mais pas de plan
      // Cela indique qu'il a probablement payé mais que le webhook n'a pas fonctionné
      // Ne pas synchroniser si c'est un rechargement après une synchronisation automatique
      if (!skipAutoSync && user.user_metadata?.stripe_customer_id && !planKey) {
        console.log('🔄 Synchronisation automatique déclenchée: customer_id présent mais pas de plan')
        // Ne pas bloquer l'affichage pour la synchronisation
        fetch('/api/billing/sync-plan', {
          method: 'POST',
        })
          .then(async (response) => {
            const data = await response.json()
            if (response.ok && data.success) {
              console.log('✅ Synchronisation automatique réussie:', data)
              // Recharger les données sans bloquer
              loadBillingData(true)
            } else {
              console.warn('⚠️ Synchronisation automatique échouée:', data.error)
            }
          })
          .catch((error) => {
            console.error('Erreur synchronisation automatique:', error)
          })
      }
    } catch (error) {
      console.error('Erreur chargement facturation:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBillingData()
  }, [])

  // Synchronisation automatique si on revient du paiement
  useEffect(() => {
    const syncAfterPayment = async () => {
      const shouldSync = searchParams?.get('sync') === 'true' || searchParams?.get('payment') === 'success'
      
      if (shouldSync) {
        console.log('🔄 Synchronisation automatique après paiement déclenchée')
        // Attendre un peu pour que le webhook Stripe ait le temps de s'exécuter
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        try {
          const response = await fetch('/api/billing/sync-plan', {
            method: 'POST',
          })
          const data = await response.json()
          
          if (response.ok && data.success) {
            console.log('✅ Synchronisation automatique réussie après paiement:', data)
            // Recharger les données
            await loadBillingData(true)
            // Nettoyer l'URL
            window.history.replaceState({}, '', '/settings/billing')
          } else {
            console.warn('⚠️ Synchronisation automatique échouée, réessai dans 3 secondes...')
            // Réessayer après 3 secondes
            setTimeout(async () => {
              const retryResponse = await fetch('/api/billing/sync-plan', {
                method: 'POST',
              })
              const retryData = await retryResponse.json()
              if (retryResponse.ok && retryData.success) {
                console.log('✅ Synchronisation automatique réussie (réessai):', retryData)
                await loadBillingData(true)
                window.history.replaceState({}, '', '/settings/billing')
              }
            }, 3000)
          }
        } catch (error) {
          console.error('❌ Erreur synchronisation automatique:', error)
        }
      }
    }
    
    syncAfterPayment()
  }, [searchParams])

  // Vérification périodique automatique en arrière-plan
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.user_metadata?.stripe_customer_id && !user.user_metadata?.selected_plan) {
        console.log('🔄 Vérification périodique: synchronisation automatique déclenchée')
        try {
          const response = await fetch('/api/billing/sync-plan', {
            method: 'POST',
          })
          const data = await response.json()
          if (response.ok && data.success) {
            console.log('✅ Synchronisation périodique réussie')
            // Recharger les données
            await loadBillingData(true)
          }
        } catch (error) {
          console.error('Erreur synchronisation périodique:', error)
        }
      }
    }, 30000) // Vérifier toutes les 30 secondes
    
    return () => clearInterval(intervalId)
  }, [])

  const loadPaymentMethods = async () => {
    try {
      setLoadingPaymentMethods(true)
      const response = await fetch('/api/billing/payment-methods')
      if (response.ok) {
        const data = await response.json()
        setPaymentMethods(data.paymentMethods || [])
        console.log('✅ Méthodes de paiement chargées:', data.paymentMethods?.length || 0)
      } else {
        console.warn('⚠️ Erreur chargement méthodes de paiement')
        setPaymentMethods([])
      }
    } catch (error) {
      console.error('❌ Erreur chargement méthodes de paiement:', error)
      setPaymentMethods([])
    } finally {
      setLoadingPaymentMethods(false)
    }
  }

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      })

      if (response.ok) {
        await loadPaymentMethods()
        alert('Méthode de paiement par défaut mise à jour')
      } else {
        const error = await response.json()
        alert(`Erreur: ${error.error || 'Impossible de mettre à jour la méthode par défaut'}`)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette méthode de paiement ?')) {
      return
    }

    try {
      const response = await fetch(`/api/billing/payment-methods?id=${paymentMethodId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadPaymentMethods()
        alert('Méthode de paiement supprimée')
      } else {
        const error = await response.json()
        alert(`Erreur: ${error.error || 'Impossible de supprimer la méthode de paiement'}`)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleAddPaymentMethod = () => {
    setShowAddPaymentDialog(true)
  }

  const handlePaymentMethodAdded = async () => {
    await loadPaymentMethods()
    alert('Méthode de paiement ajoutée avec succès')
  }

  const handleUpgrade = () => {
    window.location.href = '/plans'
  }

  const handleManageSubscription = () => {
    window.location.href = '/api/billing/portal'
  }

  const handleCancelSubscription = async () => {
    setCancelling(true)
    try {
      const response = await fetch('/api/billing/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reasons: [],
          otherReason: ''
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Recharger les données pour afficher le statut d'annulation
        await loadBillingData(true)
        setShowCancelDialog(false)
        // Afficher un message de succès (vous pouvez ajouter un toast ici)
        alert('Votre abonnement a été annulé avec succès. Il restera actif jusqu\'à la fin de la période de facturation.')
      } else {
        if (response.status === 409) {
          // Abonnement déjà annulé
          await loadBillingData(true)
          setShowCancelDialog(false)
          alert('Votre abonnement est déjà annulé.')
        } else {
          alert(`Erreur lors de l'annulation: ${data.error || 'Erreur inconnue'}`)
        }
      }
    } catch (error: any) {
      console.error('Erreur annulation:', error)
      alert('Erreur lors de l\'annulation de l\'abonnement. Veuillez réessayer.')
    } finally {
      setCancelling(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (!subscription?.plan) {
      alert('Aucun plan trouvé pour réactiver.')
      return
    }

    setReactivating(true)
    try {
      const response = await fetch('/api/billing/reactivate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: subscription.plan
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Recharger les données pour afficher le statut réactivé
        await loadBillingData(true)
        alert('Votre abonnement a été réactivé avec succès !')
      } else {
        alert(`Erreur lors de la réactivation: ${data.error || 'Erreur inconnue'}`)
      }
    } catch (error: any) {
      console.error('Erreur réactivation:', error)
      alert('Erreur lors de la réactivation de l\'abonnement. Veuillez réessayer.')
    } finally {
      setReactivating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    // Stripe retourne les montants en centimes, donc on divise par 100
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(amount / 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  // Récupérer les noms et prix depuis PLANS
  const getPlanName = (planKey: string | null) => {
    if (!planKey) return 'Aucun plan'
    return PLANS[planKey]?.name || 'Gratuit'
  }

  const getPlanPrice = (planKey: string | null) => {
    if (!planKey) return '-'
    if (planKey === 'enterprise') return 'Sur devis'
    
    // Prix mensuels et annuels
    const prices: Record<string, { monthly: number; annual: number }> = {
      starter: { monthly: 29, annual: 23 },
      pro: { monthly: 79, annual: 63 },
      business: { monthly: 199, annual: 159 }
    }
    
    const planPrices = prices[planKey]
    if (!planPrices) return '0€/mois'
    
    // Pour l'instant, on affiche le prix annuel par défaut
    // TODO: détecter si l'abonnement est mensuel ou annuel depuis user_metadata
    return `${planPrices.annual}€/mois`
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-foreground">Facturation</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Gérez votre abonnement et consultez vos factures
        </p>
      </div>

      <div className="space-y-8">
        {/* Plan actuel avec le design de la page tarifs */}
        {subscription?.plan ? (() => {
          // Définir les données du plan actuel
          const planData = {
            starter: {
              name: "Starter",
              monthlyPrice: "29 €",
              annualPrice: "23 €",
              description: "Pour les indépendants et freelances",
              features: [
                "100 factures/mois incluses",
                "1 compte e-mail connecté",
                "Export CSV / PDF / ZIP",
              ],
              popular: false,
            },
            pro: {
              name: "Pro",
              monthlyPrice: "79 €",
              annualPrice: "63 €",
              description: "Pour les petites entreprises",
              features: [
                "300 factures/mois incluses",
                "3 comptes e-mail",
                "Espaces de travail (organisations)",
                "Export CSV / PDF / ZIP",
              ],
              popular: true,
            },
            business: {
              name: "Business",
              monthlyPrice: "199 €",
              annualPrice: "159 €",
              description: "Pour les PME et cabinets comptables",
              features: [
                "1 200 factures/mois incluses",
                "10 comptes e-mail",
                "Espaces de travail (organisations)",
                "Multi-organisations et utilisateurs illimités",
                "Export CSV / PDF / ZIP",
              ],
              popular: false,
            },
            enterprise: {
              name: "Entreprise",
              monthlyPrice: "Sur devis",
              annualPrice: "Sur devis",
              description: "Pour les grands groupes",
              features: [
                "Factures illimitées",
                "Infrastructure dédiée",
                "SLA 99,9 %",
                "Support 24/7",
                "Développements sur mesure",
              ],
              popular: false,
            },
          }[subscription.plan]

          if (!planData) return null

          const isActive = subscription.status === 'active' && !subscription.cancel_at_period_end
          const isPopular = planData.popular

          return (
            <div className="max-w-md mx-auto">
              <div className="relative">
                {isPopular && (
                  <div 
                    className="absolute -inset-1 rounded-xl opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      filter: 'blur(6px)',
                      zIndex: -1
                    }}
                  />
                )}
                <div
                  className={`p-4 overflow-hidden rounded-xl flex flex-col justify-start items-start gap-6 relative z-10 ${
                    isPopular ? "bg-primary shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.10)]" : "bg-gray-50 shadow-sm"
                  }`}
                  style={isPopular ? {} : { outline: "1px solid hsl(var(--border))", outlineOffset: "-1px" }}
                >
                  <div className="self-stretch flex flex-col justify-start items-start gap-6">
                    <div className="self-stretch flex flex-col justify-start items-start gap-8">
                      <div className="w-full flex items-center justify-between">
                        <div
                          className={`h-5 text-sm font-semibold leading-tight ${isPopular ? "text-primary-foreground" : "text-gray-900"}`}
                        >
                          {planData.name}
                          {isPopular && (
                            <div className="ml-2 px-2 overflow-hidden rounded-full justify-center items-center gap-2.5 inline-flex mt-0 py-0.5 bg-white">
                              <div className="text-center text-black text-xs font-normal leading-tight break-words">
                                Populaire
                              </div>
                            </div>
                          )}
                        </div>
                        <Badge className={`text-xs ${isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <div className="self-stretch flex flex-col justify-start items-start gap-1">
                        <div className="flex justify-start items-center gap-1.5">
                          <div
                            className={`relative h-9 flex items-center text-[1.375rem] font-semibold leading-9 ${isPopular ? "text-primary-foreground" : "text-gray-900"}`}
                          >
                            {subscription.plan === 'enterprise' ? (
                              planData.annualPrice
                            ) : (
                              <>
                                <span className="invisible">{isAnnual ? planData.annualPrice : planData.monthlyPrice}</span>
                                <span
                                  className="absolute inset-0 flex items-center transition-all duration-500"
                                  style={{
                                    opacity: isAnnual ? 1 : 0,
                                    transform: `scale(${isAnnual ? 1 : 0.8})`,
                                    filter: `blur(${isAnnual ? 0 : 4}px)`,
                                  }}
                                  aria-hidden={!isAnnual}
                                >
                                  {planData.annualPrice}
                                </span>
                                <span
                                  className="absolute inset-0 flex items-center transition-all duration-500"
                                  style={{
                                    opacity: !isAnnual ? 1 : 0,
                                    transform: `scale(${!isAnnual ? 1 : 0.8})`,
                                    filter: `blur(${!isAnnual ? 0 : 4}px)`,
                                  }}
                                  aria-hidden={isAnnual}
                                >
                                  {planData.monthlyPrice}
                                </span>
                              </>
                            )}
                          </div>
                          {subscription.plan !== 'enterprise' && (
                            <div
                              className={`text-center text-xs font-medium leading-tight ${isPopular ? "text-primary-foreground/70" : "text-gray-600"}`}
                            >
                              /mois
                            </div>
                          )}
                        </div>
                        <div
                          className={`self-stretch text-sm font-medium leading-tight ${isPopular ? "text-primary-foreground/70" : "text-gray-600"}`}
                        >
                          {planData.description}
                        </div>
                      </div>
                      
                      {/* Indicateur d'usage des factures */}
                      {invoiceUsage && invoiceUsage.limit !== Infinity && (
                        <div className="self-stretch flex flex-col gap-2 mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className={isPopular ? "text-primary-foreground/80" : "text-gray-700 font-medium"}>
                              Factures extraites ce mois
                            </span>
                            <span className={isPopular ? "text-primary-foreground" : "text-gray-900 font-semibold"}>
                              {invoiceUsage.current} / {invoiceUsage.limit}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                invoiceUsage.current >= invoiceUsage.limit
                                  ? 'bg-red-500'
                                  : invoiceUsage.current >= invoiceUsage.limit * 0.8
                                  ? 'bg-amber-500'
                                  : isPopular
                                  ? 'bg-white'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (invoiceUsage.current / invoiceUsage.limit) * 100)}%`
                              }}
                            />
                          </div>
                          {invoiceUsage.current >= invoiceUsage.limit && (
                            <p className="text-xs text-red-600 font-medium">
                              Limite atteinte. Pensez à améliorer votre plan.
                            </p>
                          )}
                          {invoiceUsage.current >= invoiceUsage.limit * 0.8 && invoiceUsage.current < invoiceUsage.limit && (
                            <p className="text-xs text-amber-600 font-medium">
                              Vous approchez de votre limite ({Math.round((invoiceUsage.current / invoiceUsage.limit) * 100)}% utilisé).
                            </p>
                          )}
                        </div>
                      )}
                      {invoiceUsage && invoiceUsage.limit === Infinity && (
                        <div className="self-stretch flex items-center gap-2 text-sm mt-4">
                          <span className={isPopular ? "text-primary-foreground/80" : "text-gray-700 font-medium"}>
                            Factures extraites ce mois :
                          </span>
                          <span className={isPopular ? "text-primary-foreground" : "text-gray-900 font-semibold"}>
                            {invoiceUsage.current} (illimité)
                          </span>
                        </div>
                      )}
                    </div>
                    {subscription.plan !== 'enterprise' && (
                      <div className="self-stretch flex justify-center">
                        <div className="p-0.5 bg-muted rounded-lg outline outline-1 outline-[#0307120a] outline-offset-[-1px] flex justify-start items-center gap-1">
                          <button
                            onClick={() => setIsAnnual(false)}
                            className={`pl-2 pr-1 py-1 flex justify-start items-start gap-2 rounded-md ${!isAnnual ? "bg-accent shadow-[0px_1px_1px_-0.5px_rgba(0,0,0,0.08)]" : ""}`}
                          >
                            <span
                              className={`text-center text-sm font-medium leading-tight ${!isAnnual ? "text-accent-foreground" : "text-zinc-400"}`}
                            >
                              Mensuel
                            </span>
                          </button>
                          <button
                            onClick={() => setIsAnnual(true)}
                            className={`px-2 py-1 flex justify-start items-start rounded-md ${isAnnual ? "bg-accent shadow-[0px_1px_1px_-0.5px_rgba(0,0,0,0.08)]" : ""}`}
                          >
                            <span
                              className={`text-center text-sm font-medium leading-tight ${isAnnual ? "text-accent-foreground" : "text-zinc-400"}`}
                            >
                              Annuel
                            </span>
                          </button>
                          <div className="px-2 py-1 rounded-full bg-accent/20">
                            <span className="text-center text-xs font-medium leading-tight text-accent-foreground">
                              20% de réduction
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-start gap-4">
                    <div
                      className={`self-stretch text-sm font-medium leading-tight ${isPopular ? "text-primary-foreground/70" : "text-gray-700"}`}
                    >
                      {subscription.plan === "starter" ? "Commencer aujourd'hui :" : subscription.plan === "enterprise" ? "Solution sur mesure :" : "Fonctionnalités incluses :"}
                    </div>
                    <div className="self-stretch flex flex-col justify-start items-start gap-3">
                      {planData.features.map((feature) => (
                        <div key={feature} className="self-stretch flex justify-start items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center">
                            <Check
                              className={`w-full h-full ${isPopular ? "text-primary-foreground" : "text-gray-700"}`}
                              strokeWidth={2}
                            />
                          </div>
                          <div
                            className={`leading-tight font-normal text-sm text-left ${isPopular ? "text-primary-foreground" : "text-gray-700"}`}
                          >
                            {feature}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  {isActive && (
                    <div className="self-stretch pt-4 border-t border-border/30 flex gap-2 flex-wrap">
                      {subscription.plan !== 'enterprise' && (
                        <Button
                          onClick={handleUpgrade}
                          size="sm"
                          className={`text-xs h-8 ${
                            isPopular
                              ? "bg-white text-primary hover:bg-white/90"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                          }`}
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Améliorer
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCancelDialog(true)}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-8"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Annuler
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = '/plans'}
                        className="text-xs h-8"
                      >
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        Voir tous les plans
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Message d'annulation si applicable */}
              {subscription.cancel_at_period_end && (
                <Card className="mt-6 p-4 border-amber-200 bg-amber-50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 mb-1">
                        Abonnement en cours d'annulation
                      </p>
                      <p className="text-xs text-amber-700 mb-3">
                        Votre abonnement {getPlanName(subscription.plan)} sera annulé le {formatDate(subscription.current_period_end)}. Vous pouvez le réactiver à tout moment.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={handleReactivateSubscription}
                          disabled={reactivating}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                        >
                          {reactivating ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                              Réactivation...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Réactiver l'abonnement
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => window.location.href = '/plans'}
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          Voir les plans
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )
        })() : (
          <Card className="p-6 border-0 shadow-none bg-accent/30">
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Aucun abonnement actif
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Choisissez un forfait pour commencer à utiliser toutes les fonctionnalités
              </p>
              <Button
                onClick={() => window.location.href = '/plans'}
                className="text-white hover:opacity-90 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                }}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Voir tous les forfaits
              </Button>
            </div>
          </Card>
        )}

        {/* Espaces de travail inclus */}
        <Card className="p-6 border-0 shadow-none bg-accent/30">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-foreground">Espaces de travail</h2>
          </div>

          {workspaces.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Aucun espace de travail
              </h3>
              <p className="text-sm text-muted-foreground">
                Créez votre premier espace de travail pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      workspace.type === 'personal' 
                        ? 'bg-blue-50' 
                        : 'bg-green-50'
                    }`}>
                      {workspace.type === 'personal' ? (
                        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {workspace.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {workspace.type === 'personal' ? 'Espace personnel' : 'Organisation'}
                      </p>
                    </div>
                  </div>

                  <Badge className="bg-green-50 text-green-700 border-0 text-xs px-2 py-0.5">
                    Actif
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border/30">
            <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Limite d'espaces de travail
                </p>
                <p className="text-xs text-blue-700/80">
                  {subscription?.plan === 'starter' && 'Le plan Starter inclut 1 espace personnel uniquement.'}
                  {subscription?.plan === 'pro' && 'Le plan Pro inclut 1 espace personnel + 1 organisation.'}
                  {subscription?.plan === 'business' && 'Le plan Business inclut des organisations illimitées.'}
                  {subscription?.plan === 'enterprise' && 'Le plan Entreprise inclut des organisations illimitées.'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Méthodes de paiement */}
        <Card className="p-6 border-0 shadow-none bg-accent/30">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Méthodes de paiement</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddPaymentMethod}
              disabled={loadingPaymentMethods}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Ajouter une méthode
            </Button>
          </div>

          {loadingPaymentMethods ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Aucune méthode de paiement
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ajoutez une méthode de paiement pour faciliter vos futurs paiements
              </p>
              <Button variant="outline" onClick={handleAddPaymentMethod}>
                <CreditCard className="h-4 w-4 mr-2" />
                Ajouter une carte
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      {method.card ? (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {method.card.brand.toUpperCase()} •••• {method.card.last4}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expire le {String(method.card.exp_month).padStart(2, '0')}/{method.card.exp_year}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-foreground">
                          {method.type}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {method.isDefault && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        Par défaut
                      </Badge>
                    )}
                    {!method.isDefault && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                        >
                          Définir par défaut
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePaymentMethod(method.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Historique des factures */}
        <Card className="p-6 border-0 shadow-none bg-accent/30">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-foreground">Historique des factures</h2>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Aucune facture
              </h3>
              <p className="text-sm text-muted-foreground">
                Vos factures apparaîtront ici une fois votre premier paiement effectué
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground">DATE</TableHead>
                    <TableHead className="text-xs text-muted-foreground">DESCRIPTION</TableHead>
                    <TableHead className="text-xs text-muted-foreground">MONTANT</TableHead>
                    <TableHead className="text-xs text-muted-foreground">STATUT</TableHead>
                    <TableHead className="text-xs text-muted-foreground">TAPER</TableHead>
                    <TableHead className="text-xs text-muted-foreground">TÉLÉCHARGER</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const date = invoice.created || invoice.created_at || ''
                    const status = invoice.status === 'paid' || invoice.status === 'succeeded' ? 'payé' : 
                                  invoice.status === 'pending' ? 'en attente' : 
                                  invoice.status === 'failed' ? 'échoué' : 'inconnu'
                    const type = invoice.type === 'invoice' ? 'abonnement' : 'unique'
                    const downloadUrl = invoice.invoice_pdf || invoice.receipt_url
                    
                    return (
                      <TableRow key={invoice.id} className="border-border hover:bg-muted/50">
                        <TableCell className="text-sm text-foreground">
                          {date ? formatDate(date) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {invoice.description || '-'}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-foreground">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              status === 'payé' || status === 'réussi'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : status === 'en attente'
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                : status === 'échoué'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }
                          >
                            {status === 'payé' ? 'payé' : status === 'réussi' ? 'réussi' : status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              type === 'abonnement'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-purple-100 text-purple-700 border-purple-200'
                            }
                          >
                            {type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {downloadUrl ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(downloadUrl, '_blank')}
                            >
                              <Download className="h-4 w-4 text-blue-600" />
                            </Button>
                          ) : (
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Dialog d'annulation */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Annuler l'abonnement</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler votre abonnement ?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-sm text-amber-900">
                <strong>Information importante :</strong> Votre abonnement restera actif jusqu'à la fin de la période de facturation ({subscription?.current_period_end ? formatDate(subscription.current_period_end) : 'la fin de la période'}). 
                Vous pourrez continuer à utiliser tous les services jusqu'à cette date.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous pourrez réactiver votre abonnement à tout moment avant la fin de la période.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelling}
            >
              Conserver l'abonnement
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Annulation en cours...
                </>
              ) : (
                'Confirmer l\'annulation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour ajouter une méthode de paiement */}
      <AddPaymentMethodDialog
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={handlePaymentMethodAdded}
      />
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  )
}

