"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Crown, Zap } from "lucide-react"

export function GlobalPlanBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Vérifier si la bannière a été fermée
    const dismissed = localStorage.getItem('plan-banner-dismissed')
    if (!dismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem('plan-banner-dismissed', 'true')
  }

  const handleUpgrade = () => {
    window.location.href = '/plans'
  }

  if (!isVisible || isDismissed) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                🚀 <strong>Biliboo</strong> - Extraction automatique de factures
              </p>
              <p className="text-xs opacity-90">
                Connectez votre Gmail et commencez à extraire vos factures en quelques clics
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleUpgrade}
              size="sm"
              className="bg-white text-blue-600 hover:bg-gray-100 text-xs px-3 py-1"
            >
              <Zap className="h-3 w-3 mr-1" />
              Commencer
            </Button>
            
            <button
              onClick={handleDismiss}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


