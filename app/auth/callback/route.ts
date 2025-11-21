import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Créer la réponse de redirection
    const response = NextResponse.redirect(new URL(next, request.url))

    // Créer le client Supabase avec gestion correcte des cookies
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // Définir le cookie dans la requête ET la réponse
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          // Supprimer le cookie dans la requête ET la réponse
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    })

    // Échanger le code contre une session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return response
    } else {
      console.error('❌ Erreur exchangeCodeForSession:', error)
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url))
    }
  }

  // Retourner à la page de login en cas d'erreur
  return NextResponse.redirect(new URL('/auth/login?error=oauth_error', request.url))
}

