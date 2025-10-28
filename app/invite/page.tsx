import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export default function InvitePage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">Inviter des utilisateurs</h1>
        
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Inviter votre équipe</h2>
          <p className="text-sm text-gray-600 mb-6">
            Invitez des membres de votre équipe à rejoindre votre espace de travail Bilibou.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email de l'invité</label>
              <input 
                type="email" 
                placeholder="colleague@company.com"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Message (optionnel)</label>
              <textarea 
                placeholder="Bonjour, je t'invite à rejoindre notre espace de travail Bilibou..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              📧 Envoyer l'invitation
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Invitations en attente</h2>
          <p className="text-sm text-gray-600">
            Aucune invitation en attente pour le moment.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}

