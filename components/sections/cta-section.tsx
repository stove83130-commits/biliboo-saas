import { Button } from "@/components/ui/button"
import { SmartCTAButton } from "@/components/ui/smart-cta-button"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="w-full pt-20 md:pt-60 lg:pt-60 pb-10 md:pb-20 px-5 relative flex flex-col justify-center items-center overflow-visible rounded-2xl my-6">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-emerald-100/60 via-emerald-50/30 to-white rounded-2xl" />

      {/* Decorative gradient orbs for smooth transition */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl z-0" />
      <div className="absolute top-20 right-1/4 w-80 h-80 bg-teal-200/15 rounded-full blur-3xl z-0" />

      <div className="relative z-10 flex flex-col justify-start items-center gap-9 max-w-4xl mx-auto">
        <div className="flex flex-col justify-start items-center gap-4 text-center">
          <h2 className="text-foreground text-3xl md:text-4xl lg:text-6xl font-semibold leading-tight break-words max-w-3xl">
            Pourquoi perdre encore des heures sur vos factures alors que l'IA peut tout faire pour vous ?
          </h2>
          <p className="text-muted-foreground text-sm md:text-base font-medium leading-[18.20px] md:leading-relaxed break-words max-w-2xl">
            Découvrez comment les entreprises gèrent leurs factures plus vite, collaborent sans friction et pilotent
            leur comptabilité en toute confiance grâce à la puissance de notre IA.
          </p>
        </div>
        <SmartCTAButton
          className="px-[30px] py-2 text-white text-base font-medium leading-6 rounded-[99px] shadow-[0px_0px_0px_4px_rgba(0,0,0,0.06)] hover:opacity-90 transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
          }}
          size="lg"
        >
          Commencez gratuitement
        </SmartCTAButton>
      </div>
    </section>
  )
}
