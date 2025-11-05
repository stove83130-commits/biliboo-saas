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
  // IMPORTANT: Utiliser l'origin de la requête actuelle pour garantir la bonne URL de callback
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL
  
  let baseUrl: string
  
  // PRIORITÉ 1: Utiliser origin (toujours fiable, même pour vercel.app)
  // On utilise origin car c'est le domaine réel de la requête, nécessaire pour le callback
  if (origin) {
    baseUrl = origin
    console.log('✅ Utilisation origin (domaine de la requête):', baseUrl)
  } 
  // PRIORITÉ 2: Utiliser referer
  else if (referer) {
    try {
      const refererUrl = new URL(referer)
      baseUrl = refererUrl.origin
      console.log('✅ Utilisation referer:', baseUrl)
    } catch {
      baseUrl = envAppUrl && !envAppUrl.includes('localhost') ? envAppUrl : requestUrl.origin
      console.log('⚠️ Utilisation fallback (erreur parsing referer):', baseUrl)
    }
  } 
  // PRIORITÉ 3: Fallback sur envAppUrl ou requestUrl.origin
  else {
    baseUrl = envAppUrl && !envAppUrl.includes('localhost') ? envAppUrl : requestUrl.origin
    console.log('⚠️ Utilisation fallback final:', baseUrl)
  }
  
  // IMPORTANT: Pour le callback OAuth, on doit utiliser l'URL normalisée (bilibou.com si disponible)
  // Mais seulement si NEXT_PUBLIC_APP_URL est défini ET que c'est un domaine personnalisé
  // Sinon on garde l'origin de la requête pour que le callback fonctionne
  if (envAppUrl && !envAppUrl.includes('localhost') && !envAppUrl.includes('vercel.app')) {
    // Utiliser NEXT_PUBLIC_APP_URL pour le callback URI (doit correspondre à Google Cloud Console)
    const callbackBaseUrl = envAppUrl.includes('bilibou.com') 
      ? 'https://bilibou.com' 
      : envAppUrl
    console.log('🔗 Utilisation NEXT_PUBLIC_APP_URL pour callback URI:', callbackBaseUrl)
    baseUrl = callbackBaseUrl
  } else if (baseUrl.includes('bilibou.com')) {
    // Normaliser bilibou.com (toujours sans www pour la cohérence)
    baseUrl = baseUrl.replace(/^https?:\/\/(www\.)?/, 'https://')
    if (baseUrl.startsWith('https://www.bilibou.com')) {
      baseUrl = 'https://bilibou.com'
    }
  }
  
  console.log('🔗 URI de redirection Gmail finale:', `${baseUrl}/api/gmail/callback`)
  console.log('🔍 Vérification plan et permissions...')

  // Vérifier les permissions du plan
  const planId = user.user_metadata?.selected_plan
  const { count, error: countError } = await supabase
    .from('email_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (countError) {
    console.error('❌ Erreur lors du comptage des comptes email:', countError)
  }

  console.log('📊 Plan ID:', planId, 'Comptes email actifs:', count || 0)
  
  const canAdd = canAddEmailAccount(planId, count || 0)
  console.log('✅ Peut ajouter compte email:', canAdd)

  if (!canAdd) {
    console.log('❌ Limite de plan atteinte, redirection vers dashboard')
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

  // Vérifier que les credentials Google sont configurés
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non configuré')
    return NextResponse.redirect(`${baseUrl}/dashboard?error=google_oauth_not_configured`)
  }

  console.log('🔑 Google OAuth credentials présents, création du client OAuth2...')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/gmail/callback`
  )
  
  console.log('🔗 Callback URI configuré:', `${baseUrl}/api/gmail/callback`)

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



















