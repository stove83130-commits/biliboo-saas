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

  // Déterminer l'URL de base (production ou local)
  // Priorité : origin header > referer > NEXT_PUBLIC_APP_URL (si pas localhost) > request.url origin
  // IMPORTANT: Normaliser l'URL pour éviter les problèmes www vs non-www
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL
  
  let baseUrl: string
  
  if (origin) {
    baseUrl = origin
  } else if (referer) {
    try {
      const refererUrl = new URL(referer)
      baseUrl = refererUrl.origin
    } catch {
      baseUrl = envAppUrl && !envAppUrl.includes('localhost') ? envAppUrl : requestUrl.origin
    }
  } else {
    baseUrl = envAppUrl && !envAppUrl.includes('localhost') ? envAppUrl : requestUrl.origin
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
  
  console.log('🔗 URI de redirection Gmail:', `${baseUrl}/api/gmail/callback`)

  // Vérifier les permissions du plan
  const planId = user.user_metadata?.selected_plan
  const { count } = await supabase
    .from('email_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!canAddEmailAccount(planId, count || 0)) {
    return NextResponse.redirect(`${baseUrl}/dashboard?error=plan_limit_reached&feature=email`)
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId') || ''

  // Si un workspaceId est fourni ET que ce n'est pas un compte personnel, vérifier les permissions
  // Pour un compte personnel (workspaceId vide ou 'personal'), on laisse passer sans vérification
  if (workspaceId && workspaceId !== 'personal' && workspaceId.trim() !== '') {
    try {
      const { canManageEmailConnections } = await import('@/lib/workspaces/permissions')
      const canManage = await canManageEmailConnections(supabase, workspaceId, user.id)
      if (!canManage) {
        console.log('❌ Permission refusée pour workspace:', workspaceId, 'User:', user.id)
        return NextResponse.redirect(`${baseUrl}/dashboard?error=no_permission_email`)
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des permissions:', error)
      // En cas d'erreur, on continue quand même pour un compte personnel
      // Mais on bloque pour un workspace valide
      if (workspaceId && workspaceId !== 'personal') {
        return NextResponse.redirect(`${baseUrl}/dashboard?error=no_permission_email`)
      }
    }
  }
  
  console.log('✅ Permissions OK, redirection vers OAuth Gmail. WorkspaceId:', workspaceId || 'personal')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/gmail/callback`
  )

  const statePayload = new URLSearchParams()
  // Ne passer workspaceId dans le state que s'il est valide et n'est pas 'personal'
  if (workspaceId && workspaceId !== 'personal' && workspaceId.trim() !== '') {
    statePayload.set('workspaceId', workspaceId)
  }

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



















