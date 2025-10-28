"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, X } from "lucide-react"
import { useState } from "react"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const plans = [
    {
      id: "courier",
      name: "Courier Plan",
      price: "$19",
      period: "/mois",
      features: [
        "50 documents/mois",
        "1,000 emails analysés/mois",
        "Export basique (CSV, PDF)",
        "1 compte email",
        "Monitoring en temps réel",
        "Support WhatsApp"
      ],
      recommended: false
    },
    {
      id: "freight",
      name: "Freight Plan",
      price: "$49",
      period: "/mois",
      features: [
        "250 documents/mois",
        "5,000 emails analysés/mois",
        "Multi-comptes",
        "Organizations/équipes",
        "Intégrations QuickBooks/Xero",
        "Règles personnalisées",
        "Support prioritaire"
      ],
      recommended: true
    },
    {
      id: "enterprise",
      name: "Enterprise Plan",
      price: "Custom",
      period: " pricing",
      features: [
        "Volumes illimités",
        "Support dédié",
        "Personnalisation complète",
        "SLA garanti",
        "API access",
        "Intégrations custom"
      ],
      recommended: false
    }
  ]

  const handleUpgrade = () => {
    if (selectedPlan) {
      // Rediriger vers la page de paiement
      window.location.href = `/billing/checkout?plan=${selectedPlan}`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Choisissez votre plan Bilibou
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-3 mt-6">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`p-6 relative cursor-pointer transition-all ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-blue-500 border-blue-500' 
                  : 'hover:border-gray-300'
              } ${plan.recommended ? 'border-blue-500' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                    Recommandé
                  </span>
                </div>
              )}
              
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold">
                  {plan.price}
                  <span className="text-sm font-normal text-gray-600">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full"
                variant={selectedPlan === plan.id ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPlan(plan.id)
                }}
              >
                {selectedPlan === plan.id ? "Sélectionné" : "Choisir"}
              </Button>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fermer
          </Button>
          
          <Button 
            onClick={handleUpgrade}
            disabled={!selectedPlan}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Continuer avec {plans.find(p => p.id === selectedPlan)?.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


