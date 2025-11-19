import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">Aide et Support</h1>
        
        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Comment utiliser Bilibou</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">1. Connecter votre Gmail</h3>
                <p className="text-sm text-gray-600">
                  Allez dans les paramètres et connectez votre compte Gmail pour commencer l'extraction automatique.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">2. Lancer une extraction</h3>
                <p className="text-sm text-gray-600">
                  Utilisez la page d'extraction pour récupérer vos factures sur une période donnée.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">3. Consulter vos factures</h3>
                <p className="text-sm text-gray-600">
                  Toutes vos factures sont automatiquement organisées et catégorisées.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Support</h2>
            <p className="text-sm text-gray-600 mb-4">
              Si vous rencontrez des problèmes, n'hésitez pas à nous contacter.
            </p>
            <div className="flex gap-4">
              <a 
                href="mailto:support@receiptor.ai" 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📧 Email Support
              </a>
              <a 
                href="/contact" 
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                💬 Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

