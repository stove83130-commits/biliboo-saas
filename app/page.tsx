"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { HeroSection } from "@/components/sections/hero-section"
import { DashboardPreview } from "@/components/sections/dashboard-preview"
import { SocialProof } from "@/components/sections/social-proof"
import { BentoSection } from "@/components/sections/bento-section"
import { TargetAudienceSection } from "@/components/sections/target-audience-section"
import { LargeTestimonial } from "@/components/sections/large-testimonial"
import { PricingSection } from "@/components/sections/pricing-section"
import { FAQSection } from "@/components/sections/faq-section"
import { CTASection } from "@/components/sections/cta-section"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedSection } from "@/components/sections/animated-section"

export default function Home() {
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Vérifier l'authentification pour le chargement (sans redirection)
    // La page d'accueil est accessible à tous, même aux utilisateurs authentifiés
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    const checkAuth = async () => {
      // Timeout de sécurité : si la vérification prend plus de 3 secondes, arrêter le chargement
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('⏱️ Timeout vérification auth (3s), arrêt du chargement')
          setIsChecking(false)
        }
      }, 3000)

      try {
        const supabase = createClient()
        
        // Créer une promesse avec timeout intégré
        const authCheck = Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null }, error: Error }>((resolve) => 
            setTimeout(() => resolve({ 
              data: { user: null }, 
              error: new Error('Timeout vérification auth') 
            }), 2500)
          )
        ])
        
        const result = await authCheck
        
        if (!isMounted) return // Composant démonté, ne pas mettre à jour l'état
        
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        
        const { data: { user }, error } = result as any
        
        if (error) {
          console.warn('⚠️ Erreur auth (non bloquant):', error.message)
          // Ne pas bloquer si erreur, juste continuer sans redirection
          setIsChecking(false)
        } else {
          // Utilisateur authentifié ou non, permettre l'accès à la page d'accueil
          // La page d'accueil est accessible à tous, même aux utilisateurs authentifiés
          setIsChecking(false)
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error)
        if (isMounted) {
          setIsChecking(false)
        }
      } finally {
        if (timeoutId && isMounted) {
          clearTimeout(timeoutId)
        }
        if (isMounted) {
          setIsChecking(false)
        }
      }
    }
    
    checkAuth()
    
    // Cleanup si le composant est démonté
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    // Gérer le scroll vers la section quand il y a un hash dans l'URL
    const scrollToHash = () => {
      const hash = window.location.hash
      if (hash) {
        const sectionId = hash.replace('#', '')
        setTimeout(() => {
          const element = document.getElementById(sectionId)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' })
          }
        }, 300)
      }
    }
    
    scrollToHash()
    
    // Écouter les changements de hash (si l'utilisateur clique sur un lien avec hash)
    window.addEventListener('hashchange', scrollToHash)
    
    return () => {
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [])

  // Afficher un loader pendant la vérification de l'authentification
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }
  return (
    <main className="min-h-screen">
      <HeroSection />
      
      <AnimatedSection>
        <DashboardPreview />
      </AnimatedSection>
      
      <AnimatedSection>
        <SocialProof />
      </AnimatedSection>
      
      <AnimatedSection id="features-section">
        <BentoSection />
      </AnimatedSection>
      
      <AnimatedSection>
        <LargeTestimonial />
      </AnimatedSection>
      
      <AnimatedSection>
        <TargetAudienceSection />
      </AnimatedSection>
      
      <AnimatedSection id="pricing-section">
        <PricingSection />
      </AnimatedSection>
      
      <AnimatedSection>
        <FAQSection />
      </AnimatedSection>
      
      <AnimatedSection>
        <CTASection />
      </AnimatedSection>
      
      <FooterSection />
    </main>
  )
}
