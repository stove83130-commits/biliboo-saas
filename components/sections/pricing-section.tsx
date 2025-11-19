"use client"

import { useState, useEffect } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SmartCTAButton } from "@/components/ui/smart-cta-button"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      try {
        // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!error && session?.user) {
          setUser(session.user)
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Erreur vérification utilisateur:', error)
        setUser(null)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  // Vérifier si l'utilisateur a déjà consommé son essai gratuit
  // Un essai est considéré comme consommé si :
  // 1. trial_consumed est true (essai explicitement marqué comme consommé)
  // 2. trial_started_at existe ET l'essai est terminé (trial_ends_at est dans le passé)
  const trialStartedAt = user?.user_metadata?.trial_started_at
  const trialEndsAt = user?.user_metadata?.trial_ends_at
  const trialConsumed = user?.user_metadata?.trial_consumed === true
  const trialExpired = trialEndsAt && new Date(trialEndsAt) < new Date()
  const hasUsedTrial = trialConsumed || (trialStartedAt && trialExpired)

  // Fonction pour obtenir le texte du bouton selon l'état de l'essai
  const getButtonText = (defaultText: string) => {
    // Si l'utilisateur est connecté et n'a pas encore utilisé son essai, afficher "Essai gratuit de 7 jours"
    if (user && !hasUsedTrial) {
      return "Essai gratuit de 7 jours"
    }
    // Sinon, afficher le texte par défaut
    return defaultText
  }

  const pricingPlans = [
    {
      name: "Starter",
      monthlyPrice: "29 €",
      annualPrice: "23 €",
      description: "Pour les indépendants et freelances",
      features: [
        "100 factures/mois incluses",
        "1 compte e-mail connecté",
        "Export CSV / PDF / ZIP",
      ],
      buttonText: "Passer à Starter",
      buttonClass:
        "bg-white shadow-[0px_1px_1px_-0.5px_rgba(16,24,40,0.20)] outline outline-0.5 outline-[#1e29391f] outline-offset-[-0.5px] text-gray-800 text-shadow-[0px_1px_1px_rgba(16,24,40,0.08)] hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out",
    },
    {
      name: "Pro",
      monthlyPrice: "79 €",
      annualPrice: "63 €",
      description: "Pour les petites entreprises",
      features: [
        "300 factures/mois incluses",
        "3 comptes e-mail",
        "Espaces de travail (organisations)",
        "Export CSV / PDF / ZIP",
      ],
      buttonText: "Passer à Pro",
      buttonClass:
        "bg-primary-foreground shadow-[0px_1px_1px_-0.5px_rgba(16,24,40,0.20)] text-primary text-shadow-[0px_1px_1px_rgba(16,24,40,0.08)] hover:bg-primary-foreground/90",
      popular: true,
    },
    {
      name: "Business",
      monthlyPrice: "199 €",
      annualPrice: "159 €",
      description: "Pour les PME et cabinets comptables",
      features: [
        "1 200 factures/mois incluses",
        "10 comptes e-mail",
        "Espaces de travail (organisations)",
        "Multi-organisations et utilisateurs illimités",
        "Export CSV / PDF / ZIP",
      ],
      buttonText: "Passer à Business",
      buttonClass:
        "bg-secondary shadow-[0px_1px_1px_-0.5px_rgba(16,24,40,0.20)] text-secondary-foreground text-shadow-[0px_1px_1px_rgba(16,24,40,0.08)] hover:bg-secondary/90 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out",
    },
    {
      name: "Entreprise",
      monthlyPrice: "Sur devis",
      annualPrice: "Sur devis",
      description: "Pour les grands groupes",
      features: [
        "Factures illimitées",
        "Infrastructure dédiée",
        "SLA 99,9 %",
        "Support 24/7",
        "Développements sur mesure",
      ],
      buttonText: "Contactez-nous",
      buttonClass:
        "bg-white shadow-[0px_1px_1px_-0.5px_rgba(16,24,40,0.20)] outline outline-0.5 outline-[#1e29391f] outline-offset-[-0.5px] text-gray-800 text-shadow-[0px_1px_1px_rgba(16,24,40,0.08)] hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out",
    },
  ]

  return (
    <section className="w-full px-5 overflow-hidden flex flex-col justify-start items-center my-0 py-8 md:py-14">
      <div className="self-stretch relative flex flex-col justify-center items-center gap-2 py-0">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="text-center text-foreground text-4xl md:text-5xl font-semibold leading-tight md:leading-[40px]">
            Des tarifs adaptés à toutes les entreprises
          </h2>
          <p className="text-center text-muted-foreground text-sm font-medium leading-tight max-w-2xl">
            Choisissez le plan qui correspond à vos besoins comptables, des entrepreneurs qui débutent aux PME en croissance et aux grandes organisations.
          </p>
        </div>
        <div className="pt-4">
          <div className="p-0.5 bg-muted rounded-lg outline outline-1 outline-[#0307120a] outline-offset-[-1px] flex justify-start items-center gap-1 md:mt-0">
            <button
              onClick={() => setIsAnnual(false)}
              className={`pl-2 pr-1 py-1 flex justify-start items-start gap-2 rounded-md ${!isAnnual ? "bg-accent shadow-[0px_1px_1px_-0.5px_rgba(0,0,0,0.08)]" : ""}`}
            >
              <span
                className={`text-center text-sm font-medium leading-tight ${!isAnnual ? "text-accent-foreground" : "text-zinc-400"}`}
              >
                Mensuel
              </span>
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-2 py-1 flex justify-start items-start rounded-md ${isAnnual ? "bg-accent shadow-[0px_1px_1px_-0.5px_rgba(0,0,0,0.08)]" : ""}`}
            >
              <span
                className={`text-center text-sm font-medium leading-tight ${isAnnual ? "text-accent-foreground" : "text-zinc-400"}`}
              >
                Annuel
              </span>
            </button>
            <div className="px-2 py-1 rounded-full bg-accent/20">
              <span className="text-center text-xs font-medium leading-tight text-accent-foreground">
                20% de réduction
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="self-stretch px-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 justify-start items-start gap-4 md:gap-6 mt-8 max-w-[1400px] mx-auto">
        {pricingPlans.map((plan) => (
          <div key={plan.name} className="relative">
            {plan.popular && (
              <div 
                className="absolute -inset-1 rounded-xl opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  filter: 'blur(6px)',
                  zIndex: -1
                }}
              />
            )}
            <div
              className={`p-4 overflow-hidden rounded-xl flex flex-col justify-start items-start gap-6 relative z-10 ${plan.popular ? "bg-primary shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.10)]" : "bg-gray-50 shadow-sm"}`}
              style={plan.popular ? {} : { outline: "1px solid hsl(var(--border))", outlineOffset: "-1px" }}
            >
            <div className="self-stretch flex flex-col justify-start items-start gap-6">
              <div className="self-stretch flex flex-col justify-start items-start gap-8">
                <div
                  className={`w-full h-5 text-sm font-semibold leading-tight ${plan.popular ? "text-primary-foreground" : "text-gray-900"}`}
                >
                  {plan.name}
                  {plan.popular && (
                    <div className="ml-2 px-2 overflow-hidden rounded-full justify-center items-center gap-2.5 inline-flex mt-0 py-0.5 bg-white">
                      <div className="text-center text-black text-xs font-normal leading-tight break-words">
                        Populaire
                      </div>
                    </div>
                  )}
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-1">
                  <div className="flex justify-start items-center gap-1.5">
                    <div
                      className={`relative h-9 flex items-center text-[1.375rem] font-semibold leading-9 ${plan.popular ? "text-primary-foreground" : "text-gray-900"}`}
                    >
                      <span className="invisible">{isAnnual ? plan.annualPrice : plan.monthlyPrice}</span>
                      <span
                        className="absolute inset-0 flex items-center transition-all duration-500"
                        style={{
                          opacity: isAnnual ? 1 : 0,
                          transform: `scale(${isAnnual ? 1 : 0.8})`,
                          filter: `blur(${isAnnual ? 0 : 4}px)`,
                        }}
                        aria-hidden={!isAnnual}
                      >
                        {plan.annualPrice}
                      </span>
                      <span
                        className="absolute inset-0 flex items-center transition-all duration-500"
                        style={{
                          opacity: !isAnnual ? 1 : 0,
                          transform: `scale(${!isAnnual ? 1 : 0.8})`,
                          filter: `blur(${!isAnnual ? 0 : 4}px)`,
                        }}
                        aria-hidden={isAnnual}
                      >
                        {plan.monthlyPrice}
                      </span>
                    </div>
                    <div
                      className={`text-center text-xs font-medium leading-tight ${plan.popular ? "text-primary-foreground/70" : "text-gray-600"}`}
                    >
                      /mois
                    </div>
                  </div>
                  <div
                    className={`self-stretch text-sm font-medium leading-tight ${plan.popular ? "text-primary-foreground/70" : "text-gray-600"}`}
                  >
                    {plan.description}
                  </div>
                </div>
              </div>
              <SmartCTAButton
                className={`self-stretch px-5 py-2 rounded-[40px] flex justify-center items-center ${plan.buttonClass}`}
                planName={plan.name}
                isAnnual={isAnnual}
              >
                <div className="px-1.5 flex justify-center items-center gap-2">
                  <span
                    className={`text-center text-sm font-medium leading-tight ${plan.name === "Starter" ? "text-gray-800" : plan.name === "Pro" ? "text-primary" : plan.name === "Business" ? "text-zinc-950" : "text-gray-800"}`}
                  >
                    {plan.name === "Entreprise" ? plan.buttonText : getButtonText(plan.buttonText)}
                  </span>
                </div>
              </SmartCTAButton>
            </div>
            <div className="self-stretch flex flex-col justify-start items-start gap-4">
              <div
                className={`self-stretch text-sm font-medium leading-tight ${plan.popular ? "text-primary-foreground/70" : "text-gray-700"}`}
              >
                {plan.name === "Starter" ? "Commencer aujourd'hui :" : plan.name === "Entreprise" ? "Solution sur mesure :" : "Fonctionnalités incluses :"}
              </div>
              <div className="self-stretch flex flex-col justify-start items-start gap-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="self-stretch flex justify-start items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <Check
                        className={`w-full h-full ${plan.popular ? "text-primary-foreground" : "text-gray-700"}`}
                        strokeWidth={2}
                      />
                    </div>
                    <div
                      className={`leading-tight font-normal text-sm text-left ${plan.popular ? "text-primary-foreground" : "text-gray-700"}`}
                    >
                      {feature}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
