"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
import { PaymentSyncHandler } from "@/components/dashboard/payment-sync-handler"
import { PlanLimitModal } from "@/components/dashboard/plan-limit-modal"
// Widget d'usage retiré temporairement

function DashboardPageContent() {
  const searchParams = useSearchParams()
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitFeature, setLimitFeature] = useState<'email' | 'organization' | 'invoice'>('email')

  useEffect(() => {
    const error = searchParams?.get('error')
    const feature = searchParams?.get('feature')
    
    if (error === 'plan_limit_reached' && feature) {
      // Déterminer le type de feature
      if (feature === 'email') {
        setLimitFeature('email')
      } else if (feature === 'organization') {
        setLimitFeature('organization')
      } else if (feature === 'invoice') {
        setLimitFeature('invoice')
      }
      setShowLimitModal(true)
      
      // Nettoyer l'URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('error')
        url.searchParams.delete('feature')
        window.history.replaceState({}, '', url.pathname + url.search)
      }
    }
  }, [searchParams])

  return (
    <DashboardLayout>
      <PaymentSyncHandler />
      <div className="flex flex-col gap-6">
        {/* Message de succès du paiement */}
        {searchParams?.get('success') === 'true' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Paiement réussi ! 🎉
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Votre essai gratuit de 7 jours a commencé. Bienvenue dans Bilibou !</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Module d'onboarding */}
        <DashboardOnboarding />
      </div>

      {/* Modal de limite de plan */}
      <PlanLimitModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        feature={limitFeature}
      />
    </DashboardLayout>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    }>
      <DashboardPageContent />
    </Suspense>
  )
}
