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

  // Déterminer si on est en production
  const isProduction = process.env.NODE_ENV === 'production' || 
                       request.url.includes('bilibou.com') ||
                       request.url.includes('vercel.app')
  
  // Extraire le domaine de l'URL pour configurer les cookies
  const url = new URL(request.url)
  const hostname = url.hostname
  // Pour les domaines personnalisés, utiliser le domaine racine (sans www)
  // IMPORTANT: Pour bilibou.com, ne pas définir de domain pour éviter les problèmes de cookies
  const cookieDomain = hostname.startsWith('www.') 
    ? hostname.replace('www.', '') 
    : hostname.includes('vercel.app') 
      ? undefined // Laisser Vercel gérer le domaine pour les URLs vercel.app
      : hostname.includes('bilibou.com')
        ? undefined // Ne pas définir domain pour bilibou.com, laisser le navigateur gérer
        : hostname

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Configurer les options de cookies pour la production
          const cookieOptions: CookieOptions = {
            ...options,
            // En production, forcer secure et sameSite
            ...(isProduction && {
              secure: true,
              sameSite: 'lax' as const,
              // Ne pas définir domain pour les domaines vercel.app, laisser le navigateur gérer
              ...(cookieDomain && !cookieDomain.includes('vercel.app') && {
                domain: cookieDomain
              })
            })
          }
          
          request.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Configurer les options de cookies pour la production
          const cookieOptions: CookieOptions = {
            ...options,
            // En production, forcer secure et sameSite
            ...(isProduction && {
              secure: true,
              sameSite: 'lax' as const,
              // Ne pas définir domain pour les domaines vercel.app, laisser le navigateur gérer
              ...(cookieDomain && !cookieDomain.includes('vercel.app') && {
                domain: cookieDomain
              })
            })
          }
          
          request.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
        },
      },
    }
  )

  try {
    const pathname = request.nextUrl.pathname
    
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
      '/api/cron', // Routes cron (vérification Bearer token dans l'endpoint)
      '/', // Page d'accueil
    ]
    
    const isPublicRoute = publicRoutes.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    )
    
    // Log des cookies présents pour debug (uniquement pour les routes protégées)
    const authCookie = request.cookies.get('sb-' + supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] + '-auth-token')
    const hasAuthCookie = !!authCookie?.value
    
    // Pour les routes publiques, ne pas appeler getUser() pour éviter les erreurs inutiles
    // Pour les routes protégées, on vérifie l'authentification
    let user = null
    let authError = null
    
    if (!isPublicRoute) {
      console.log('🔍 Middleware check (route protégée):', {
        pathname,
        hasAuthCookie,
        cookieLength: authCookie?.value?.length || 0
      })
      
      // Ajouter un timeout pour éviter les blocages sur le domaine personnalisé
      try {
        const authResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null }, error: { message: 'Timeout' } }>((resolve) => 
            setTimeout(() => resolve({ data: { user: null }, error: { message: 'Timeout' } }), 2000)
          )
        ]) as any
        user = authResult.data.user
        authError = authResult.error
      } catch (error: any) {
        user = null
        authError = error
      }
      
      if (authError) {
        console.error('❌ Erreur auth middleware:', authError.message)
        console.error('❌ Détails:', JSON.stringify(authError, null, 2))
      }
    } else {
      // Pour les routes publiques, on peut quand même essayer de récupérer l'utilisateur
      // mais sans logger d'erreur si ça échoue (c'est normal)
      // Ajouter un timeout pour éviter les blocages sur le domaine personnalisé
      try {
        const authResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null }, error: null }>((resolve) => 
            setTimeout(() => resolve({ data: { user: null }, error: null }), 1000)
          )
        ]) as any
        user = authResult.data.user
      } catch (error) {
        // Ignorer les erreurs pour les routes publiques - c'est normal qu'il n'y ait pas de session
        user = null
      }
    }
    
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


