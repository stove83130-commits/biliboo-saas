import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    // Ajouter des logs pour debug
    console.log('🔍 DELETE /api/user/delete - Headers:', {
      cookie: request.headers.get('cookie') ? 'present' : 'missing',
      authorization: request.headers.get('authorization') ? 'present' : 'missing',
      userAgent: request.headers.get('user-agent')?.substring(0, 50)
    })
    
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('🔍 Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      error: authError?.message || null,
      errorStatus: authError?.status || null
    })

    // Si l'utilisateur auth n'existe plus (partiellement supprimé lors d'un précédent essai),
    // on essaie de récupérer l'userId depuis le JWT directement
    let userId: string | null = null
    
    if (user) {
      userId = user.id
    } else if (authError) {
      console.warn('⚠️ Erreur auth lors de la suppression:', authError.message)
      
      // Essayer de récupérer l'userId depuis le token JWT dans les cookies
      try {
        const cookies = request.headers.get('cookie') || ''
        // Le token est dans un cookie Supabase, on peut essayer de le parser
        // Mais pour l'instant, on retourne une erreur si on ne peut pas authentifier
        console.error('❌ Impossible d\'authentifier l\'utilisateur. L\'utilisateur auth a peut-être déjà été supprimé.')
        console.error('   Erreur détaillée:', authError)
        return NextResponse.json({ 
          error: 'Impossible d\'authentifier l\'utilisateur. Si vous avez déjà tenté de supprimer votre compte, l\'utilisateur peut avoir été partiellement supprimé.',
          details: authError.message 
        }, { status: 401 })
      } catch (parseError) {
        return NextResponse.json({ 
          error: 'Impossible d\'authentifier l\'utilisateur',
          details: authError.message 
        }, { status: 401 })
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

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

    // 4. Récupérer TOUTES les organisations dont l'utilisateur est propriétaire (y compris le workspace personnel)
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

    // 7. NE PAS supprimer l'utilisateur auth.users immédiatement
    // Cela invalide la session et cause des erreurs 401/403 pour les composants qui chargent encore des données
    // L'utilisateur auth sera supprimé par le client après déconnexion de la session, ou via un trigger CASCADE
    // Si SUPABASE_SERVICE_ROLE_KEY est configuré, on peut le supprimer mais avec un délai pour laisser le client se déconnecter
    console.log('⚠️ IMPORTANT: L\'utilisateur auth.users n\'est PAS supprimé immédiatement pour éviter les erreurs de session')
    console.log('ℹ️ Les données sont toutes supprimées. L\'utilisateur auth sera supprimé:')
    console.log('   1. Par le client après déconnexion de la session (recommandé)')
    console.log('   2. Via un trigger CASCADE si configuré dans Supabase')
    console.log('   3. Ou manuellement si nécessaire')
    
    // Optionnel: Supprimer l'utilisateur auth avec un délai (si vraiment nécessaire)
    // Mais cela peut toujours causer des problèmes si le client charge encore des données
    const shouldDeleteAuthUser = process.env.DELETE_AUTH_USER_IMMEDIATELY === 'true'
    
    if (shouldDeleteAuthUser) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        
        if (supabaseServiceRoleKey && supabaseUrl) {
          // Attendre un peu pour laisser le client se déconnecter
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          })
          
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
          
          if (deleteUserError) {
            console.error('⚠️ Impossible de supprimer auth.users directement:', deleteUserError)
          } else {
            console.log('✅ Utilisateur auth supprimé (avec délai)')
          }
        }
      } catch (adminError: any) {
        console.error('⚠️ Erreur lors de la suppression admin:', adminError)
      }
    }

    console.log(`✅ Suppression complète terminée pour l'utilisateur ${userId}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Compte et toutes les données associées supprimés avec succès',
      note: 'L\'utilisateur auth sera supprimé après déconnexion de la session pour éviter les erreurs'
    })

  } catch (error: any) {
    console.error('❌ Erreur globale lors de la suppression:', error)
    return NextResponse.json({ 
      error: error.message || 'Erreur lors de la suppression du compte' 
    }, { status: 500 })
  }
}

