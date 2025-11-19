import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/outlook/callback`
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'

  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/Mail.Read',
  ]

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  authUrl.searchParams.append('client_id', clientId!)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('scope', scopes.join(' '))
  authUrl.searchParams.append('response_mode', 'query')
  authUrl.searchParams.append('prompt', 'consent')

  return NextResponse.redirect(authUrl.toString())
}













