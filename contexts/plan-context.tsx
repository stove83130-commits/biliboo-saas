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

  useEffect(() => {
    const checkPlanStatus = async () => {
      try {
        const response = await fetch('/api/billing/plan', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
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

    checkPlanStatus()
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


