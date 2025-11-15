import { createClient } from '@/lib/supabase/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 🔧 LOG IMMÉDIAT pour vérifier que le callback est appelé
  console.log('🔔 CALLBACK OAUTH APPELÉ - URL:', request.url)
  console.log('🔔 CALLBACK OAUTH - Headers:', {
    host: request.headers.get('host'),
    referer: request.headers.get('referer'),
    'user-agent': request.headers.get('user-agent')?.substring(0, 50),
  })
  
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type') // recovery, signup, etc.
  const plan = requestUrl.searchParams.get('plan')
  
  // 🔧 FIX PRODUCTION: Normaliser l'origin pour éviter les problèmes de cookies
  // Si l'URL contient bilibou.com, utiliser toujours bilibou.com (sans www)
  let origin = requestUrl.origin
  if (origin.includes('bilibou.com')) {
    origin = origin.replace(/^https?:\/\/(www\.)?bilibou\.com/, 'https://bilibou.com')
  }
  
  console.log('🔍 Auth callback - origin:', origin, 'requestUrl.origin:', requestUrl.origin)

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
  // IMPORTANT: type=signup OU pas de type ET pas de code verifier dans les cookies
  // Les confirmations email n'ont généralement pas de code verifier (sauf si PKCE est activé)
  // Les OAuth ont toujours un code verifier
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  const hasCodeVerifier = request.cookies.get('sb-' + supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] + '-code-verifier')?.value
  
  // 🔧 FIX PRODUCTION: Améliorer la détection OAuth vs signup
  // RÈGLE 1: Si type === 'signup', c'est TOUJOURS signup (confirmation email)
  // RÈGLE 2: Si type === 'recovery', c'est TOUJOURS recovery (reset password)
  // RÈGLE 3: Si type est null/undefined OU autre chose que 'signup'/'recovery', c'est OAuth
  // IMPORTANT: Pour OAuth, Supabase envoie généralement type=null, mais on ne doit PAS assumer signup
  // On assume signup UNIQUEMENT si type === 'signup' explicitement
  const isExplicitSignup = type === 'signup'
  const isExplicitRecovery = type === 'recovery'
  // 🔧 FIX CRITIQUE: Ne considérer comme signup QUE si type est explicitement 'signup'
  // Si type est null/undefined, c'est probablement OAuth (pas signup)
  // Les confirmations email ont TOUJOURS type='signup' dans Supabase
  const isSignupFlow = isExplicitSignup
  
  console.log('🔍 Détection flux:', {
    type: type || 'none',
    hasCodeVerifier: !!hasCodeVerifier,
    isExplicitSignup,
    isExplicitRecovery,
    isSignupFlow,
    code: code ? 'present' : 'missing',
    note: isSignupFlow ? 'SIGNUP (confirmation email)' : 'OAUTH (Google, Azure, etc.)'
  })
  
  if (code && isSignupFlow) {
    console.log('📧 Email confirmation detected')
    console.log('📧 Code:', code.substring(0, 20) + '...')
    console.log('📧 Type:', type || 'none (détecté comme signup)')
    console.log('📧 Origin:', origin)
    
    // Créer un client SSR pour échanger le code et confirmer l'email
    let response = NextResponse.next()

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

    // IMPORTANT: Pour les confirmations email (signup), on n'a PAS besoin de code verifier
    // Le code verifier est seulement pour OAuth avec PKCE
    // Essayer d'abord sans code verifier, puis avec si nécessaire
    let sessionData = null
    let error = null
    
    // Tentative 1: Sans code verifier (standard pour email confirmation)
    const { data: session, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.warn('⚠️ Première tentative échouée:', sessionError.message)
      
      // Si l'erreur mentionne code verifier, essayer de récupérer le code verifier depuis les cookies
      if (sessionError.message?.includes('code verifier') || sessionError.message?.includes('code_verifier')) {
        console.log('⚠️ Erreur code verifier détectée, tentative avec code verifier...')
        const codeVerifier = request.cookies.get('sb-' + supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] + '-code-verifier')?.value
        
        if (codeVerifier) {
          // Réessayer avec le code verifier (peut-être que Supabase a besoin du code verifier même pour signup)
          const { data: sessionWithVerifier, error: errorWithVerifier } = await supabase.auth.exchangeCodeForSession(code)
          if (!errorWithVerifier && sessionWithVerifier) {
            sessionData = sessionWithVerifier
            console.log('✅ Code échangé avec succès avec code verifier')
          } else {
            error = errorWithVerifier || sessionError
          }
        } else {
          error = sessionError
        }
      } else {
        error = sessionError
      }
    } else {
      sessionData = session
      console.log('✅ Code échangé avec succès sans code verifier')
    }
    
    if (error || !sessionData) {
      console.error('❌ Erreur lors de la confirmation email:', error || 'Session data is null')
      console.error('❌ Détails erreur:', JSON.stringify(error, null, 2))
      // Ne pas rediriger vers login, rediriger vers verify-email pour permettre une nouvelle tentative
      return buildRedirectResponse(`${origin}/verify-email?error=confirmation_failed`)
    }

    console.log('✅ Code échangé avec succès, session créée')
    console.log('📧 Session user:', sessionData?.user?.id || 'N/A')
    console.log('📧 Session email confirmed:', !!sessionData?.user?.email_confirmed_at)

    // Assurer l'écriture effective des cookies en forçant une lecture de session
    const { data: { user: userAfterExchange } } = await supabase.auth.getUser()
    console.log('📧 User après exchange:', userAfterExchange?.id || 'N/A')
    console.log('📧 Email confirmed après exchange:', !!userAfterExchange?.email_confirmed_at)

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

    const { data: { user }, error: getUserError } = await supabaseAfterAuth.auth.getUser()
    
    if (getUserError) {
      console.error('❌ Erreur lors de la récupération de l\'utilisateur:', getUserError)
    }

    console.log('📧 User final:', {
      id: user?.id || 'N/A',
      email: user?.email || 'N/A',
      email_confirmed_at: user?.email_confirmed_at || 'N/A',
      has_confirmed_at: !!user?.email_confirmed_at
    })

    // Vérifier si l'email est confirmé
    // Si l'email n'est pas encore confirmé, rediriger vers /verify-email
    if (!user?.email_confirmed_at) {
      console.log('⚠️ Email non confirmé après confirmation, redirection vers /verify-email')
      console.log('⚠️ Détails user:', {
        id: user?.id,
        email: user?.email,
        email_confirmed_at: user?.email_confirmed_at,
        created_at: user?.created_at
      })
      const redirectResponse = buildRedirectResponse(`${origin}/verify-email`)
      response.cookies.getAll().forEach((c) => {
        redirectResponse.cookies.set(c)
      })
      return redirectResponse
    }

    // Si l'email est confirmé, rediriger vers /verify-email avec confirmed=true
    // pour afficher le message de succès, puis rediriger vers onboarding
    const onboardingCompleted = user?.user_metadata?.onboarding_completed || false
    
    console.log('✅✅✅ Email confirmé avec succès:', {
      userId: user?.id,
      email: user?.email,
      emailConfirmed: !!user?.email_confirmed_at,
      emailConfirmedAt: user?.email_confirmed_at,
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
  // IMPORTANT: Ne traiter que si c'est un flux OAuth (pas signup, pas recovery)
  // 🔧 FIX: Si ce n'est PAS un flux signup explicite (type !== 'signup'), alors c'est OAuth
  // Si type est null/undefined, on assume OAuth (car signup aurait type='signup' dans Supabase)
  if (code && !isExplicitRecovery && !isSignupFlow) {
    console.log('🔐 OAuth flow detected (Google, Azure, etc.)')
    console.log('📧 Code présent:', code ? 'yes' : 'no', 'Type:', type || 'none (OAuth)')
    
    // Vérifier que le code est valide
    if (!code || code.trim() === '') {
      console.error('❌ Code vide ou invalide')
      return buildRedirectResponse(`${origin}/auth/login?error=invalid_code`)
    }
    
    // Créer un client SSR lié à une réponse pour que les cookies soient bien écrits AVANT la redirection
    let response = NextResponse.next()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

    // Déterminer si on est en production
    const isProduction = process.env.NODE_ENV === 'production' || 
                         request.url.includes('bilibou.com') ||
                         request.url.includes('vercel.app')
    
    // Extraire le domaine de l'URL pour configurer les cookies
    const url = new URL(request.url)
    const hostname = url.hostname
    // Pour les domaines personnalisés, utiliser le domaine racine (sans www)
    const cookieDomain = hostname.startsWith('www.') 
      ? hostname.replace('www.', '') 
      : hostname.includes('vercel.app') 
        ? undefined // Laisser Vercel gérer le domaine pour les URLs vercel.app
        : hostname

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
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
          // Écrire sur la réponse locale
          response.cookies.set({ name, value, ...cookieOptions })
        },
        remove(name, options) {
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
          response.cookies.set({ name, value: '', ...cookieOptions })
        },
      },
    })

    // Vérifier si on a un code_verifier dans les cookies (pour PKCE)
    // Supabase stocke le code_verifier dans les cookies lors de la génération du code
    const codeVerifier = request.cookies.get('sb-' + supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] + '-code-verifier')?.value
    console.log('📧 Code verifier présent:', codeVerifier ? 'yes' : 'no')

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('❌ Erreur lors de l\'échange du code:', error)
      console.error('❌ Détails erreur:', JSON.stringify(error, null, 2))
      console.error('❌ Code:', code.substring(0, 20) + '...')
      console.error('❌ Code verifier présent:', !!codeVerifier)
      
      // Si l'erreur est liée au code verifier, rediriger vers login avec un message spécifique
      if (error.message?.includes('code verifier') || error.message?.includes('code_verifier') || error.message?.includes('Vérificateur')) {
        console.error('❌ Vérificateur de code d\'erreur - redirection vers connexion')
        return buildRedirectResponse(`${origin}/auth/login?error=code_verifier_missing`)
      }
      
      // Autre erreur d'authentification
      console.error('❌ Erreur authentification OAuth - redirection vers connexion')
      return buildRedirectResponse(`${origin}/auth/login?error=auth_failed`)
    }
    
    console.log('✅ Code échangé avec succès pour OAuth')
    console.log('📧 Session user:', sessionData?.user?.id || 'N/A')

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

    // 🔧 FIX PRODUCTION: Améliorer la détection des utilisateurs existants
    // Pour les connexions OAuth, vérifier si l'utilisateur a déjà complété l'onboarding
    // Si onboarding_completed est true, c'est un utilisateur existant -> dashboard
    // Sinon, vérifier la date de création et les données existantes
    let isNewUser = true
    if (user) {
      // Vérifier si l'utilisateur a déjà complété l'onboarding
      const hasCompletedOnboarding = user.user_metadata?.onboarding_completed === true
      
      if (hasCompletedOnboarding) {
        // Onboarding déjà complété = utilisateur existant
        isNewUser = false
      } else {
        // Vérifier si le compte a été créé récemment (moins de 5 minutes = nouvel utilisateur)
        const accountCreatedAt = user.created_at ? new Date(user.created_at) : null
        const now = new Date()
        const accountAge = accountCreatedAt ? (now.getTime() - accountCreatedAt.getTime()) / 1000 / 60 : null // en minutes
        
        // Si le compte a été créé il y a moins de 5 minutes, c'est probablement un nouvel utilisateur
        const isRecentlyCreated = accountAge !== null && accountAge < 5
        
        if (isRecentlyCreated) {
          // Compte récemment créé = nouvel utilisateur
          isNewUser = true
          console.log('🆕 Nouvel utilisateur détecté (compte créé il y a', accountAge?.toFixed(2), 'minutes)')
        } else {
          // Compte plus ancien, vérifier s'il a des données existantes
          const { data: emailAccounts } = await supabaseAfterAuth
            .from('email_accounts')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          
          const { data: invoices } = await supabaseAfterAuth
            .from('invoices')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          
          // Si l'utilisateur a déjà des données, c'est un utilisateur existant
          if (emailAccounts || invoices) {
            isNewUser = false
            // Marquer l'onboarding comme complété pour éviter ce check à l'avenir
            await supabaseAfterAuth.auth.updateUser({
              data: { ...user.user_metadata, onboarding_completed: true },
            })
          } else {
            // Pas de données existantes = nouvel utilisateur
            isNewUser = true
          }
        }
        
        // Marquer onboarding_completed à false si c'est un nouvel utilisateur
        if (isNewUser && !user.user_metadata?.onboarding_completed) {
          await supabaseAfterAuth.auth.updateUser({
            data: { ...user.user_metadata, onboarding_completed: false },
          })
        }
      }
    }

    // 🔧 FIX PRODUCTION: Si l'utilisateur n'est pas trouvé, rediriger vers login
    if (!user) {
      console.error('❌ Utilisateur non trouvé après OAuth, redirection vers login')
      return buildRedirectResponse(`${origin}/auth/login?error=user_not_found`)
    }
    
    // Si l'utilisateur a complété l'onboarding ou est un utilisateur existant, toujours aller au dashboard
    // Sinon, rediriger vers l'onboarding (sauf si un plan est sélectionné)
    // 🔧 FIX: Pour OAuth (Google), type est généralement null, donc on doit vérifier isNewUser directement
    // Si c'est un nouvel utilisateur (pas de données existantes), rediriger vers onboarding
    const hasCompletedOnboarding = user?.user_metadata?.onboarding_completed === true
    const redirectPath = plan
      ? `/auth/plan-redirect?plan=${plan}`
      : (isNewUser && !hasCompletedOnboarding ? '/onboarding' : '/dashboard')
    
    console.log('🔀 Redirection après auth:', {
      userId: user?.id,
      isNewUser,
      type,
      onboardingCompleted: user?.user_metadata?.onboarding_completed,
      plan,
      redirectPath
    })
    
    const redirectUrl = `${origin}${redirectPath}`
    console.log('🔀 Redirection URL finale:', redirectUrl)
    
    const redirectResponse = buildRedirectResponse(redirectUrl)

    // 🔧 FIX PRODUCTION: Copier les cookies avec toutes leurs options (domain, secure, sameSite)
    // Important: Préserver toutes les options de cookies pour qu'elles fonctionnent en production
    const allCookies = response.cookies.getAll()
    console.log(`🍪 Copie de ${allCookies.length} cookies vers la redirection`)
    
    allCookies.forEach((cookie) => {
      // Récupérer toutes les options du cookie original
      const cookieOptions: any = {
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        // Préserver les options importantes
        ...(cookie.httpOnly !== undefined && { httpOnly: cookie.httpOnly }),
        ...(cookie.secure !== undefined && { secure: cookie.secure }),
        ...(cookie.sameSite !== undefined && { sameSite: cookie.sameSite }),
        ...(cookie.maxAge !== undefined && { maxAge: cookie.maxAge }),
        ...(cookie.expires !== undefined && { expires: cookie.expires }),
      }
      
      // En production, ajouter les options de domaine si nécessaire
      const isProduction = process.env.NODE_ENV === 'production' || origin.includes('bilibou.com')
      if (isProduction && origin.includes('bilibou.com')) {
        // Pour bilibou.com, utiliser le domaine racine (sans www)
        cookieOptions.domain = 'bilibou.com'
        cookieOptions.secure = true
        cookieOptions.sameSite = 'lax'
      }
      
      redirectResponse.cookies.set(cookieOptions)
    })
    
    console.log('✅ Cookies copiés, redirection vers:', redirectUrl)

    return redirectResponse
  }

  // Si pas de code (cas rare), fallback vers le login
  return buildRedirectResponse(`${origin}/auth/login`)
}

