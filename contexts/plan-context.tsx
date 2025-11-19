"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface PlanContextType {
  hasActivePlan: boolean
  currentPlan: string | null
  isLoading: boolean
}

const PlanContext = createContext<PlanContextType>({
  hasActivePlan: false,
  currentPlan: null,
  isLoading: true
})

export function PlanProvider({ children }: { children: ReactNode }) {
  const [hasActivePlan, setHasActivePlan] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkPlanStatus = async () => {
    try {
      // Utiliser directement les métadonnées utilisateur au lieu de l'API
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user || null
      
      if (user) {
        const selectedPlan = user.user_metadata?.selected_plan as string | null
        const subscriptionStatus = user.user_metadata?.subscription_status as string | null
        const isTrial = Boolean(user.user_metadata?.is_trial)
        const trialEndsAt = user.user_metadata?.trial_ends_at as string | null
        
        setCurrentPlan(selectedPlan || null)
        
        // Déterminer si l'utilisateur a un plan actif
        const hasActiveSubscription = subscriptionStatus === 'active' || 
                                     subscriptionStatus === 'trialing' ||
                                     (isTrial && trialEndsAt && new Date(trialEndsAt) > new Date())
        
        setHasActivePlan(hasActiveSubscription)
      } else {
        setHasActivePlan(false)
        setCurrentPlan(null)
      }
    } catch (error: any) {
      console.error('Erreur vérification plan:', error)
      setHasActivePlan(false)
      setCurrentPlan(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkPlanStatus()
    
    // Rafraîchir automatiquement toutes les 5 minutes pour détecter les changements
    // (réduit de 30s à 5min pour éviter trop de requêtes inutiles)
    const interval = setInterval(checkPlanStatus, 300000) // 5 minutes = 300000 ms
    
    // Écouter les événements de changement de plan
    const handlePlanChange = () => {
      console.log('🔄 Événement de changement de plan détecté, rafraîchissement...')
      checkPlanStatus()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('plan:changed', handlePlanChange)
      window.addEventListener('plan:synced', handlePlanChange)
    }
    
    return () => {
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('plan:changed', handlePlanChange)
        window.removeEventListener('plan:synced', handlePlanChange)
      }
    }
  }, [])

  return (
    <PlanContext.Provider value={{ hasActivePlan, currentPlan, isLoading }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const context = useContext(PlanContext)
  if (context === undefined) {
    throw new Error('usePlan must be used within a PlanProvider')
  }
  return context
}


