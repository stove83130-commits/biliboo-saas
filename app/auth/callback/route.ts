import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const plan = requestUrl.searchParams.get('plan')
  const origin = requestUrl.origin

  // Préparer une réponse de redirection finale que l'on enrichira avec les cookies
  const buildRedirectResponse = (url: string) =>
    NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })

  if (code) {
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

    // Rediriger systématiquement vers le dashboard (sauf si un plan explicite est passé)
    const redirectPath = plan
      ? `/auth/plan-redirect?plan=${plan}`
      : '/dashboard'
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

