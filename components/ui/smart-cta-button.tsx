"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface SmartCTAButtonProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  size?: "sm" | "md" | "lg"
  href?: string
  target?: string
  rel?: string
  planName?: string // Pour identifier le plan dans la section pricing
  isAnnual?: boolean // Pour savoir si c'est un abonnement annuel ou mensuel
}

export function SmartCTAButton({ 
  children, 
  className, 
  style, 
  size,
  href,
  target,
  rel,
  planName,
  isAnnual = false
}: SmartCTAButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [hasActivePlan, setHasActivePlan] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setIsLoading(true)
    let isMounted = true // Flag pour éviter les mises à jour après démontage
    
    const checkUserStatus = async () => {
      try {
        // getSession() est maintenant wrappé dans createClient() pour vérifier le cookie automatiquement
        // Ajouter un timeout pour éviter les blocages
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
        
        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any
        
        if (!isMounted) return
        
        const user = session?.user || null
        setUser(user)
        
        if (user) {
          // Vérifier si l'onboarding est terminé
          const onboardingCompleted = user.user_metadata?.onboarding_completed === true
          setOnboardingCompleted(onboardingCompleted)
          
          // Utiliser directement les métadonnées utilisateur (plus besoin de l'API)
          const selectedPlan = user.user_metadata?.selected_plan
          const subscriptionStatus = user.user_metadata?.subscription_status
          const isTrial = user.user_metadata?.is_trial
          const trialEndsAt = user.user_metadata?.trial_ends_at
          
          if (isMounted) {
            setCurrentPlan(selectedPlan || null)
            
            // Déterminer si l'utilisateur a un plan actif
            const hasActiveSubscription = subscriptionStatus === 'active' || 
                                         subscriptionStatus === 'trialing' ||
                                         (isTrial && trialEndsAt && new Date(trialEndsAt) > new Date())
            
            setHasActivePlan(hasActiveSubscription)
          }
        } else {
          // Pas d'utilisateur, valeurs par défaut
          if (isMounted) {
            setCurrentPlan(null)
            setHasActivePlan(false)
          }
        }
      } catch (error: any) {
        // Gérer les timeouts et autres erreurs
        if (error.message !== 'Timeout') {
          console.error('Erreur lors de la vérification de l\'utilisateur:', error)
        }
        
        // En cas d'erreur, définir des valeurs par défaut
        if (isMounted) {
          setUser(null)
          setCurrentPlan(null)
          setHasActivePlan(false)
        }
      } finally {
        // TOUJOURS appeler setIsLoading(false), même en cas d'erreur
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    checkUserStatus()
    
    // Cleanup: marquer le composant comme démonté
    return () => {
      isMounted = false
    }
  }, [])

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (isLoading || isProcessing) return

    // Cas spécial pour le plan "Entreprise" - toujours rediriger vers le contact
    if (planName === "Entreprise") {
      router.push('/contact?plan=entreprise')
      return
    }

    // Si c'est le plan actuel de l'utilisateur, ne rien faire (bouton désactivé)
    if (hasActivePlan && currentPlan === planName) {
      return
    }

    if (!user) {
      // Utilisateur non connecté -> sauvegarder le plan et rediriger vers l'inscription
      if (planName) {
        // Sauvegarder le plan choisi dans localStorage
        localStorage.setItem('selected_plan', planName.toLowerCase())
        localStorage.setItem('plan_redirect', 'true')
      }
      // Rediriger vers la page d'inscription (pas onboarding)
      router.push('/auth/signup')
    } else if (!onboardingCompleted) {
      // Utilisateur connecté mais onboarding non terminé -> rediriger vers l'onboarding
      router.push('/onboarding')
    } else {
      // Utilisateur connecté et onboarding terminé -> créer session de paiement
      if (planName) {
        setIsProcessing(true)
        try {
          const response = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              planId: planName.toLowerCase(),
              isAnnual: isAnnual,
              source: 'homepage',
              returnUrl: window.location.pathname + window.location.search // Inclure les query params si présents
            }),
          })

          if (response.ok) {
            const { url } = await response.json()
            window.location.href = url
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
            console.error('❌ Erreur création session Stripe:', errorData)
            alert(`Erreur lors de la création de la session de paiement: ${errorData.error || 'Erreur inconnue'}`)
          }
        } catch (error: any) {
          console.error('❌ Erreur:', error)
          alert(`Erreur lors de la création de la session de paiement: ${error?.message || 'Erreur réseau'}`)
        } finally {
          setIsProcessing(false)
        }
      } else {
        router.push('/dashboard')
      }
    }
  }

  if (isLoading) {
    return (
      <Button 
        className={className}
        style={style}
        size={size}
        disabled
      >
        Chargement...
      </Button>
    )
  }

  // Déterminer si le bouton doit être désactivé
  const isCurrentPlan = hasActivePlan && currentPlan === planName?.toLowerCase()
  const isDisabled = isLoading || isProcessing || isCurrentPlan

  return (
    <Button 
      className={className}
      style={style}
      size={size}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {isProcessing ? 'Redirection...' : isCurrentPlan ? 'Plan actuel' : children}
    </Button>
  )
}
