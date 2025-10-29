import { SupabaseClient } from '@supabase/supabase-js'

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface UserWorkspaceRole {
  role: WorkspaceRole | null
  isOwner: boolean
}

/**
 * Récupère le rôle d'un utilisateur dans un workspace
 */
export async function getUserWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<UserWorkspaceRole> {
  // Vérifier si l'utilisateur est le propriétaire du workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single()

  if (workspace?.owner_id === userId) {
    return { role: 'owner', isOwner: true }
  }

  // Sinon, vérifier dans workspace_members
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  return {
    role: (member?.role as WorkspaceRole) || null,
    isOwner: false
  }
}

/**
 * Vérifie si un utilisateur peut modifier l'organisation
 */
export async function canModifyOrganization(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner'
}

/**
 * Vérifie si un utilisateur peut supprimer l'organisation
 */
export async function canDeleteOrganization(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner'
}

/**
 * Vérifie si un utilisateur peut gérer la facturation
 */
export async function canManageBilling(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner'
}

/**
 * Vérifie si un utilisateur peut inviter des membres
 */
export async function canInviteMembers(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin'
}

/**
 * Vérifie si un utilisateur peut supprimer un membre spécifique
 */
export async function canRemoveMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  targetUserId: string
): Promise<boolean> {
  const userRole = await getUserWorkspaceRole(supabase, workspaceId, userId)
  
  // Propriétaire peut supprimer n'importe qui
  if (userRole.role === 'owner') {
    return true
  }

  // Admin peut supprimer sauf propriétaire et autres admins
  if (userRole.role === 'admin') {
    // Vérifier si la cible est propriétaire
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single()
    
    if (workspace?.owner_id === targetUserId) {
      return false
    }

    // Vérifier si la cible est admin
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .single()

    if (targetMember?.role === 'admin') {
      return false
    }

    return true
  }

  return false
}

/**
 * Vérifie si un utilisateur peut modifier le rôle d'un membre
 */
export async function canModifyMemberRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  targetUserId: string,
  newRole: string
): Promise<boolean> {
  const userRole = await getUserWorkspaceRole(supabase, workspaceId, userId)
  
  // Propriétaire peut modifier tous les rôles
  if (userRole.role === 'owner') {
    return true
  }

  // Admin peut modifier les rôles (mais pas créer de propriétaire)
  if (userRole.role === 'admin') {
    // Vérifier si la cible est propriétaire
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single()
    
    if (workspace?.owner_id === targetUserId) {
      return false // Ne peut pas modifier le propriétaire
    }

    // Ne peut pas créer de propriétaire
    if (newRole === 'owner') {
      return false
    }

    // Ne peut pas modifier d'autres admins (sauf pour les rétrograder)
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .single()

    if (targetMember?.role === 'admin' && newRole !== 'member') {
      return false
    }

    return true
  }

  return false
}

/**
 * Vérifie si un utilisateur peut gérer les connexions email (Gmail/Outlook)
 */
export async function canManageEmailConnections(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin'
}

/**
 * Vérifie si un utilisateur peut voir les paramètres de l'organisation
 */
export async function canViewOrganizationSettings(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin' || role === 'member'
}

/**
 * Vérifie si un utilisateur peut voir l'abonnement
 */
export async function canViewBilling(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin'
}

/**
 * Vérifie si un utilisateur peut voir toutes les factures
 */
export async function canViewInvoices(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin' || role === 'member'
}

/**
 * Vérifie si un utilisateur peut modifier/supprimer des factures
 */
export async function canManageInvoices(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin' || role === 'member'
}

/**
 * Vérifie si un utilisateur peut voir les statistiques complètes
 */
export async function canViewFullStatistics(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin' || role === 'member'
}

/**
 * Vérifie si un utilisateur peut voir les logs d'activité
 */
export async function canViewActivityLogs(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role === 'owner' || role === 'admin'
}

/**
 * Vérifie si un utilisateur a accès au workspace
 */
export async function hasWorkspaceAccess(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { role } = await getUserWorkspaceRole(supabase, workspaceId, userId)
  return role !== null
}

