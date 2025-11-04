import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
    
    // Créer un client Supabase directement avec les cookies de la requête
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Ne rien faire car on ne modifie pas les cookies ici
        },
        remove(name: string, options: CookieOptions) {
          // Ne rien faire car on ne modifie pas les cookies ici
        },
      },
    })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('🔍 Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      error: authError?.message || null,
      errorStatus: authError?.status || null
    })

    // Si l'utilisateur auth n'existe plus (partiellement supprimé lors d'un précédent essai),
    // on essaie de récupérer l'userId depuis le token JWT ou les cookies
    let userId: string | null = null
    
    if (user) {
      userId = user.id
      console.log('✅ Utilisateur authentifié:', userId)
    } else if (authError) {
      console.warn('⚠️ Erreur auth lors de la suppression:', authError.message)
      
      // Si l'erreur est "User from sub claim in JWT does not exist", cela signifie que
      // l'utilisateur auth a été supprimé mais la session existe encore côté client
      // Le JWT contient encore l'userId, on peut l'extraire pour supprimer les données restantes
      if (authError.message?.includes('does not exist') || authError.message?.includes('User not found')) {
        console.warn('⚠️ L\'utilisateur auth a été supprimé mais la session existe encore.')
        console.warn('   Tentative d\'extraction de l\'userId depuis le JWT...')
        
        try {
          // Essayer d'extraire l'userId depuis le JWT dans les cookies
          // Supabase SSR stocke le token dans plusieurs formats de cookies
          const cookieHeader = request.headers.get('cookie') || ''
          console.log('🔍 Cookies disponibles:', cookieHeader.substring(0, 200) + '...')
          
          // Chercher tous les cookies Supabase auth-token
          // Format: sb-{project-ref}-auth-token
          const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
          const authTokenCookieName = `sb-${projectRef}-auth-token`
          
          // Essayer plusieurs patterns de cookies
          const cookiePatterns = [
            new RegExp(`${authTokenCookieName}=([^;]+)`),
            /sb-[^=]+-auth-token=([^;]+)/,
            /sb-[^=]+-auth-token\.0=([^;]+)/,
            /sb-[^=]+-auth-token\.1=([^;]+)/,
          ]
          
          let accessToken: string | null = null
          
          for (const pattern of cookiePatterns) {
            const match = cookieHeader.match(pattern)
            if (match && match[1]) {
              accessToken = decodeURIComponent(match[1])
              console.log('✅ Token trouvé avec pattern:', pattern.toString())
              break
            }
          }
          
          // Si on n'a pas trouvé de token, essayer de lire directement depuis les cookies de la requête
          if (!accessToken) {
            const authTokenCookie = request.cookies.get(authTokenCookieName)
            if (authTokenCookie) {
              accessToken = authTokenCookie.value
              console.log('✅ Token trouvé via request.cookies.get')
            }
          }
          
          // Si on a un token, essayer de le parser
          if (accessToken) {
            try {
              // Le token peut être un objet JSON stringifié ou un JWT direct
              let tokenString = accessToken
              
              // Si c'est un objet JSON, le parser
              if (accessToken.startsWith('{')) {
                const tokenObj = JSON.parse(accessToken)
                tokenString = tokenObj.access_token || tokenObj.accessToken || accessToken
              }
              
              // Le token JWT a 3 parties séparées par des points
              const tokenParts = tokenString.split('.')
              if (tokenParts.length >= 2) {
                // Décoder le payload (partie 2 du JWT)
                // Base64url: remplacer - par + et _ par /
                let base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')
                // Ajouter le padding si nécessaire
                while (base64Payload.length % 4) {
                  base64Payload += '='
                }
                
                const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString())
                const userIdFromJWT = payload.sub || payload.user_id || payload.userId
                
                if (userIdFromJWT) {
                  console.log('✅ userId extrait depuis le JWT:', userIdFromJWT)
                  userId = userIdFromJWT
                } else {
                  console.warn('⚠️ Payload JWT trouvé mais pas de userId:', Object.keys(payload))
                }
              } else {
                console.warn('⚠️ Token n\'est pas un JWT valide (pas assez de parties)')
              }
            } catch (jwtError: any) {
              console.error('❌ Erreur lors du parsing du JWT:', jwtError.message)
              console.error('   Token (premiers 50 chars):', accessToken.substring(0, 50))
            }
          } else {
            console.warn('⚠️ Aucun token d\'accès trouvé dans les cookies')
            console.warn('   Cookies disponibles:', Object.keys(request.cookies.getAll()).join(', '))
          }
          
          // Si on n'a pas réussi à extraire l'userId depuis le JWT, essayer via le service role key
          if (!userId) {
            console.log('⚠️ Impossible d\'extraire userId depuis JWT, tentative via service role key...')
            
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
            const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
            
            if (supabaseServiceRoleKey && supabaseUrl) {
              // On ne peut pas vraiment trouver l'userId sans email ou autre identifiant
              // Mais on peut au moins informer l'utilisateur
              console.error('❌ Impossible de déterminer l\'userId pour supprimer les données restantes.')
              return NextResponse.json({ 
                error: 'L\'utilisateur auth a déjà été supprimé lors d\'un précédent essai.',
                message: 'Impossible de déterminer automatiquement quelles données supprimer. Les données restantes doivent être supprimées manuellement depuis Supabase Dashboard.',
                details: authError.message,
                suggestion: 'Allez dans Supabase Dashboard → Table Editor et supprimez manuellement les données restantes (invoices, workspaces, email_accounts, etc.) associées à votre compte.'
              }, { status: 401 })
            }
          }
        } catch (extractError) {
          console.error('❌ Erreur lors de l\'extraction de l\'userId:', extractError)
        }
        
        // Si on n'a toujours pas d'userId après toutes les tentatives
        if (!userId) {
          return NextResponse.json({ 
            error: 'L\'utilisateur auth a déjà été supprimé lors d\'un précédent essai.',
            message: 'Impossible de déterminer automatiquement quelles données supprimer. Les données restantes doivent être supprimées manuellement depuis Supabase Dashboard.',
            details: authError.message,
            suggestion: 'Allez dans Supabase Dashboard → Table Editor et supprimez manuellement les données restantes.'
          }, { status: 401 })
        }
      }
      
      // Autre type d'erreur d'authentification
      console.error('❌ Erreur d\'authentification:', authError)
      return NextResponse.json({ 
        error: 'Impossible d\'authentifier l\'utilisateur',
        details: authError.message 
      }, { status: 401 })
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

