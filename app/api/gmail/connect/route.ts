import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getPlan, canAddEmailAccount } from '@/lib/billing/plans'


export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const supabase = createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Vérifier les permissions du plan
  const planId = user.user_metadata?.selected_plan
  const { count } = await supabase
    .from('email_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!canAddEmailAccount(planId, count || 0)) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard?error=plan_limit_reached&feature=email`)
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId') || ''

  // Si un workspaceId est fourni, vérifier les permissions
  if (workspaceId && workspaceId !== 'personal') {
    const { canManageEmailConnections } = await import('@/lib/workspaces/permissions')
    const canManage = await canManageEmailConnections(supabase, workspaceId, user.id)
    if (!canManage) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard?error=no_permission_email`)
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/gmail/callback`
  )

  const statePayload = new URLSearchParams()
  if (workspaceId) statePayload.set('workspaceId', workspaceId)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent',
    state: statePayload.toString() || undefined,
  })

  return NextResponse.redirect(authUrl)
}



















