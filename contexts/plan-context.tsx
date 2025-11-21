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
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)

  const checkPlanStatus = async () => {
    // PROTECTION: Ne pas check si déjà en cours
    if (isCheckingAuth) {
      console.log('⏭️  Check plan déjà en cours, skip')
      return
    }

    setIsCheckingAuth(true)

    try {
      const supabase = createClient()
      
      // PROTECTION: Vérifier d'abord si on a des cookies d'auth
      // Si pas de cookies, pas besoin d'appeler getSession()
      if (typeof document !== 'undefined') {
        const hasCookie = document.cookie.includes('sb-qkpfxpuhrjgctpadxslh-auth-token')
        if (!hasCookie) {
          console.log('🔒 Pas de cookie d\'auth, skip check plan')
          setHasActivePlan(false)
          setCurrentPlan(null)
          setIsLoading(false)
          setIsCheckingAuth(false)
          return
        }
      }

      // Appeler getSession() seulement si on a des cookies
      const { data: { session }, error } = await supabase.auth.getSession()
      
      // Si erreur rate limit, arrêter immédiatement
      if (error?.status === 429) {
        console.error('⚠️  Rate limit atteint dans PlanContext, arrêt des checks')
        setIsLoading(false)
        setIsCheckingAuth(false)
        return
      }

      // Ignorer les erreurs normales (refresh_token_not_found, etc.)
      if (error && error.code !== 'refresh_token_not_found' && error.status !== 400) {
        console.warn('⚠️  Erreur auth PlanContext:', error.message)
      }

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
      console.error('❌ Erreur vérification plan:', error)
      setHasActivePlan(false)
      setCurrentPlan(null)
    } finally {
      setIsLoading(false)
      setIsCheckingAuth(false)
    }
  }

  useEffect(() => {
    // Check initial seulement
    checkPlanStatus()
    
    // ❌ SUPPRIMÉ: Plus d'interval automatique qui cause le rate limit
    // ❌ const interval = setInterval(checkPlanStatus, 300000)
    
    // Écouter les événements de changement de plan SEULEMENT
    const handlePlanChange = () => {
      console.log('🔄 Événement de changement de plan détecté, rafraîchissement...')
      checkPlanStatus()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('plan:changed', handlePlanChange)
      window.addEventListener('plan:synced', handlePlanChange)
    }
    
    return () => {
      // ❌ Plus d'interval à clear
      if (typeof window !== 'undefined') {
        window.removeEventListener('plan:changed', handlePlanChange)
        window.removeEventListener('plan:synced', handlePlanChange)
      }
    }
  }, []) // Pas de dépendances pour éviter les re-runs

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
