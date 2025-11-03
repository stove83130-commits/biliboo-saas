"use client"

import { useState, useEffect } from "react"
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
  Sparkles
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PLANS } from "@/lib/billing/plans"

interface Subscription {
  plan: string
  status: string
  current_period_end: string
  cancel_at_period_end: boolean
}

interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  created_at: string
  invoice_pdf: string | null
}

interface Workspace {
  id: string
  name: string
  type: 'personal' | 'organization'
  created_at: string
  owner_id: string
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadBillingData = async (skipAutoSync = false) => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

      // Construire l'objet subscription
      setSubscription({
        plan: planKey,
        status: subscriptionStatus,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd
      })

      // Charger les espaces de travail
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (workspacesData && !workspacesError) {
        setWorkspaces(workspacesData)
      }

      // Charger les factures (simulé pour l'instant)
      setInvoices([])
      
      // Synchronisation automatique si l'utilisateur a un stripe_customer_id mais pas de plan
      // Cela indique qu'il a probablement payé mais que le webhook n'a pas fonctionné
      // Ne pas synchroniser si c'est un rechargement après une synchronisation manuelle
      if (!skipAutoSync && user.user_metadata?.stripe_customer_id && !planKey) {
        console.log('🔄 Synchronisation automatique déclenchée: customer_id présent mais pas de plan')
        await syncWithStripe()
      }
    } catch (error) {
      console.error('Erreur chargement facturation:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBillingData()
  }, [])

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

  const handleUpgrade = () => {
    window.location.href = '/plans'
  }

  const handleManageSubscription = () => {
    window.location.href = '/api/billing/portal'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
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
        {/* Plan actuel */}
        <Card className="p-6 border-0 shadow-none bg-accent/30">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-foreground">Plan actuel</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plan */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Plan</p>
              <div className="flex items-center gap-2">
                <Badge className={`${subscription?.plan ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'} border-0 text-sm px-2.5 py-1 font-medium`}>
                  {getPlanName(subscription?.plan || null)}
                </Badge>
                <span className="text-lg font-semibold text-foreground">
                  {getPlanPrice(subscription?.plan || null)}
                </span>
              </div>
            </div>

            {/* Statut */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Statut</p>
              <div className="flex items-center gap-2">
                {subscription?.plan && subscription?.status === 'active' ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-foreground">Actif</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {subscription?.plan ? 'Inactif' : 'Aucun plan'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Prochaine facturation */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Prochaine facturation</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {subscription?.current_period_end 
                    ? formatDate(subscription.current_period_end)
                    : '-'
                  }
                </span>
              </div>
            </div>
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Abonnement en cours d'annulation
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Votre abonnement sera annulé le {formatDate(subscription.current_period_end)}. 
                  Vous pouvez le réactiver à tout moment.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 pt-6 border-t border-border/30 flex gap-3 flex-wrap">
            {subscription?.plan !== 'enterprise' && (
              <Button
                onClick={handleUpgrade}
                className="text-white hover:opacity-90 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Améliorer mon plan
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => window.location.href = '/plans'}
              className="border-border/30 hover:bg-accent"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Voir tous les plans
            </Button>
          </div>
        </Card>

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
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Facture #{invoice.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(invoice.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                      <Badge
                        className={
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }
                      >
                        {invoice.status === 'paid' ? 'Payée' : 'En attente'}
                      </Badge>
                    </div>
                    {invoice.invoice_pdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.invoice_pdf!, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

