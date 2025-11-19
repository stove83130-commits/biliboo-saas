"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Mail, Building2, FileText, ArrowUpRight, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getPlan, canAddEmailAccount, canCreateOrganization } from "@/lib/billing/plans"

interface PlanLimitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: 'email' | 'organization' | 'invoice'
}

export function PlanLimitModal({ open, onOpenChange, feature }: PlanLimitModalProps) {
  const [plan, setPlan] = useState<any>(null)
  const [currentCount, setCurrentCount] = useState(0)
  const [maxCount, setMaxCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      loadPlanInfo()
    }
  }, [open, feature])

  const loadPlanInfo = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const planId = user.user_metadata?.selected_plan || null
      const planData = getPlan(planId)
      setPlan(planData)

      if (feature === 'email') {
        const { count } = await supabase
          .from('email_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true)
        
        setCurrentCount(count || 0)
        setMaxCount(planData?.maxEmailAccounts || 0)
      } else if (feature === 'organization') {
        const { count } = await supabase
          .from('workspaces')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('type', 'organization')
        
        setCurrentCount(count || 0)
        setMaxCount(planData?.maxOrganizations || 0)
      } else if (feature === 'invoice') {
        // Compter les factures extraites ce mois-ci
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        
        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', firstDayOfMonth.toISOString())
          .lte('created_at', lastDayOfMonth.toISOString())
        
        setCurrentCount(count || 0)
        setMaxCount(planData?.monthlyInvoiceLimit || 0)
      }
    } catch (error) {
      console.error('Erreur chargement info plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFeatureInfo = () => {
    switch (feature) {
      case 'email':
        return {
          title: 'Limite de comptes e-mail atteinte',
          description: `Vous avez atteint la limite de ${maxCount} compte${maxCount > 1 ? 's' : ''} e-mail de votre plan actuel.`,
          icon: Mail,
          current: currentCount,
          max: maxCount,
          upgradeMessage: 'Upgradez votre plan pour connecter plus de comptes e-mail et bénéficier de fonctionnalités supplémentaires.'
        }
      case 'organization':
        return {
          title: 'Limite d\'organisations atteinte',
          description: `Vous avez atteint la limite d'organisations de votre plan actuel.`,
          icon: Building2,
          current: currentCount,
          max: maxCount,
          upgradeMessage: 'Upgradez votre plan pour créer plus d\'organisations et gérer plusieurs entreprises.'
        }
      case 'invoice':
        return {
          title: 'Limite de factures mensuelles atteinte',
          description: `Vous avez atteint votre limite mensuelle de ${maxCount === -1 ? 'factures' : maxCount + ' factures'} de votre plan actuel.`,
          icon: FileText,
          current: currentCount,
          max: maxCount === -1 ? Infinity : maxCount,
          upgradeMessage: 'Upgradez votre plan pour extraire plus de factures chaque mois et bénéficier de fonctionnalités supplémentaires.'
        }
      default:
        return {
          title: 'Limite atteinte',
          description: 'Vous avez atteint une limite de votre plan actuel.',
          icon: AlertCircle,
          current: 0,
          max: 0,
          upgradeMessage: 'Upgradez votre plan pour bénéficier de plus de fonctionnalités.'
        }
    }
  }

  const featureInfo = getFeatureInfo()
  const Icon = featureInfo.icon

  const handleUpgrade = () => {
    onOpenChange(false)
    window.location.href = '/plans'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center">
              <Icon className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">{featureInfo.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {featureInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan actuel */}
          {plan && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Plan actuel</span>
                <Badge className="bg-gray-200 text-gray-700">
                  {plan.name}
                </Badge>
              </div>
              {feature === 'email' && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">Comptes e-mail</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentCount} / {maxCount === -1 ? '∞' : maxCount}
                  </span>
                </div>
              )}
              {feature === 'organization' && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">Organisations</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentCount} / {maxCount === -1 ? '∞' : maxCount}
                  </span>
                </div>
              )}
              {feature === 'invoice' && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">Factures ce mois</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentCount} / {maxCount === Infinity ? '∞' : maxCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Message d'upgrade */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              {featureInfo.upgradeMessage}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fermer
          </Button>
          <Button
            onClick={handleUpgrade}
            className="w-full sm:w-auto text-white hover:opacity-90 transition-all"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Voir les plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

