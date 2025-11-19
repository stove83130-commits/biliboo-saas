"use client"

import Image from "next/image"

export function FooterSection() {
  return (
    <footer className="w-full max-w-[1320px] mx-auto px-5 flex flex-col pt-16 md:pt-24 pb-10 md:pb-[70px] relative overflow-hidden">
      {/* Taches vertes émeraude */}
      <div className="absolute top-10 left-0 w-[280px] h-[280px] bg-emerald-400/20 rounded-full blur-[100px] z-0" />
      <div className="absolute bottom-20 right-10 w-[260px] h-[260px] bg-emerald-300/15 rounded-full blur-[90px] z-0" />
      <div className="absolute top-1/2 left-1/3 w-[240px] h-[240px] bg-emerald-500/10 rounded-full blur-[85px] z-0" />
      <div className="absolute bottom-10 left-1/4 w-[220px] h-[220px] bg-emerald-400/15 rounded-full blur-[80px] z-0" />
      
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 md:gap-12 px-4 md:px-8 relative z-10">
        {/* Left Section: Logo, Description */}
        <div className="flex flex-col justify-start items-start gap-6 max-w-[320px]">
          <div className="flex gap-3 items-stretch">
            <Image 
              src="/logo_off__1_-removebg-preview.png" 
              alt="Bilibou Logo" 
              width={56}
              height={56}
              className="h-14 w-auto"
            />
          </div>
          <p className="text-foreground/90 text-sm font-medium leading-[18px] text-left">
            Automatisez votre gestion de factures avec l'IA. Extraction, catégorisation et organisation automatiques pour vous concentrer sur votre business.
          </p>
        </div>
        {/* Right Section: Links, Legal */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          <div className="flex flex-col justify-start items-start gap-2">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Liens</h3>
            <div className="flex flex-col items-start gap-2">
              <a href="/#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Fonctionnalités
              </a>
              <a href="/#pricing-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Tarifs
              </a>
              <a href="/#faq-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
                FAQ
              </a>
            </div>
          </div>
          <div className="flex flex-col justify-start items-start gap-2">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Légal</h3>
            <div className="flex flex-col items-start gap-2">
              <a href="/cgu" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Conditions Générales d'Utilisation
              </a>
              <a href="/cgv" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Conditions Générales de Vente
              </a>
              <a href="/mentions-legales" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Mentions légales
              </a>
              <a href="/politique-confidentialite" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Politique de confidentialité
              </a>
            </div>
          </div>
        </div>
      </div>
      {/* Copyright */}
      <div className="w-full px-4 md:px-8 mt-6 relative z-10">
        <p className="text-center text-muted-foreground text-sm">
          © 2025 Bilibou. Tous droits réservés.
        </p>
      </div>
    </footer>
  )
}
