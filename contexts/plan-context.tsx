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
      const response = await fetch('/api/billing/plan', { credentials: 'include', cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        console.log('📋 Plan status mis à jour:', {
          planKey: data.planKey,
          hasActivePlan: data.hasActivePlan,
          subscription_status: data.subscription_status
        })
        setHasActivePlan(data.hasActivePlan || false)
        setCurrentPlan(data.planKey || null)
      } else {
        setHasActivePlan(false)
        setCurrentPlan(null)
      }
    } catch (error) {
      console.error('Erreur vérification plan:', error)
      setHasActivePlan(false)
      setCurrentPlan(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkPlanStatus()
    
    // Rafraîchir automatiquement toutes les 30 secondes pour détecter les changements
    const interval = setInterval(checkPlanStatus, 30000)
    
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


