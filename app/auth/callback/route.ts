import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type') // recovery, signup, etc.
  const plan = requestUrl.searchParams.get('plan')
  const origin = requestUrl.origin

  // Log pour debug
  console.log('Auth callback - code:', code ? 'present' : 'missing', 'type:', type || 'none', 'plan:', plan || 'none')

  // Préparer une réponse de redirection finale que l'on enrichira avec les cookies
  const buildRedirectResponse = (url: string) =>
    NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })

  // Gérer la réinitialisation de mot de passe
  // IMPORTANT: Pour reset password, on NE PASSE PAS par exchangeCodeForSession ici
  // Le code sera échangé côté client dans la page reset-password
  if (code && type === 'recovery') {
    console.log('Password reset detected, redirecting to reset-password page')
    // Rediriger vers la page de réinitialisation avec le code ET le type
    return buildRedirectResponse(`${origin}/auth/reset-password?code=${code}&type=recovery`)
  }
  
  // Fallback: si pas de type mais qu'on vient d'un email reset, vérifier dans les logs
  // Mais normalement Supabase devrait toujours envoyer type=recovery pour reset password

  // Gérer la confirmation d'email
  if (code && type === 'signup') {
    console.log('Email confirmation detected')
    // Créer un client SSR pour échanger le code et confirmer l'email
    let response = NextResponse.next()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Erreur lors de la confirmation email:', error)
      return buildRedirectResponse(`${origin}/auth/login?error=confirmation_failed`)
    }

    // Assurer l'écriture effective des cookies en forçant une lecture de session
    await supabase.auth.getUser()

    // Recréer un client basé sur les cookies désormais présents dans `response`
    const supabaseAfterAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return response.cookies.get(name)?.value || request.cookies.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const { data: { user } } = await supabaseAfterAuth.auth.getUser()

    // Vérifier si l'email est confirmé
    // Si l'email n'est pas encore confirmé, rediriger vers /verify-email
    if (!user?.email_confirmed_at) {
      console.log('⚠️ Email non confirmé après confirmation, redirection vers /verify-email')
      const redirectResponse = buildRedirectResponse(`${origin}/verify-email`)
      response.cookies.getAll().forEach((c) => {
        redirectResponse.cookies.set(c)
      })
      return redirectResponse
    }

    // Si l'email est confirmé, rediriger vers /verify-email avec confirmed=true
    // pour afficher le message de succès, puis rediriger vers onboarding
    const onboardingCompleted = user?.user_metadata?.onboarding_completed || false
    
    console.log('✅ Email confirmé avec succès:', {
      userId: user?.id,
      emailConfirmed: !!user?.email_confirmed_at,
      onboardingCompleted
    })
    
    // Rediriger vers /verify-email?confirmed=true pour afficher le message de succès
    // La page /verify-email détectera ce paramètre et redirigera automatiquement vers /onboarding
    const redirectResponse = buildRedirectResponse(`${origin}/verify-email?confirmed=true`)
    
    // Copier les cookies accumulés sur la réponse finale
    response.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c)
    })

    return redirectResponse
  }

  // Gérer les codes d'authentification standard (OAuth, etc.) - mais PAS recovery/signup qui sont gérés plus haut
  if (code && type !== 'recovery' && type !== 'signup') {
    console.log('Standard auth flow (OAuth, etc.)')
    // Créer un client SSR lié à une réponse pour que les cookies soient bien écrits AVANT la redirection
    let response = NextResponse.next()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          // Écrire sur la réponse locale
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Erreur lors de l\'échange du code:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    // Assurer l\'écriture effective des cookies en forçant une lecture de session
    await supabase.auth.getUser()

    // Continuer le flux normalement, mais en utilisant la même réponse pour conserver les cookies
    // On choisira la destination plus bas, après avoir lu l\'utilisateur
    // NB: on ne retourne pas encore, on récupère juste les cookies écrits dans `response`

    // Recréer un client basé sur les cookies désormais présents dans `response`
    const supabaseAfterAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return response.cookies.get(name)?.value || request.cookies.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const { data: { user } } = await supabaseAfterAuth.auth.getUser()

    // Restaurer la logique: nouvel utilisateur -> onboarding, sinon -> dashboard (plan prioritaire)
    let isNewUser = true
    if (user) {
      isNewUser = !user.user_metadata?.onboarding_completed
      if (isNewUser && !user.user_metadata?.onboarding_completed) {
        await supabaseAfterAuth.auth.updateUser({
          data: { ...user.user_metadata, onboarding_completed: false },
        })
      }
    }

    // Si l'utilisateur a complété l'onboarding, toujours aller au dashboard
    // Sinon, rediriger vers l'onboarding (sauf si un plan est sélectionné)
    const redirectPath = plan
      ? `/auth/plan-redirect?plan=${plan}`
      : (isNewUser ? '/onboarding' : '/dashboard')
    
    console.log('🔀 Redirection après auth:', {
      userId: user?.id,
      isNewUser,
      onboardingCompleted: user?.user_metadata?.onboarding_completed,
      plan,
      redirectPath
    })
    
    const redirectResponse = buildRedirectResponse(`${origin}${redirectPath}`)

    // Copier les cookies accumulés sur la réponse finale
    response.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c)
    })

    return redirectResponse
  }

  // Si pas de code (cas rare), fallback vers le login
  return buildRedirectResponse(`${origin}/auth/login`)
}

