"use client"

import { Twitter, Github, Linkedin, Mail, Phone } from "lucide-react"
import Image from "next/image"

export function FooterSection() {
  return (
    <footer className="w-full max-w-[1320px] mx-auto px-5 flex flex-col md:flex-row justify-between items-start gap-8 md:gap-0 py-10 md:py-[70px]">
      {/* Left Section: Logo, Description, Social Links */}
      <div className="flex flex-col justify-start items-start gap-8 p-4 md:p-8">
        <div className="flex gap-3 items-stretch justify-center">
          <img 
            src="/logos/logo%20off.png" 
            alt="Biliboo Logo" 
            className="h-14 w-auto"
          />
        </div>
        <p className="text-foreground/90 text-sm font-medium leading-[18px] text-left">
          Automatisez votre gestion de factures avec l'IA. Extraction, catégorisation et organisation automatiques pour vous concentrer sur votre business.
        </p>
        <div className="flex justify-start items-start gap-3">
          <a href="mailto:contact@billiboo.fr" aria-label="Email" className="w-4 h-4 flex items-center justify-center">
            <Mail className="w-full h-full text-muted-foreground" />
          </a>
          <a href="https://twitter.com/billiboo" aria-label="Twitter" className="w-4 h-4 flex items-center justify-center">
            <Twitter className="w-full h-full text-muted-foreground" />
          </a>
          <a href="https://linkedin.com/company/billiboo" aria-label="LinkedIn" className="w-4 h-4 flex items-center justify-center">
            <Linkedin className="w-full h-full text-muted-foreground" />
          </a>
        </div>
      </div>
      {/* Right Section: Product, Company, Resources */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 p-4 md:p-8 w-full md:w-auto">
        <div className="flex flex-col justify-start items-start gap-3">
          <h3 className="text-muted-foreground text-sm font-medium leading-5">Produit</h3>
          <div className="flex flex-col justify-end items-start gap-2">
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Fonctionnalités
            </a>
            <a href="#pricing-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Tarifs
            </a>
            <a href="/dashboard" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Tableau de bord
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Intégrations Gmail/Outlook
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Export multi-format
            </a>
          </div>
        </div>
        <div className="flex flex-col justify-start items-start gap-3">
          <h3 className="text-muted-foreground text-sm font-medium leading-5">Entreprise</h3>
          <div className="flex flex-col justify-center items-start gap-2">
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              À propos
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Notre équipe
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Carrières
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Presse
            </a>
            <a href="mailto:contact@billiboo.fr" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Contact
            </a>
          </div>
        </div>
        <div className="flex flex-col justify-start items-start gap-3">
          <h3 className="text-muted-foreground text-sm font-medium leading-5">Support</h3>
          <div className="flex flex-col justify-center items-start gap-2">
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Conditions d'utilisation
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Politique de confidentialité
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Centre d'aide
            </a>
            <a href="#" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Documentation API
            </a>
            <a href="mailto:support@billiboo.fr" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Support technique
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
