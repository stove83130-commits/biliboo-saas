import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export default function OnboardingPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">Configuration initiale</h1>
        
        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Bienvenue dans Biliboo ! 🎉</h2>
            <p className="text-sm text-gray-600 mb-6">
              Configurez votre compte pour commencer à extraire automatiquement vos factures.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">1</span>
                </div>
                <div>
                  <h3 className="font-medium">Connecter votre Gmail</h3>
                  <p className="text-sm text-gray-600">Autorisez l'accès à vos emails pour l'extraction automatique</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-semibold">2</span>
                </div>
                <div>
                  <h3 className="font-medium">Configurer les catégories</h3>
                  <p className="text-sm text-gray-600">Personnalisez les catégories de dépenses</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-semibold">3</span>
                </div>
                <div>
                  <h3 className="font-medium">Lancer la première extraction</h3>
                  <p className="text-sm text-gray-600">Récupérez vos factures existantes</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <a 
                href="/dashboard/settings" 
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                🚀 Commencer la configuration
              </a>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}


