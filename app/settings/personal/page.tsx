"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Check, Edit3 } from "lucide-react"

export default function PersonalSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    language: 'Français',
    timezone: 'Europe/Paris'
  })

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Erreur lors de la récupération des données utilisateur:', error)
        } else {
          setUser(user)
          setFormData({
            full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
            email: user?.email || '',
            language: 'Français',
            timezone: 'Europe/Paris'
          })
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  const handleSave = async (field: string) => {
    try {
      const supabase = createClient()
      
      if (field === 'full_name') {
        await supabase.auth.updateUser({
          data: { full_name: formData.full_name }
        })
      }
      
      setEditing(null)
      // Recharger les données utilisateur
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
    }
  }

  const EditableField = ({ field, label, value, type = 'text' }: { field: string, label: string, value: string, type?: string }) => (
    <div className="group">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center mt-1">
        {editing === field ? (
          <>
            <input
              type={type}
              value={formData[field as keyof typeof formData]}
              onChange={(e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
              className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary flex-1"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSave(field)}
              className="h-6 w-6 p-0 ml-1"
            >
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(null)}
              className="h-6 w-6 p-0 ml-1"
            >
              ×
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm flex-1">{value || 'Non renseigné'}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(field)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-foreground">Paramètres personnels</h1>
          <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-foreground">Paramètres personnels</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Gérez vos informations personnelles
        </p>
      </div>
      <div className="space-y-8">
        <div className="p-6 border-0 shadow-none bg-accent/30 rounded-lg">
          <h2 className="text-lg font-medium text-foreground mb-6">Informations du compte</h2>
          <div className="space-y-4">
            <EditableField 
              field="full_name" 
              label="Nom complet" 
              value={user?.user_metadata?.full_name || user?.user_metadata?.name || ''} 
            />
            <EditableField 
              field="email" 
              label="Adresse e-mail" 
              value={user?.email || ''} 
              type="email"
            />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date de création</label>
              <p className="text-sm mt-1">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Non disponible'}
              </p>
            </div>
          </div>
        </div>

        {/* Zone de danger */}
        <div className="p-6 border-0 shadow-none bg-red-50/50 rounded-lg">
          <h2 className="text-lg font-medium text-red-800 mb-6">Zone de danger</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-red-800">Supprimer définitivement mon compte</h3>
              <p className="text-sm text-red-700 mt-1 mb-3">
                Cette action est irréversible. Toutes vos données, factures et paramètres seront définitivement supprimés.
              </p>
              <button 
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                onClick={async () => {
                  const confirmed = confirm(
                    '⚠️ ATTENTION ⚠️\n\n' +
                    'Vous êtes sur le point de supprimer définitivement votre compte.\n\n' +
                    'Cette action supprimera :\n' +
                    '• Toutes vos factures\n' +
                    '• Vos comptes e-mail connectés\n' +
                    '• Vos organisations (si vous en êtes propriétaire)\n' +
                    '• Vos paramètres et préférences\n' +
                    '• Votre abonnement\n\n' +
                    'Cette action est IRRÉVERSIBLE.\n\n' +
                    'Êtes-vous absolument certain de vouloir continuer ?'
                  )
                  if (confirmed) {
                    const doubleConfirmed = confirm(
                      'DERNIÈRE CONFIRMATION\n\n' +
                      'Tapez "SUPPRIMER" dans votre tête et cliquez OK pour confirmer la suppression définitive de votre compte.'
                    )
                    if (doubleConfirmed) {
                      try {
                        const response = await fetch('/api/user/delete', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' }
                        })
                        const result = await response.json()
                        
                        if (response.ok) {
                          alert('✅ Votre compte et toutes vos données ont été supprimés avec succès. Vous allez être redirigé.')
                          // Rediriger vers la page de login après 2 secondes
                          setTimeout(() => {
                            window.location.href = '/auth/login'
                          }, 2000)
                        } else {
                          alert('❌ Erreur : ' + (result.error || 'Impossible de supprimer le compte'))
                        }
                      } catch (error: any) {
                        console.error('Erreur suppression:', error)
                        alert('❌ Erreur lors de la suppression : ' + (error.message || 'Erreur inconnue'))
                      }
                    }
                  }
                }}
              >
                Supprimer mon compte
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


