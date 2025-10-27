"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ChevronDown, Building2, User, Plus, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Workspace {
  id: string
  name: string
  type: 'personal' | 'organization'
}

export function WorkspaceSwitcher() {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>({
    id: 'personal',
    name: 'Espace personnel',
    type: 'personal'
  })

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    try {
      setLoading(true)
      console.log('🔍 Chargement des workspaces...')
      const response = await fetch('/api/workspaces')
      
      if (!response.ok) {
        console.error('❌ Erreur chargement workspaces, status:', response.status)
        return
      }

      const data = await response.json()
      console.log('✅ Workspaces reçus:', data)
      console.log('📊 Nombre de workspaces:', data.workspaces?.length)
      
      setWorkspaces(data.workspaces || [])

      // Charger le workspace actif depuis localStorage
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      console.log('🔑 Active workspace ID:', activeWorkspaceId)

      if (activeWorkspaceId) {
        const activeWorkspace = data.workspaces?.find((w: Workspace) => w.id === activeWorkspaceId)
        if (activeWorkspace) {
          console.log('✅ Workspace actif trouvé:', activeWorkspace.name)
          setCurrentWorkspace(activeWorkspace)
        }
      } else if (data.workspaces?.length > 0) {
        // Par défaut, sélectionner le premier workspace (normalement l'espace personnel)
        console.log('📌 Sélection du premier workspace par défaut:', data.workspaces[0].name)
        setCurrentWorkspace(data.workspaces[0])
        if (typeof window !== 'undefined') {
          localStorage.setItem('active_workspace_id', data.workspaces[0].id)
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWorkspaceChange = (workspace: Workspace) => {
    setCurrentWorkspace(workspace)
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_workspace_id', workspace.id)
      // Déclencher un événement pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('workspace:changed', { detail: workspace }))
      // Recharger la page pour mettre à jour les données
      window.location.reload()
    }
  }

  const handleCreateWorkspace = () => {
    router.push('/dashboard/settings/organization/new')
  }

  const handleOpenSettings = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation() // Empêcher le changement de workspace
    if (workspace.type === 'personal') {
      router.push('/settings/personal')
    } else {
      router.push(`/settings/organizations/${workspace.id}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto">
          {currentWorkspace.type === 'personal' ? (
            <User className="h-4 w-4" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="font-medium">{currentWorkspace.name}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {loading ? (
          <DropdownMenuItem disabled>
            <span className="text-sm text-gray-500">Chargement...</span>
          </DropdownMenuItem>
        ) : workspaces.length === 0 ? (
          <DropdownMenuItem disabled>
            <span className="text-sm text-gray-500">Aucun espace</span>
          </DropdownMenuItem>
        ) : (
          <>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceChange(workspace)}
                className="flex items-center gap-2 justify-between"
              >
                <div className="flex items-center gap-2">
                  {workspace.type === 'personal' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  <span>{workspace.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {workspace.id === currentWorkspace.id && (
                    <span className="text-green-600">✓</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleOpenSettings(workspace, e)}
                    className="h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    <Settings className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleCreateWorkspace}
              className="flex items-center gap-2 text-green-600"
            >
              <Plus className="h-4 w-4" />
              <span>Créer une organisation</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


