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
        })
        .eq('id', existingAccount.id)
      
      dbError = error
    } else {
      // Insert new account
      const { error } = await supabase
        .from('email_accounts')
        .insert({
          user_id: user.id,
          provider: 'outlook',
          email: userEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
        })
      
      dbError = error
    }

    if (dbError) {
      console.error('Error saving Outlook account:', dbError)
      return NextResponse.redirect(`${origin}/dashboard/settings?error=database_error`)
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=outlook_connected`)
  } catch (err) {
    console.error('Error connecting Outlook:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=connection_failed`)
  }
}

