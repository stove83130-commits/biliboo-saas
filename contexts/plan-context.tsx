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
      // Ajouter un timeout pour éviter les blocages
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 secondes max
      
      const response = await fetch('/api/billing/plan', { 
        credentials: 'include', 
        cache: 'no-store',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        // Log uniquement si le statut a changé (pour éviter les logs répétitifs)
        setHasActivePlan((prev) => {
          const newValue = data.hasActivePlan || false
          if (prev !== newValue) {
            console.log('📋 Plan status changé:', {
              planKey: data.planKey,
              hasActivePlan: newValue,
              subscription_status: data.subscription_status
            })
          }
          return newValue
        })
        setCurrentPlan(data.planKey || null)
      } else {
        setHasActivePlan(false)
        setCurrentPlan(null)
      }
    } catch (error: any) {
      // Ignorer les erreurs d'abort (timeout) - c'est normal
      if (error.name !== 'AbortError') {
        console.error('Erreur vérification plan:', error)
      }
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


