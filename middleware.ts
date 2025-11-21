import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Routes publiques - SKIP COMPLÈTEMENT
  const publicPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/verify-email',
    '/onboarding',
    '/',
    '/cgu',
    '/cgv',
    '/mentions-legales',
    '/politique-confidentialite',
  ]

  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  )

  const isApiRoute = pathname.startsWith('/api/')

  // Sur routes publiques/API, ne rien faire
  if (isPublicPath || isApiRoute) {
    return NextResponse.next()
  }

  // Routes protégées - vérifier auth
  const authCookieName = 'sb-qkpfxpuhrjgctpadxslh-auth-token'
  const hasAuthCookie = request.cookies.has(authCookieName)

  if (!hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Si cookie présent, créer client et vérifier
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({ name, value, ...options })
        supabaseResponse = NextResponse.next({ request })
        supabaseResponse.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        request.cookies.set({ name, value: '', ...options })
        supabaseResponse = NextResponse.next({ request })
        supabaseResponse.cookies.set({ name, value: '', ...options })
      },
    },
  })

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error?.status === 429) {
      console.warn('⚠️ Rate limit in middleware')
      return supabaseResponse
    }

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

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
    console.error('❌ Middleware error:', error)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logos|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)$).*)',
  ],
}
