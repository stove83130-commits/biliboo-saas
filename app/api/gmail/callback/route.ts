import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') || ''
  const stateParams = new URLSearchParams(state)
  const workspaceId = stateParams.get('workspaceId') || null

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
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/gmail/callback`
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

