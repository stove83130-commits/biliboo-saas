"use client"

import { useState, useEffect } from "react"
import { Check, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SmartCTAButton } from "@/components/ui/smart-cta-button"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

export default function PlansPage() {
  const [isAnnual, setIsAnnual] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      try {
        // getSession() est maintenant wrappé dans createClient() pour vérifier le cookie automatiquement
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error: any) {
        // Ignorer les erreurs
        setUser(null)
      } finally {
        setIsLoading(false)
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

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      const referrer = document.referrer
      const currentOrigin = window.location.origin
      
      // Vérifier si le referrer existe et qu'il est sur le même domaine (éviter localhost)
      if (referrer && referrer.startsWith(currentOrigin) && referrer !== window.location.href && !referrer.includes('/plans')) {
        // Le referrer est valide et sur le même domaine, on peut revenir en arrière
        router.back()
      } else if (referrer && !referrer.startsWith(currentOrigin)) {
        // Le referrer est d'un autre domaine (ex: Stripe), ne pas l'utiliser
        // Aller directement à la page d'accueil
        router.push('/')
      } else {
        // Pas de referrer valide ou referrer invalide, aller à la page d'accueil
        router.push('/')
      }
    }
  }

  // Vérifier si l'utilisateur a déjà consommé son essai gratuit
  const trialConsumed = user?.user_metadata?.trial_consumed || user?.user_metadata?.trial_started_at

  // Fonction pour obtenir le texte du bouton selon l'état de l'essai
  const getButtonText = (defaultText: string) => {
    // Si l'utilisateur n'a pas encore utilisé son essai, afficher "Essai gratuit de 7 jours"
    if (!trialConsumed && user) {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <Image 
                src="/logos/logo%20off.png" 
                alt="Bilibou Logo" 
                width={40} 
                height={40}
                className="h-10 w-auto"
              />
              <span className="text-xl font-semibold text-foreground">Bilibou</span>
            </Link>
          </div>
          {!isLoading && (
            <div className="flex items-center gap-4">
              {user ? (
                <Link href="/dashboard">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Tableau de bord
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost">Connexion</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button>Commencer gratuitement</Button>
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-5 overflow-hidden flex flex-col justify-start items-center py-12 md:py-20">
        <div className="max-w-7xl w-full">
          <div className="self-stretch relative flex flex-col justify-center items-center gap-2 py-0 mb-8">
            <div className="flex flex-col justify-start items-center gap-4">
              <h1 className="text-center text-foreground text-4xl md:text-5xl font-semibold leading-tight md:leading-[40px]">
                Des tarifs adaptés à toutes les entreprises
              </h1>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 justify-start items-start gap-4 md:gap-6">
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

          {/* FAQ Section */}
          <div className="mt-28 md:mt-40 lg:mt-48">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-3">
                Questions fréquentes
              </h2>
              <p className="text-muted-foreground text-sm">
                Tout ce que vous devez savoir sur nos plans
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-2">
              {/* FAQ Item 1 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Comment fonctionne la facturation ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Vous payez un abonnement mensuel ou annuel qui inclut un nombre de factures. Chaque plan a une limite mensuelle de factures incluses.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 2 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Puis-je changer de plan à tout moment ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. En cas d'upgrade, vous bénéficiez immédiatement des nouvelles fonctionnalités.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 3 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Que se passe-t-il si je dépasse mon quota de factures ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Si vous approchez de votre quota mensuel, vous recevrez une notification. Vous pouvez upgrader votre plan pour augmenter votre limite de factures.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 4 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Puis-je essayer Bilibou gratuitement ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Oui ! Tous nos plans incluent un essai gratuit de 7 jours, sans carte bancaire requise. Testez toutes les fonctionnalités avant de vous engager.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 5 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Combien de comptes e-mail puis-je connecter ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Cela dépend de votre plan : 1 compte pour Starter, 3 pour Pro, et 10 pour Business. Le plan Entreprise offre des comptes illimités.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 6 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Qu'est-ce qu'un espace de travail (organisation) ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Les espaces de travail permettent de séparer vos factures par entreprise. Disponible dès le plan Pro, invitez votre équipe et gérez les factures en collaboration.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 7 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Mes données sont-elles sécurisées ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Absolument. Toutes vos données sont chiffrées (SSL/TLS). Serveurs sécurisés en Europe, conformité RGPD. Vos factures ne sont jamais partagées.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 8 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Puis-je annuler mon abonnement à tout moment ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Oui, annulez à tout moment depuis votre tableau de bord. Vous conservez l'accès jusqu'à la fin de votre période payée. Exportez vos données avant la fin.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 9 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Quelle est la différence entre mensuel et annuel ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  L'annuel vous fait économiser 20%. Exemple : Pro à 79 €/mois en mensuel, ou 63 €/mois (756 €/an) en annuel. Facturé une fois par an.
                </p>
              </details>
              <div className="border-b border-border/50"></div>

              {/* FAQ Item 10 */}
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer list-none py-4 px-1 hover:text-foreground transition-colors">
                  <h3 className="text-base font-medium text-foreground">
                    Le plan Entreprise, c'est quoi exactement ?
                  </h3>
                  <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="pb-4 px-1 text-sm text-muted-foreground leading-relaxed">
                  Conçu pour les grands groupes : factures illimitées, infrastructure dédiée, SLA 99,9%, support 24/7 et développements sur mesure. Contactez-nous pour un devis.
                </p>
              </details>
            </div>
          </div>

          {/* CTA Final */}
          <div className="relative mt-24 md:mt-32 lg:mt-40 overflow-hidden rounded-2xl">
            {/* Blob vert flouté en arrière-plan - exactement comme la page d'accueil */}
            <div className="w-[547px] h-[400px] absolute top-[50px] left-[200px] origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[130px] z-0" />
            <div className="w-[600px] h-[450px] absolute top-[-50px] right-[100px] origin-top-right rotate-[25deg] bg-primary/8 blur-[150px] z-0" />

            {/* Content */}
            <div className="relative text-center px-8 py-12 md:py-16 z-10">
              <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-4">
                Prêt à automatiser votre comptabilité ?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto text-sm md:text-base">
                Rejoignez des centaines d'entreprises qui font confiance à Bilibou
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/signup">
                  <Button 
                    size="lg" 
                    className="text-white hover:opacity-90 px-8 font-semibold shadow-lg hover:shadow-xl transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                    }}
                  >
                    Commencer gratuitement
                  </Button>
                </Link>
                <Link href="mailto:contact@biliboo.fr">
                  <Button size="lg" variant="outline" className="border-2 border-border hover:bg-accent">
                    Contacter les ventes
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
