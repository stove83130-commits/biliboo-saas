import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Routes publiques - pas de protection
  const publicPaths = [
    '/auth/login',
    '/auth/signup',
    '/',
    '/cgu',
    '/cgv',
    '/mentions-legales',
    '/politique-confidentialite',
    '/contact',
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

    if (error || !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('❌ Middleware error:', error)
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logos|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)$).*)',
  ],
}
