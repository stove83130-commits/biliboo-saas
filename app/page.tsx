"use client"

import { useEffect } from "react"
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
