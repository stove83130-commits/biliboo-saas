import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Vérifier que les variables d'environnement sont disponibles avec valeurs par défaut
  const supabaseUrl = 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://qkpfxpuhrjgctpadxslh.supabase.co'
    
  const supabaseAnonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGZ4cHVocmpnY3RwYWR4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTYzMTgsImV4cCI6MjA3NDEzMjMxOH0.Blc5wlKE6g00AqYFdGmsRDeD3ZTKDQfOx4jVpmqA5n4'


  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  try {
    const pathname = request.nextUrl.pathname
    
    // Log des cookies présents pour debug
    const authCookie = request.cookies.get('sb-' + supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] + '-auth-token')
    const hasAuthCookie = !!authCookie?.value
    console.log('🔍 Middleware check:', {
      pathname,
      hasAuthCookie,
      cookieLength: authCookie?.value?.length || 0
    })
    
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    // getSession() ne déclenche pas de refresh automatique, ce qui évite les erreurs en production
    let user = null
    let session = null
    
    try {
      const { data: sessionData, error: authError } = await supabase.auth.getSession()
      session = sessionData?.session || null
      user = session?.user || null
      
      if (authError) {
        // Ne pas logger les erreurs "AuthSessionMissingError" qui sont normales pour les utilisateurs non connectés
        if (!authError.message?.includes('AuthSessionMissingError') && !authError.message?.includes('session')) {
          console.error('❌ Erreur auth middleware:', authError.message)
          console.error('❌ Détails:', JSON.stringify(authError, null, 2))
        }
      }
    } catch (error: any) {
      // Gérer les erreurs de manière silencieuse pour éviter les logs excessifs
      // Les erreurs de session sont normales pour les utilisateurs non connectés
      if (!error?.message?.includes('session') && !error?.message?.includes('AuthSessionMissing')) {
        console.error('❌ Erreur lors de la récupération de la session:', error?.message || error)
      }
      // Continuer avec user = null pour permettre l'accès aux routes publiques
    }
    
    // Routes publiques (accessibles sans authentification)
    const publicRoutes = [
      '/auth/login',
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/callback',
      '/verify-email',
      '/onboarding', // Permettre l'onboarding même sans session (sera géré par la page)
      '/api/auth',
      '/api/billing/checkout',
      '/', // Page d'accueil
    ]
    
    const isPublicRoute = publicRoutes.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    )
    
    // IMPORTANT: Les routes API ne doivent PAS être redirigées vers login
    // Elles doivent gérer elles-mêmes l'authentification et retourner des erreurs JSON
    const isApiRoute = pathname.startsWith('/api/')
    
    // Si l'utilisateur n'est pas authentifié et essaie d'accéder à une route protégée
    if (!user && !isPublicRoute) {
      // Pour les routes API, ne pas rediriger, laisser l'API gérer l'erreur
      if (isApiRoute) {
        console.log('🔒 Route API sans authentification, laisser l\'API gérer')
        // Laisser passer, l'API retournera une erreur 401 JSON
        return response
      }
      
      // Pour les routes pages, rediriger vers login
      console.log('🔒 Utilisateur non authentifié, redirection vers /auth/login', {
        pathname,
        hasAuthCookie,
        authError: authError?.message || 'none'
      })
      const redirectUrl = new URL('/auth/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Si l'utilisateur est authentifié mais que son email n'est pas confirmé,
    // rediriger vers /verify-email (sauf pour certaines routes publiques)
    // Note: Les utilisateurs OAuth (Google, Azure) ont déjà leur email confirmé automatiquement
    if (user && !user.email_confirmed_at) {
      // Routes autorisées même sans email confirmé
      const allowedRoutesWithoutEmail = [
        '/auth/login',
        '/auth/signup',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/auth/callback',
        '/verify-email',
        '/onboarding', // Permettre l'onboarding même sans email confirmé (sera vérifié dans la page)
        '/api/auth',
        '/api/billing/checkout',
      ]
      
      const isAllowedRoute = allowedRoutesWithoutEmail.some(route => 
        pathname === route || pathname.startsWith(route + '/')
      )
      
      // IMPORTANT: Les routes API ne doivent PAS être redirigées
      // Elles doivent gérer elles-mêmes la vérification d'email
      const isApiRoute = pathname.startsWith('/api/')
      
      // Si ce n'est pas une route autorisée, rediriger vers /verify-email (sauf pour les API)
      if (!isAllowedRoute) {
        if (isApiRoute) {
          // Laisser passer pour les API, elles géreront l'erreur
          console.log('📧 Route API avec email non confirmé, laisser l\'API gérer')
          return response
        }
        
        console.log('📧 Email non confirmé, redirection vers /verify-email')
        const redirectUrl = new URL('/verify-email', request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
  } catch (error) {
    console.error('❌ Erreur auth middleware:', error)
    // En cas d'erreur, laisser passer pour éviter les boucles de redirection
    // Mais rediriger vers login si ce n'est pas une route publique
    const pathname = request.nextUrl.pathname
    const publicRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password', '/auth/callback', '/verify-email', '/onboarding', '/api/auth', '/']
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
    
    if (!isPublicRoute) {
      const redirectUrl = new URL('/auth/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}


