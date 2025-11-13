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
      // Vérifier d'abord si l'utilisateur est connecté pour éviter les appels inutiles
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      // Si l'utilisateur n'est pas connecté, ne pas appeler l'API
      if (!user) {
        setHasActivePlan(false)
        setCurrentPlan(null)
        setIsLoading(false)
        return
      }
      
      const response = await fetch('/api/billing/plan', { credentials: 'include', cache: 'no-store' })
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
      } else if (response.status === 401) {
        // 401 = utilisateur non authentifié, c'est normal pour les pages publiques
        // Ne pas logger d'erreur, juste définir les valeurs par défaut
        setHasActivePlan(false)
        setCurrentPlan(null)
      } else {
        // Autre erreur (500, etc.) - logger uniquement en développement
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Erreur vérification plan (status:', response.status, ')')
        }
        setHasActivePlan(false)
        setCurrentPlan(null)
      }
    } catch (error) {
      // Erreur réseau - logger uniquement en développement
      if (process.env.NODE_ENV === 'development') {
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


