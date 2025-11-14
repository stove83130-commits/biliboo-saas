"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Vérifier si l'utilisateur est authentifié et rediriger vers le dashboard si nécessaire
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Utilisateur authentifié, rediriger vers le dashboard
          console.log('✅ Utilisateur authentifié détecté sur la page d\'accueil, redirection vers /dashboard')
          router.push('/dashboard')
          return
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error)
      } finally {
        setIsChecking(false)
      }
    }
    
    checkAuth()
  }, [router])

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
