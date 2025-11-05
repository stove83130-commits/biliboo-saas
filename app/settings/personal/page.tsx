"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Check, Edit3 } from "lucide-react"

export default function PersonalSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
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
              <Button 
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Supprimer mon compte
              </Button>
              
              {/* Première modale de confirmation */}
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-red-600">⚠️ ATTENTION ⚠️</DialogTitle>
                    <DialogDescription className="pt-4 space-y-3">
                      <p className="font-medium">Vous êtes sur le point de supprimer définitivement votre compte.</p>
                      <p>Cette action supprimera :</p>
                      <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                        <li>Toutes vos factures</li>
                        <li>Vos comptes e-mail connectés</li>
                        <li>Vos organisations (si vous en êtes propriétaire)</li>
                        <li>Vos paramètres et préférences</li>
                        <li>Votre abonnement</li>
                      </ul>
                      <p className="font-semibold text-red-600">Cette action est IRRÉVERSIBLE.</p>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        setIsDeleteDialogOpen(false)
                        setIsConfirmDialogOpen(true)
                      }}
                    >
                      Je comprends, continuer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Deuxième modale de confirmation finale */}
              <Dialog open={isConfirmDialogOpen} onOpenChange={(open) => {
                setIsConfirmDialogOpen(open)
                if (!open) setConfirmText('') // Réinitialiser si fermée
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-red-600">DERNIÈRE CONFIRMATION</DialogTitle>
                    <DialogDescription className="pt-4 space-y-4">
                      <p>Pour confirmer la suppression définitive de votre compte, vous devez taper <strong>"SUPPRIMER"</strong> exactement comme indiqué ci-dessous.</p>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Tapez "SUPPRIMER" pour confirmer :
                        </label>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="SUPPRIMER"
                          className="w-full px-3 py-2 border border-border rounded-md bg-background"
                          autoFocus
                        />
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => {
                      setIsConfirmDialogOpen(false)
                      setConfirmText('')
                    }}>
                      Annuler
                    </Button>
                    <Button 
                      variant="destructive" 
                      disabled={isDeleting || confirmText !== 'SUPPRIMER'}
                      onClick={async () => {
                        if (confirmText !== 'SUPPRIMER') return
                        
                        setIsDeleting(true)
                        
                        // Désactiver temporairement les listeners d'erreurs pour éviter les erreurs pendant la suppression
                        const originalErrorHandler = window.onerror
                        window.onerror = () => true // Ignorer les erreurs pendant la suppression
                        
                        try {
                          const response = await fetch('/api/user/delete', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                          })
                          
                          const result = await response.json()
                          
                          if (response.ok) {
                            setIsConfirmDialogOpen(false)
                            setConfirmText('')
                            
                            // Déconnecter la session Supabase côté client
                            // L'utilisateur auth.users est déjà supprimé par l'API avec le service role key
                            try {
                              const supabase = createClient()
                              await supabase.auth.signOut()
                              console.log('✅ Session déconnectée')
                            } catch (signOutError) {
                              console.warn('⚠️ Erreur lors de la déconnexion (non bloquant):', signOutError)
                            }
                            
                            // Restaurer le gestionnaire d'erreurs
                            if (originalErrorHandler) {
                              window.onerror = originalErrorHandler
                            } else {
                              window.onerror = null
                            }
                            
                            // Rediriger immédiatement vers la page de login
                            // Utiliser window.location.replace pour éviter que l'utilisateur puisse revenir en arrière
                            window.location.replace('/auth/login?deleted=true')
                          } else {
                            // Restaurer le gestionnaire d'erreurs
                            if (originalErrorHandler) {
                              window.onerror = originalErrorHandler
                            } else {
                              window.onerror = null
                            }
                            setIsDeleting(false)
                            alert('❌ Erreur : ' + (result.error || 'Impossible de supprimer le compte'))
                          }
                        } catch (error: any) {
                          console.error('Erreur suppression:', error)
                          // Restaurer le gestionnaire d'erreurs en cas d'erreur
                          if (originalErrorHandler) {
                            window.onerror = originalErrorHandler
                          } else {
                            window.onerror = null
                          }
                          setIsDeleting(false)
                          alert('❌ Erreur lors de la suppression : ' + (error.message || 'Erreur inconnue'))
                        }
                      }}
                    >
                      {isDeleting ? 'Suppression en cours...' : 'Supprimer définitivement mon compte'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


