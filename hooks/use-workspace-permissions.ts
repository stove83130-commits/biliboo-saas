import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface WorkspacePermissions {
  role: WorkspaceRole | null
  isOwner: boolean
  isLoading: boolean
  
  // Permissions organisation
  canModifyOrganization: boolean
  canDeleteOrganization: boolean
  canViewBilling: boolean
  canManageBilling: boolean
  
  // Permissions membres
  canInviteMembers: boolean
  canRemoveMember: (targetUserId: string) => Promise<boolean>
  canModifyMemberRole: (targetUserId: string, newRole: string) => Promise<boolean>
  
  // Permissions factures
  canViewInvoices: boolean
  canManageInvoices: boolean
  
  // Permissions connexions
  canManageEmailConnections: boolean
  
  // Permissions statistiques
  canViewFullStatistics: boolean
  canViewActivityLogs: boolean
}

export function useWorkspacePermissions(workspaceId: string | null): WorkspacePermissions {
  const [role, setRole] = useState<WorkspaceRole | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!workspaceId || workspaceId === 'personal') {
      setIsLoading(false)
      return
    }

    const loadPermissions = async () => {
      try {
        // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null
        
        // Ignorer les erreurs de refresh token (normales pour les utilisateurs non connectés)
        if (authError && authError.code !== 'refresh_token_not_found' && authError.status !== 400) {
          console.error('Erreur récupération session workspace permissions:', authError)
        }
        
        if (!user) {
          setIsLoading(false)
          return
        }

        // Vérifier si l'utilisateur est le propriétaire
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id')
          .eq('id', workspaceId)
          .single() as { data: { owner_id: string } | null }

        if (workspace?.owner_id === user.id) {
          setRole('owner')
          setIsOwner(true)
          setIsLoading(false)
          return
        }

        // Sinon, vérifier dans workspace_members
        const { data: member } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single() as { data: { role: string } | null }

        setRole((member?.role as WorkspaceRole) || null)
        setIsOwner(false)
      } catch (error) {
        console.error('Erreur lors du chargement des permissions:', error)
        setRole(null)
        setIsOwner(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadPermissions()
  }, [workspaceId, supabase])

  // Pour un workspace personnel (workspaceId = null ou 'personal'), on a toujours toutes les permissions
  // Pour un workspace d'organisation, on vérifie le rôle
  const isPersonalWorkspace = !workspaceId || workspaceId === 'personal'
  
  const canModifyOrganization = isPersonalWorkspace ? true : (role === 'owner')
  const canDeleteOrganization = isPersonalWorkspace ? true : (role === 'owner')
  const canViewBilling = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin')
  const canManageBilling = isPersonalWorkspace ? true : (role === 'owner')
  const canInviteMembers = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin')
  const canViewInvoices = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin' || role === 'member')
  const canManageInvoices = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin' || role === 'member')
  const canManageEmailConnections = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin')
  const canViewFullStatistics = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin' || role === 'member')
  const canViewActivityLogs = isPersonalWorkspace ? true : (role === 'owner' || role === 'admin')

  const canRemoveMember = async (targetUserId: string): Promise<boolean> => {
    if (role === 'owner') return true
    if (role !== 'admin') return false

    // Admin ne peut pas supprimer le propriétaire ou d'autres admins
    try {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId!)
        .single() as { data: { owner_id: string } | null }

      if (workspace?.owner_id === targetUserId) return false

      const { data: targetMember } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId!)
        .eq('user_id', targetUserId)
        .single() as { data: { role: string } | null }

      if (targetMember?.role === 'admin') return false

      return true
    } catch {
      return false
    }
  }

  const canModifyMemberRole = async (targetUserId: string, newRole: string): Promise<boolean> => {
    if (role === 'owner') return true
    if (role !== 'admin') return false

    // Admin ne peut pas créer de propriétaire
    if (newRole === 'owner') return false

    // Admin ne peut pas modifier le propriétaire
    try {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId!)
        .single() as { data: { owner_id: string } | null }

      if (workspace?.owner_id === targetUserId) return false

      // Admin peut modifier les autres membres
      return true
    } catch {
      return false
    }
  }

  return {
    role,
    isOwner,
    isLoading,
    canModifyOrganization,
    canDeleteOrganization,
    canViewBilling,
    canManageBilling,
    canInviteMembers,
    canRemoveMember,
    canModifyMemberRole,
    canViewInvoices,
    canManageInvoices,
    canManageEmailConnections,
    canViewFullStatistics,
    canViewActivityLogs,
  }
}

