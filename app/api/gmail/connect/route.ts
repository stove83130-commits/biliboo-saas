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

  // Déterminer l'URL de base pour le callback OAuth
  // PRIORITÉ: Utiliser l'origin de la requête pour détecter automatiquement le domaine
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin') || requestUrl.origin
  
  // Déterminer l'URI de redirection pour OAuth
  let redirectUri: string
  
  // PRIORITÉ 1: Si l'origin contient bilibou.com, utiliser bilibou.com (sans www)
  if (origin.includes('bilibou.com')) {
    redirectUri = 'https://bilibou.com/api/gmail/callback'
    console.log('✅ Production détectée (bilibou.com), utilisation:', redirectUri)
  }
  // PRIORITÉ 2: Si NEXT_PUBLIC_APP_URL est définie et ne contient pas localhost, l'utiliser
  else if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
    // Normaliser pour bilibou.com (sans www)
    if (redirectUri.includes('bilibou.com')) {
      redirectUri = redirectUri.replace(/https?:\/\/(www\.)?bilibou\.com/, 'https://bilibou.com')
    }
    console.log('✅ Utilisation NEXT_PUBLIC_APP_URL:', redirectUri)
  }
  // PRIORITÉ 3: Utiliser l'origin de la requête
  else if (origin && !origin.includes('localhost')) {
    redirectUri = `${origin}/api/gmail/callback`
    console.log('✅ Utilisation origin de la requête:', redirectUri)
  }
  // FALLBACK: localhost uniquement en développement
  else {
    redirectUri = 'http://localhost:3001/api/gmail/callback'
    console.log('⚠️ Fallback localhost:', redirectUri)
  }
  
  console.log('🔗 URI de redirection Gmail finale:', redirectUri)
  
  // Pour les redirections internes, utiliser l'origin de la requête
  const baseUrl = origin

  // Vérifier les permissions du plan (mais ne pas bloquer si erreur)
  const planId = user.user_metadata?.selected_plan
  const { count } = await supabase
    .from('email_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  const canAdd = canAddEmailAccount(planId, count || 0)
  
  if (!canAdd) {
    console.log('❌ Limite de plan atteinte, redirection vers dashboard')
    return NextResponse.redirect(`${baseUrl}/dashboard?error=plan_limit_reached&feature=email`)
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId') || ''

  // Note: Pas de vérification des permissions de workspace ici (comme Microsoft Outlook)
  // La vérification du plan (canAddEmailAccount) est déjà faite plus haut
  // Les permissions de workspace seront vérifiées côté UI si nécessaire
  console.log('✅ Redirection vers OAuth Gmail. WorkspaceId:', workspaceId || 'personal')

  // Vérifier que les credentials Google sont configurés
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non configuré')
    return NextResponse.redirect(`${baseUrl}/dashboard?error=google_oauth_not_configured`)
  }

  console.log('🔑 Google OAuth credentials présents, création du client OAuth2...')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
  
  console.log('🔗 Callback URI configuré:', redirectUri)

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

  console.log('🌐 URL OAuth Google générée:', authUrl.substring(0, 100) + '...')
  console.log('✅ Redirection vers Google OAuth...')

  return NextResponse.redirect(authUrl)
}



















