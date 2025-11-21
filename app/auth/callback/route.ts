import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Logger pour diagnostic
  console.log('🔍 OAuth Callback:', {
    origin: requestUrl.origin,
    hostname: requestUrl.hostname,
    code: code ? 'present' : 'missing',
    error,
    errorDescription,
  })

  // Si erreur OAuth, rediriger vers login avec message
  if (error) {
    console.error('❌ OAuth Error:', error, errorDescription)
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`, request.url))
  }

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
          // Détecter si on est en production (Vercel ou autre)
          const isProduction = 
            process.env.NODE_ENV === 'production' || 
            process.env.VERCEL === '1' ||
            requestUrl.hostname !== 'localhost'
          
          // Options de cookies pour production (HTTPS + domaine personnalisé)
          const cookieOptions = {
            ...options,
            secure: isProduction, // HTTPS en production
            sameSite: 'lax' as const,
            httpOnly: options.httpOnly ?? false,
            path: options.path ?? '/',
            // Ne PAS définir 'domain' explicitement - laisser le navigateur gérer
          }
          
          console.log('🍪 Cookie set:', {
            name,
            domain: requestUrl.hostname,
            secure: isProduction,
            sameSite: 'lax',
            path: cookieOptions.path,
          })
          // Définir le cookie dans la requête ET la réponse
          request.cookies.set({ name, value, ...cookieOptions })
          response.cookies.set({ name, value, ...cookieOptions })
        },
        remove(name: string, options: any) {
          // Détecter si on est en production
          const isProduction = 
            process.env.NODE_ENV === 'production' || 
            process.env.VERCEL === '1' ||
            requestUrl.hostname !== 'localhost'
          
          const cookieOptions = {
            ...options,
            secure: isProduction,
            sameSite: 'lax' as const,
            httpOnly: options.httpOnly ?? false,
            path: options.path ?? '/',
          }
          // Supprimer le cookie dans la requête ET la réponse
          request.cookies.set({ name, value: '', ...cookieOptions })
          response.cookies.set({ name, value: '', ...cookieOptions })
        },
      },
    })

    // Échanger le code contre une session
    console.log('🔄 Tentative exchangeCodeForSession...', {
      code: code.substring(0, 20) + '...',
      hostname: requestUrl.hostname,
      origin: requestUrl.origin,
    })
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    // Vérifier les cookies après l'échange
    const cookiesAfterExchange = request.cookies.getAll()
    const supabaseCookies = cookiesAfterExchange.filter(c => c.name.startsWith('sb-'))
    
    console.log('🍪 Cookies après exchangeCodeForSession:', {
      count: supabaseCookies.length,
      names: supabaseCookies.map(c => c.name),
    })
    
    if (!error && data?.session) {
      console.log('✅ OAuth session créée avec succès:', {
        userId: data.session.user.id,
        email: data.session.user.email,
        origin: requestUrl.origin,
        hostname: requestUrl.hostname,
        cookiesSet: supabaseCookies.length,
      })
      
      // Vérifier que les cookies sont bien dans la réponse
      const responseCookies = response.cookies.getAll()
      const responseSupabaseCookies = responseCookies.filter(c => c.name.startsWith('sb-'))
      console.log('🍪 Cookies dans la réponse:', {
        count: responseSupabaseCookies.length,
        names: responseSupabaseCookies.map(c => c.name),
      })
      
      return response
    } else {
      console.error('❌ Erreur exchangeCodeForSession:', {
        error: error?.message,
        status: error?.status,
        code: error?.code,
        origin: requestUrl.origin,
        hostname: requestUrl.hostname,
        cookiesSet: supabaseCookies.length,
      })
      
      // Rediriger vers debug si on est en développement ou avec un paramètre spécial
      const debugUrl = requestUrl.searchParams.get('debug') === 'true'
        ? `/debug?error=${encodeURIComponent(error?.message || 'oauth_error')}`
        : `/auth/login?error=${encodeURIComponent(error?.message || 'oauth_error')}`
      
      return NextResponse.redirect(new URL(debugUrl, request.url))
    }
  }

  // Retourner à la page de login en cas d'erreur
  return NextResponse.redirect(new URL('/auth/login?error=oauth_error', request.url))
}

