import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes publiques pour Biliboo
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
    request.nextUrl.pathname === path || 
    request.nextUrl.pathname.startsWith(path + '/')
  )

  // Ne pas rediriger les routes API
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // Rediriger vers login si pas authentifié et route protégée
  if (!user && !isPublicPath && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Vérifier email confirmé (optionnel selon tes besoins)
  if (user && !user.email_confirmed_at && !isPublicPath && !isApiRoute) {
    const allowedWithoutEmail = ['/verify-email', '/onboarding']
    const isAllowedWithoutEmail = allowedWithoutEmail.some(path =>
      request.nextUrl.pathname.startsWith(path)
    )
    
    if (!isAllowedWithoutEmail) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
