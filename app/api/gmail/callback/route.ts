import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'


export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') || ''
  const stateParams = new URLSearchParams(state)
  let workspaceId = stateParams.get('workspaceId') || null

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?error=gmail_connection_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_code`)
  }

  const supabase = createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  // IMPORTANT: Pour un workspace personnel, on met toujours workspace_id à null
  // Vérifier si c'est un workspace personnel en vérifiant le type depuis la DB
  // Si workspaceId est 'personal', vide, ou si c'est un workspace personnel, on met null
  // STRATÉGIE: Par défaut, considérer comme personnel (workspace_id = null) sauf si on peut prouver que c'est une organisation
  if (workspaceId === 'personal' || workspaceId?.trim() === '' || !workspaceId) {
    workspaceId = null
    console.log('✅ Workspace personnel détecté (personal/vide/null), workspace_id = null')
  } else if (workspaceId) {
    // Si workspaceId est fourni, vérifier si c'est un workspace personnel
    // Utiliser directement Supabase pour vérifier le type
    try {
      console.log('🔍 Vérification type workspace pour ID:', workspaceId)
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('type')
        .eq('id', workspaceId)
        .eq('owner_id', user.id)
        .single()
      
      if (!workspaceError && workspace) {
        if (workspace.type === 'personal') {
          console.log('✅ Workspace personnel détecté via DB, workspace_id = null')
          workspaceId = null
        } else {
          console.log('✅ Workspace organisation détecté, workspace_id =', workspaceId)
          // Garder le workspaceId pour les organisations
        }
      } else {
        // Workspace non trouvé ou erreur, considérer comme personnel par défaut
        console.log('⚠️ Workspace non trouvé ou erreur DB, considéré comme personnel (workspace_id = null)')
        workspaceId = null
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la vérification du type de workspace:', error)
      // En cas d'erreur, considérer comme personnel par défaut (sécurité)
      workspaceId = null
    }
  }
  
  console.log('📋 Workspace ID final pour sauvegarde:', workspaceId)

  try {
    // Déterminer l'URI de callback pour OAuth
    // IMPORTANT: Cette URI doit correspondre EXACTEMENT à celle utilisée dans /api/gmail/connect
    // et à celle configurée dans Google Cloud Console
    
    let callbackUri: string
    
    // PRIORITÉ 1: Si l'origin contient bilibou.com, utiliser bilibou.com (sans www)
    // Même si Google redirige vers localhost, on force bilibou.com pour la cohérence
    if (origin.includes('bilibou.com') || process.env.NEXT_PUBLIC_APP_URL?.includes('bilibou.com')) {
      callbackUri = 'https://bilibou.com/api/gmail/callback'
      console.log('✅ Callback: Production détectée (bilibou.com), utilisation:', callbackUri)
    }
    // PRIORITÉ 2: Si NEXT_PUBLIC_APP_URL est définie et ne contient pas localhost, l'utiliser
    else if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      callbackUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
      // Normaliser pour bilibou.com (sans www)
      if (callbackUri.includes('bilibou.com')) {
        callbackUri = callbackUri.replace(/https?:\/\/(www\.)?bilibou\.com/, 'https://bilibou.com')
      }
      console.log('✅ Callback: Utilisation NEXT_PUBLIC_APP_URL:', callbackUri)
    }
    // PRIORITÉ 3: Utiliser l'origin de la requête (mais seulement si ce n'est pas localhost)
    else if (origin && !origin.includes('localhost')) {
      callbackUri = `${origin}/api/gmail/callback`
      console.log('✅ Callback: Utilisation origin de la requête:', callbackUri)
    }
    // FALLBACK: localhost uniquement en développement
    else {
      callbackUri = 'http://localhost:3001/api/gmail/callback'
      console.log('⚠️ Callback: Fallback localhost:', callbackUri)
    }
    
    console.log('🔗 URI de callback OAuth finale:', callbackUri)
    
    // Pour les redirections internes, utiliser l'origin de la requête
    const baseUrl = origin.includes('bilibou.com') ? 'https://bilibou.com' : origin
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUri
    )

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    // Calculate token expiration
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000) // Default 1 hour

    // Check if account already exists (même si inactif)
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('email', userInfo.email || '')
      .maybeSingle()

    let dbError = null

    if (existingAccount) {
      // Compte existant : permettre la reconnexion même si limite atteinte
      console.log('✅ Compte email existant détecté, reconnexion autorisée (même si limite atteinte)')
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
    } else {
      // Nouveau compte : vérifier la limite AVANT d'insérer
      const planId = user.user_metadata?.selected_plan
      const { count } = await supabase
        .from('email_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)

      const { canAddEmailAccount } = await import('@/lib/billing/plans')
      const canAdd = canAddEmailAccount(planId, count || 0)
      
      if (!canAdd) {
        console.log('❌ Limite de plan atteinte pour nouveau compte email')
        return NextResponse.redirect(`${origin}/dashboard/settings?error=plan_limit_reached&message=Vous avez atteint la limite de comptes e-mail de votre plan actuel.`)
      }

      // Insert new account
      const { error } = await supabase
        .from('email_accounts')
        .insert({
          user_id: user.id,
          provider: 'gmail',
          email: userInfo.email || '',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          workspace_id: workspaceId,
        })
      
      dbError = error
    }

    if (dbError) {
      console.error('Error saving Gmail account:', dbError)
      return NextResponse.redirect(`${origin}/dashboard/settings?error=database_error`)
    }

    console.log('✅ Gmail account saved successfully for user:', user.id, 'email:', userInfo.email, 'workspace_id:', workspaceId)

    return NextResponse.redirect(`${origin}/dashboard/settings?success=gmail_connected`)
  } catch (err) {
    console.error('Error connecting Gmail:', err)
    return NextResponse.redirect(`${origin}/dashboard?error=connection_failed`)
  }
}

