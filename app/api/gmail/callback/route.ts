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
  
  // Si workspaceId est 'personal' ou vide, on le met à null pour un compte personnel
  if (workspaceId === 'personal' || workspaceId?.trim() === '') {
    workspaceId = null
  }

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

  try {
    // Déterminer l'URL de base (production ou local)
    // Priorité : NEXT_PUBLIC_APP_URL (domaine personnalisé) > origin > localhost
    // IMPORTANT: Privilégier le domaine personnalisé (bilibou.com) plutôt que le domaine Vercel
    const envAppUrl = process.env.NEXT_PUBLIC_APP_URL
    
    let baseUrl: string
    
    // PRIORITÉ 1: Utiliser NEXT_PUBLIC_APP_URL si c'est un domaine personnalisé
    if (envAppUrl && !envAppUrl.includes('localhost') && !envAppUrl.includes('vercel.app')) {
      baseUrl = envAppUrl
      console.log('✅ Callback: Utilisation NEXT_PUBLIC_APP_URL (domaine personnalisé):', baseUrl)
    }
    // PRIORITÉ 2: Utiliser origin si c'est un domaine personnalisé
    else if (origin && !origin.includes('vercel.app') && !origin.includes('localhost')) {
      baseUrl = origin
      console.log('✅ Callback: Utilisation origin (domaine personnalisé):', baseUrl)
    }
    // PRIORITÉ 3: Fallback sur origin ou localhost
    else {
      baseUrl = origin || (envAppUrl && !envAppUrl.includes('localhost') ? envAppUrl : 'http://localhost:3001')
      console.log('⚠️ Callback: Utilisation fallback:', baseUrl)
    }
    
    // IMPORTANT: Normaliser l'URL pour bilibou.com (toujours sans www pour la cohérence)
    // L'URI de redirection doit correspondre EXACTEMENT à celle configurée dans Google Cloud Console
    if (baseUrl.includes('bilibou.com')) {
      baseUrl = baseUrl.replace(/^https?:\/\/(www\.)?/, 'https://')
      // Si c'est bilibou.com, on retire le www pour la cohérence
      if (baseUrl.startsWith('https://www.bilibou.com')) {
        baseUrl = 'https://bilibou.com'
      }
    }
    
    console.log('🔗 URI de redirection callback Gmail finale:', `${baseUrl}/api/gmail/callback`)
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/gmail/callback`
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

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('email', userInfo.email || '')
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
    } else {
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

    console.log('Gmail account saved successfully for user:', user.id, 'email:', userInfo.email)

    return NextResponse.redirect(`${origin}/dashboard/settings?success=gmail_connected`)
  } catch (err) {
    console.error('Error connecting Gmail:', err)
    return NextResponse.redirect(`${origin}/dashboard?error=connection_failed`)
  }
}

