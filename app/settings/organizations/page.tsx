"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Building2, Plus, Settings, Trash2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePlanPermissions } from "@/hooks/use-plan-permissions"

interface Organization {
  id: string
  name: string
  created_at: string
  member_count?: number
}

export default function OrganizationsSettingsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { canCreateOrg, isLoading: isLoadingPermissions } = usePlanPermissions()

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Récupérer toutes les organisations de l'utilisateur
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name, created_at')
        .eq('owner_id', user.id)
        .eq('type', 'organization')
        .order('created_at', { ascending: false })

      if (workspaces) {
        // Pour chaque organisation, compter les membres
        const orgsWithCounts = await Promise.all(
          workspaces.map(async (org) => {
            const { count } = await supabase
              .from('workspace_members')
              .select('*', { count: 'exact', head: true })
              .eq('workspace_id', org.id)
            
            return {
              ...org,
              member_count: count || 0
            }
          })
        )
        setOrganizations(orgsWithCounts)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des organisations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrganization = () => {
    if (!canCreateOrg) {
      alert('Vous devez avoir un plan actif pour créer des organisations. Veuillez choisir un plan dans les paramètres de facturation.')
      router.push('/settings/billing')
      return
    }
    router.push('/dashboard/settings/organization/new')
  }

  const handleManageOrganization = (orgId: string) => {
    router.push(`/settings/organizations/${orgId}`)
  }

  const handleDeleteOrganization = async (orgId: string, orgName: string) => {
    const confirmed = confirm(
      `⚠️ ATTENTION ⚠️\n\n` +
      `Vous êtes sur le point de supprimer l'organisation "${orgName}".\n\n` +
      `Cette action supprimera :\n` +
      `• Toutes les factures de l'organisation\n` +
      `• Tous les membres\n` +
      `• Tous les paramètres\n\n` +
      `Cette action est IRRÉVERSIBLE.\n\n` +
      `Êtes-vous absolument certain de vouloir continuer ?`
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', orgId)

      if (error) throw error

      // Recharger la liste
      await loadOrganizations()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert('❌ Impossible de supprimer l\'organisation')
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-foreground">Organisations</h1>
          <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Organisations</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gérez vos organisations et leurs membres
          </p>
        </div>
        <Button 
          onClick={handleCreateOrganization} 
          disabled={isLoadingPermissions || !canCreateOrg}
          className="gap-2 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
          }}
        >
          <Plus className="h-4 w-4" />
          Créer une organisation
        </Button>
      </div>

      {organizations.length === 0 ? (
        <div className="p-6 border-0 shadow-none bg-accent/30 rounded-lg text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-base font-medium mb-2">Aucune organisation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Créez votre première organisation pour collaborer avec votre équipe
          </p>
          <Button 
            onClick={handleCreateOrganization} 
            disabled={isLoadingPermissions || !canCreateOrg}
            className="gap-2 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
            }}
          >
            <Plus className="h-4 w-4" />
            Créer une organisation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="p-4 rounded-lg border-0 bg-accent/30 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-foreground mb-1">
                      {org.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{org.member_count} membre{org.member_count !== 1 ? 's' : ''}</span>
                      </div>
                      <span>•</span>
                      <span>
                        Créée le {new Date(org.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManageOrganization(org.id)}
                    className="gap-2 border-border/30 hover:bg-accent"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Gérer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOrganization(org.id, org.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

