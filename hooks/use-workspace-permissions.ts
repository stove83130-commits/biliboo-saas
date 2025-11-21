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
  // VERSION DÉSACTIVÉE TEMPORAIREMENT
  return {
    role: 'owner',
    isOwner: true,
    isLoading: false,
    canModifyOrganization: true,
    canDeleteOrganization: true,
    canViewBilling: true,
    canManageBilling: true,
    canInviteMembers: true,
    canRemoveMember: async () => true,
    canModifyMemberRole: async () => true,
    canViewInvoices: true,
    canManageInvoices: true,
    canManageEmailConnections: true,
    canViewFullStatistics: true,
    canViewActivityLogs: true,
  };
}
