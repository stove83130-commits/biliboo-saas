"use client"

import type React from "react"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqData = [
  {
    question: "Comment fonctionne l'extraction automatique de factures ?",
    answer:
      "Notre IA analyse vos emails Gmail et Outlook pour identifier automatiquement les factures et reçus. Elle extrait toutes les informations importantes : fournisseur, montant, date, numéro de facture, articles, TVA, etc. Tout se fait en quelques clics sans intervention manuelle.",
  },
  {
    question: "Quels types de factures peuvent être extraites ?",
    answer:
      "L'IA peut traiter tous types de factures : PDF, images (JPG, PNG), et même les emails HTML sans pièce jointe (Apple, Amazon, etc.). Elle reconnaît les factures françaises et internationales, avec ou sans TVA, et s'adapte à différents formats de présentation.",
  },
  {
    question: "Mes données sont-elles sécurisées ?",
    answer:
      "Absolument. Vos emails et factures sont traités de manière sécurisée avec un chiffrement de bout en bout. Nous utilisons les standards de sécurité les plus élevés et nous nous conformons au RGPD. Vos données ne sont jamais partagées avec des tiers.",
  },
  {
    question: "Puis-je modifier les données extraites ?",
    answer:
      "Oui ! Toutes les informations extraites sont directement éditables dans l'interface. Vous pouvez corriger, ajouter ou supprimer des données. Les modifications se sauvegardent automatiquement comme dans Google Docs.",
  },
  {
    question: "Comment fonctionne l'export vers Excel ?",
    answer:
      "Vous pouvez exporter toutes vos factures vers Excel avec un format professionnel. L'export inclut toutes les colonnes : fournisseur, montant, date, TVA, catégories, etc. Parfait pour votre comptabilité ou vos déclarations fiscales.",
  },
  {
    question: "L'IA peut-elle reconnaître les faux positifs ?",
    answer:
      "Oui, notre système est entraîné pour filtrer automatiquement les emails qui ne sont pas des vraies factures (newsletters, notifications, etc.). Il vérifie la présence d'un montant valide et applique des filtres intelligents pour éviter les erreurs.",
  },
  {
    question: "Que se passe-t-il si l'IA fait une erreur ?",
    answer:
      "Vous pouvez facilement corriger toute erreur directement dans l'interface. L'IA apprend aussi de vos corrections pour s'améliorer. En cas de problème, vous pouvez aussi relancer l'extraction ou contacter notre support.",
  },
  {
    question: "Puis-je connecter plusieurs comptes email ?",
    answer:
      "Oui, vous pouvez connecter plusieurs comptes Gmail et Outlook. L'IA analysera tous vos comptes simultanément pour extraire toutes vos factures, même si elles sont dispersées dans différentes boîtes mail.",
  },
]

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

const FAQItem = ({ question, answer, isOpen, onToggle }: FAQItemProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onToggle()
  }
  return (
    <div
      className={`w-full bg-muted shadow-[0px_2px_4px_rgba(0,0,0,0.06)] overflow-hidden rounded-[10px] outline outline-1 outline-border outline-offset-[-1px] transition-all duration-500 ease-out cursor-pointer`}
      onClick={handleClick}
    >
      <div className="w-full px-5 py-[18px] pr-4 flex justify-between items-center gap-5 text-left transition-all duration-300 ease-out">
        <div className="flex-1 text-foreground text-base font-medium leading-6 break-words">{question}</div>
        <div className="flex justify-center items-center">
          <ChevronDown
            className={`w-6 h-6 text-muted-foreground-dark transition-all duration-500 ease-out ${isOpen ? "rotate-180 scale-110" : "rotate-0 scale-100"}`}
          />
        </div>
      </div>
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
        style={{
          transitionProperty: "max-height, opacity, padding",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className={`px-5 transition-all duration-500 ease-out ${isOpen ? "pb-[18px] pt-2 translate-y-0" : "pb-0 pt-0 -translate-y-2"}`}
        >
          <div className="text-foreground/80 text-sm font-normal leading-6 break-words">{answer}</div>
        </div>
      </div>
    </div>
  )
}

export function FAQSection() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }
  return (
    <section id="faq-section" className="w-full pt-[66px] pb-20 md:pb-40 px-5 relative flex flex-col justify-center items-center">
      <div className="w-[300px] h-[500px] absolute top-[150px] left-1/2 -translate-x-1/2 origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[100px] z-0" />
      <div className="self-stretch pt-8 pb-8 md:pt-14 md:pb-14 flex flex-col justify-center items-center gap-2 relative z-10">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="w-full max-w-[435px] text-center text-foreground text-4xl font-semibold leading-10 break-words">
            Questions Fréquentes
          </h2>
          <p className="self-stretch text-center text-muted-foreground text-sm font-medium leading-[18.20px] break-words">
            Tout ce que vous devez savoir sur notre IA comptable et comment elle peut transformer votre gestion des factures
          </p>
        </div>
      </div>
      <div className="w-full max-w-[600px] pt-0.5 pb-10 flex flex-col justify-start items-start gap-4 relative z-10">
        {faqData.map((faq, index) => (
          <FAQItem key={index} {...faq} isOpen={openItems.has(index)} onToggle={() => toggleItem(index)} />
        ))}
      </div>
    </section>
  )
}
