import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname

  // PROTECTION 1: Ne JAMAIS appeler getUser() sur les routes publiques
  const publicPaths = [
    '/auth/login',
    '/auth/signup', 
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/verify-email',
    '/onboarding',
    '/',
  ]

  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  )

  const isApiRoute = pathname.startsWith('/api/')

  // PROTECTION 2: Skip complètement si route publique ou API
  if (isPublicPath || isApiRoute) {
    return supabaseResponse
  }

  // À partir d'ici, on est sur une route PROTÉGÉE
  // On peut maintenant vérifier l'auth

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Variables d\'environnement Supabase manquantes!')
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          const cookieOptions = {
            ...options,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            httpOnly: options.httpOnly ?? false,
            path: options.path ?? '/',
          }
          
          request.cookies.set({ name, value, ...cookieOptions })
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set({ name, value, ...cookieOptions })
        },
        remove(name: string, options: any) {
          const cookieOptions = {
            ...options,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            httpOnly: options.httpOnly ?? false,
            path: options.path ?? '/',
          }
          
          request.cookies.set({ name, value: '', ...cookieOptions })
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set({ name, value: '', ...cookieOptions })
        },
      },
    }
  )

  // PROTECTION 3: Vérifier cookie AVANT getUser()
  const authCookieName = `sb-${supabaseUrl.match(/https?:\/\/([^.]+)/)?.[1]}-auth-token`
  const hasAuthCookie = request.cookies.has(authCookieName)

  if (!hasAuthCookie) {
    // Pas de cookie = pas connecté → redirect login
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // SEULEMENT maintenant, on peut appeler getUser()
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    // Si erreur rate limit, skip et laisser passer
    if (error?.status === 429) {
      console.warn('⚠️ Rate limit in middleware, skipping auth check')
      return supabaseResponse
    }

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // Vérifier email confirmé
    if (user && !user.email_confirmed_at) {
      const allowedWithoutEmail = ['/verify-email', '/onboarding']
      const isAllowedWithoutEmail = allowedWithoutEmail.some(path =>
        pathname.startsWith(path)
      )
      
      if (!isAllowedWithoutEmail) {
        const url = request.nextUrl.clone()
        url.pathname = '/verify-email'
        return NextResponse.redirect(url)
      }
    }
  } catch (error) {
    console.error('❌ Middleware auth error:', error)
    // En cas d'erreur, laisser passer pour éviter de casser le site
    return supabaseResponse
  }

  return supabaseResponse
}

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes SAUF:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - fichiers publics (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)$).*)',
  ],
}
