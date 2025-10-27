import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
// Widget d'usage retiré temporairement

export default function DashboardPage({
  searchParams,
}: {
  searchParams: { success?: string }
}) {
    return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Message de succès du paiement */}
        {searchParams.success === 'true' && (
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
                  <p>Votre essai gratuit de 7 jours a commencé. Bienvenue dans Biliboo !</p>
            </div>
          </div>
        </div>
                    </div>
                  )}

        {/* Module d'onboarding */}
        <DashboardOnboarding />
                </div>
    </DashboardLayout>
  )
}
