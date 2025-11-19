"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Mail, Search, FileCheck, Download, Circle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface OnboardingStep {
  id: string
  title: string
  description: string
  buttonText: string
  buttonAction: () => void
  completed: boolean
}

export function DashboardOnboarding() {
  const [emailConnected, setEmailConnected] = useState(false)
  const [hasExtracted, setHasExtracted] = useState(false)
  const [hasInvoices, setHasInvoices] = useState(false)
  const [hasExported, setHasExported] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkProgress()
  }, [])

  const checkProgress = async () => {
    try {
      // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
      const { data: { session }, error } = await supabase.auth.getSession()
      const user = session?.user || null
      if (!user) return

      // Vérifier si un email est connecté
      const { data: emailAccounts } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      
      setEmailConnected((emailAccounts?.length || 0) > 0)

      // Vérifier si une extraction a été faite
      const { data: extractionJobs } = await supabase
        .from('extraction_jobs')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      
      setHasExtracted((extractionJobs?.length || 0) > 0)

      // Vérifier si des factures existent
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      
      setHasInvoices((invoices?.length || 0) > 0)

      // Vérifier si un export a été fait
      const { data: exports } = await supabase
        .from('export_history')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      
      setHasExported((exports?.length || 0) > 0)
    } catch (error) {
      console.error('Erreur lors de la vérification de la progression:', error)
    } finally {
      setLoading(false)
    }
  }

  const steps: OnboardingStep[] = [
    {
      id: 'connect',
      title: 'Connecter votre boîte mail',
      description: 'Autorisez l\'accès à votre Gmail/Outlook pour extraire les factures',
      buttonText: 'Connecter',
      buttonAction: () => router.push('/dashboard/settings'),
      completed: emailConnected
    },
    {
      id: 'extract',
      title: 'Lancer une extraction',
      description: 'Lancez l\'extraction pour trouver toutes vos factures/reçus',
      buttonText: 'Extraire',
      buttonAction: () => router.push('/dashboard/extraction'),
      completed: hasExtracted
    },
    {
      id: 'verify',
      title: 'Vérifier vos factures',
      description: 'Vérifiez et catégorisez vos factures extraites',
      buttonText: 'Voir les factures',
      buttonAction: () => router.push('/dashboard/invoices'),
      completed: hasInvoices
    },
    {
      id: 'export',
      title: 'Exporter vos factures',
      description: 'Exportez vos factures en PDF/Excel où vous voulez',
      buttonText: 'Exporter',
      buttonAction: () => router.push('/dashboard/exports'),
      completed: hasExported
    }
  ]

  const completedSteps = steps.filter(s => s.completed).length
  const currentStepIndex = steps.findIndex(s => !s.completed)
  const allCompleted = completedSteps === steps.length

  const getStepIcon = (step: OnboardingStep, index: number) => {
    if (step.completed) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    }
    if (index === currentStepIndex) {
      return <Circle className="h-5 w-5 text-orange-500 fill-orange-500" />
    }
    return <Circle className="h-5 w-5 text-gray-300" />
  }

  const getStepStyles = (step: OnboardingStep, index: number) => {
    if (step.completed) {
      return 'bg-green-50/50 border-0'
    }
    if (index === currentStepIndex) {
      return 'bg-orange-50/50 border-0'
    }
    return 'bg-accent/30 border-0'
  }

  if (loading) {
    return (
      <Card className="p-6 border-0 shadow-none bg-accent/30">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {allCompleted ? '🎉 Vous êtes prêt !' : 'Démarrez et réussissez avec Bilibou'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {allCompleted 
            ? 'Félicitations ! Vous avez terminé toutes les étapes de configuration.'
            : '4 étapes pour configurer et lancer votre gestion de factures.'
          }
        </p>
      </div>

      {/* Progress bar */}
      {!allCompleted && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {completedSteps} sur {steps.length} tâches terminées
          </span>
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(completedSteps / steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <details
            key={step.id}
            className="group"
            open={index === currentStepIndex && !step.completed}
          >
            <summary className="flex items-center gap-3 p-4 bg-white rounded-lg border border-border/50 cursor-pointer hover:bg-accent/30 transition-colors list-none">
              <div className="flex-shrink-0">
                {getStepIcon(step, index)}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">
                  {step.title}
                </h3>
              </div>
              <svg 
                className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            
            {/* Content when expanded */}
            <div className="px-4 pb-4 pt-2 bg-white border-x border-b border-border/50 rounded-b-lg -mt-1">
              <p className="text-sm text-muted-foreground mb-4">
                {step.description}
              </p>
              {!step.completed && (
                <Button
                  size="sm"
                  onClick={step.buttonAction}
                  className="text-white hover:opacity-90 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                  }}
                >
                  {step.buttonText}
                </Button>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
