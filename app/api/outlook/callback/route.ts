import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractCleanEmailFromProfile } from '@/utils/email-cleaner'


export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=outlook_connection_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=no_code`)
  }

  const supabase = createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  // Récupérer le workspace_id depuis les paramètres de requête (comme Gmail)
  const state = searchParams.get('state') || ''
  const stateParams = new URLSearchParams(state)
  let workspaceId = stateParams.get('workspaceId') || null

  // IMPORTANT: Pour un workspace personnel, on met toujours workspace_id à null
  // Vérifier si c'est un workspace personnel en vérifiant le type depuis la DB
  // Si workspaceId est 'personal', vide, ou si c'est un workspace personnel, on met null
  // STRATÉGIE: Par défaut, considérer comme personnel (workspace_id = null) sauf si on peut prouver que c'est une organisation
  if (workspaceId === 'personal' || workspaceId?.trim() === '' || !workspaceId) {
    workspaceId = null
    console.log('✅ [OUTLOOK] Workspace personnel détecté (personal/vide/null), workspace_id = null')
  } else if (workspaceId) {
    // Si workspaceId est fourni, vérifier si c'est un workspace personnel
    // Utiliser directement Supabase pour vérifier le type
    try {
      console.log('🔍 [OUTLOOK] Vérification type workspace pour ID:', workspaceId)
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('type')
        .eq('id', workspaceId)
        .eq('owner_id', user.id)
        .single()
      
      if (!workspaceError && workspace) {
        if (workspace.type === 'personal') {
          console.log('✅ [OUTLOOK] Workspace personnel détecté via DB, workspace_id = null')
          workspaceId = null
        } else {
          console.log('✅ [OUTLOOK] Workspace organisation détecté, workspace_id =', workspaceId)
          // Garder le workspaceId pour les organisations
        }
      } else {
        // Workspace non trouvé ou erreur, considérer comme personnel par défaut
        console.log('⚠️ [OUTLOOK] Workspace non trouvé ou erreur DB, considéré comme personnel (workspace_id = null)')
        workspaceId = null
      }
    } catch (error) {
      console.warn('⚠️ [OUTLOOK] Erreur lors de la vérification du type de workspace:', error)
      // En cas d'erreur, considérer comme personnel par défaut (sécurité)
      workspaceId = null
    }
  }
  
  console.log('📋 [OUTLOOK] Workspace ID final pour sauvegarde:', workspaceId)

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/outlook/callback`
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Microsoft token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        clientId: clientId,
        redirectUri: redirectUri,
        tenantId: tenantId
      })
      throw new Error(`Failed to exchange code for tokens: ${tokenResponse.status} ${errorText}`)
    }

    const tokens = await tokenResponse.json()

    // Get user profile
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!profileResponse.ok) {
      throw new Error('Failed to get user profile')
    }

    const profile = await profileResponse.json()

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Extraire seulement l'email propre, pas le nom d'affichage complet
    const userEmail = extractCleanEmailFromProfile(profile)

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'outlook')
      .eq('email', userEmail)
      .single()

    let dbError = null

    if (existingAccount) {
      // Update existing account
      const { error } = await supabase
        .from('email_accounts')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          workspace_id: workspaceId,
        })
        .eq('id', existingAccount.id)
      
      dbError = error
      if (dbError) {
        console.error('❌ [OUTLOOK] Erreur UPDATE compte existant:', {
          error: dbError,
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          accountId: existingAccount.id,
          workspaceId: workspaceId
        })
      }
    } else {
      // Insert new account
      const insertData = {
        user_id: user.id,
        provider: 'outlook',
        email: userEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        is_active: true,
        workspace_id: workspaceId,
      }
      
      console.log('🔍 [OUTLOOK] Tentative INSERT avec données:', {
        ...insertData,
        access_token: insertData.access_token ? '[REDACTED]' : null,
        refresh_token: insertData.refresh_token ? '[REDACTED]' : null,
      })
      
      const { error } = await supabase
        .from('email_accounts')
        .insert(insertData)
      
      dbError = error
      if (dbError) {
        console.error('❌ [OUTLOOK] Erreur INSERT nouveau compte:', {
          error: dbError,
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          insertData: {
            ...insertData,
            access_token: '[REDACTED]',
            refresh_token: '[REDACTED]',
          }
        })
      }
    }

    if (dbError) {
      console.error('❌ [OUTLOOK] Erreur base de données complète:', JSON.stringify(dbError, null, 2))
      
      // Si l'erreur indique qu'une colonne n'existe pas, donner un message plus clair
      if (dbError.code === '42703' || dbError.message?.includes('column') || dbError.message?.includes('does not exist')) {
        console.error('❌ [OUTLOOK] COLONNE MANQUANTE DÉTECTÉE!')
        console.error('❌ [OUTLOOK] Exécutez cette migration SQL dans Supabase:')
        console.error(`
-- Migration pour ajouter les colonnes manquantes à email_accounts
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
        `)
      }
      
      return NextResponse.redirect(`${origin}/dashboard/settings?error=database_error`)
    }

    console.log('✅ [OUTLOOK] Compte sauvegardé avec succès pour user:', user.id, 'email:', userEmail, 'workspace_id:', workspaceId)

    return NextResponse.redirect(`${origin}/dashboard/settings?success=outlook_connected`)
  } catch (err) {
    console.error('Error connecting Outlook:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=connection_failed`)
  }
}

