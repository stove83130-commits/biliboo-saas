import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = user.id

    console.log(`🗑️ Début de la suppression du compte pour l'utilisateur ${userId}`)

    // 1. Supprimer toutes les factures de l'utilisateur (tous workspaces)
    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .eq('user_id', userId)
    
    if (invoicesError) {
      console.error('❌ Erreur suppression factures:', invoicesError)
      return NextResponse.json({ error: 'Erreur lors de la suppression des factures' }, { status: 500 })
    }
    console.log('✅ Factures supprimées')

    // 2. Supprimer les jobs d'extraction
    const { error: jobsError } = await supabase
      .from('extraction_jobs')
      .delete()
      .eq('user_id', userId)
    
    if (jobsError) {
      console.error('❌ Erreur suppression jobs:', jobsError)
      // Continue même en cas d'erreur (table peut ne pas exister)
    } else {
      console.log('✅ Jobs d\'extraction supprimés')
    }

    // 3. Supprimer les comptes email connectés
    const { error: emailAccountsError } = await supabase
      .from('email_accounts')
      .delete()
      .eq('user_id', userId)
    
    if (emailAccountsError) {
      console.error('❌ Erreur suppression comptes email:', emailAccountsError)
      return NextResponse.json({ error: 'Erreur lors de la suppression des comptes email' }, { status: 500 })
    }
    console.log('✅ Comptes email supprimés')

    // 4. Récupérer les organisations dont l'utilisateur est propriétaire
    const { data: ownedWorkspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)

    if (ownedWorkspaces && ownedWorkspaces.length > 0) {
      const workspaceIds = ownedWorkspaces.map(ws => ws.id)

      // 4a. Supprimer les factures de ces organisations
      for (const workspaceId of workspaceIds) {
        await supabase.from('invoices').delete().eq('workspace_id', workspaceId)
      }

      // 4b. Supprimer les comptes email de ces organisations
      for (const workspaceId of workspaceIds) {
        await supabase.from('email_accounts').delete().eq('workspace_id', workspaceId)
      }

      // 4c. Supprimer les membres des organisations
      for (const workspaceId of workspaceIds) {
        await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId)
      }

      // 4d. Supprimer les invitations
      for (const workspaceId of workspaceIds) {
        await supabase.from('workspace_invites').delete().eq('workspace_id', workspaceId)
      }

      // 4e. Supprimer les organisations elles-mêmes
      const { error: workspacesError } = await supabase
        .from('workspaces')
        .delete()
        .in('id', workspaceIds)

      if (workspacesError) {
        console.error('❌ Erreur suppression organisations:', workspacesError)
      } else {
        console.log(`✅ ${workspaceIds.length} organisation(s) supprimée(s)`)
      }
    }

    // 5. Supprimer l'utilisateur des organisations où il est membre (mais pas propriétaire)
    const { error: membersError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('user_id', userId)
    
    if (membersError) {
      console.error('❌ Erreur suppression membres:', membersError)
    } else {
      console.log('✅ Membres supprimés')
    }

    // 6. Supprimer le profil utilisateur (si la table existe)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (profileError) {
      console.error('⚠️ Erreur suppression profil (table peut ne pas exister):', profileError)
    } else {
      console.log('✅ Profil supprimé')
    }

    // 7. Supprimer l'utilisateur dans auth.users via Admin API
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      
      if (supabaseServiceRoleKey && supabaseUrl) {
        const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
        
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        
        if (deleteUserError) {
          console.error('⚠️ Impossible de supprimer auth.users directement:', deleteUserError)
          console.log('ℹ️ Les données sont supprimées, mais l\'utilisateur auth peut nécessiter une suppression manuelle')
        } else {
          console.log('✅ Utilisateur auth supprimé')
        }
      } else {
        console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY non configuré - l\'utilisateur auth sera supprimé via triggers CASCADE si configurés')
      }
    } catch (adminError: any) {
      console.error('⚠️ Erreur lors de la suppression admin:', adminError)
      console.log('ℹ️ Les données sont supprimées, mais l\'utilisateur auth peut nécessiter une suppression manuelle')
    }

    console.log(`✅ Suppression complète terminée pour l'utilisateur ${userId}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Compte et toutes les données associées supprimés avec succès' 
    })

  } catch (error: any) {
    console.error('❌ Erreur globale lors de la suppression:', error)
    return NextResponse.json({ 
      error: error.message || 'Erreur lors de la suppression du compte' 
    }, { status: 500 })
  }
}

