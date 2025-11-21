import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const plan = requestUrl.searchParams.get('plan')
  const origin = requestUrl.origin

  // Variables d'environnement avec valeurs par défaut
  const supabaseUrl = 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://qkpfxpuhrjgctpadxslh.supabase.co'
    
  const supabaseAnonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGZ4cHVocmpnY3RwYWR4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTYzMTgsImV4cCI6MjA3NDEzMjMxOH0.Blc5wlKE6g00AqYFdGmsRDeD3ZTKDQfOx4jVpmqA5n4'

  // Fonction helper pour les redirections
  const redirect = (path: string) => {
    return NextResponse.redirect(`${origin}${path}`, {
      status: 302,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  }

  // Gérer la réinitialisation de mot de passe
  if (code && type === 'recovery') {
    return redirect(`/auth/reset-password?code=${code}&type=recovery`)
  }

  // Si pas de code, rediriger vers login
  if (!code) {
    return redirect('/auth/login?error=no_code')
  }

  // Créer le client Supabase avec gestion des cookies
  let response = NextResponse.next()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        // Options de cookies pour la production (HTTPS)
        const cookieOptions = {
          ...options,
          secure: process.env.NODE_ENV === 'production' || requestUrl.protocol === 'https:',
          sameSite: 'lax' as const,
          httpOnly: options.httpOnly ?? false,
          path: options.path ?? '/',
        }
        response.cookies.set({ name, value, ...cookieOptions })
      },
      remove(name: string, options: any) {
        // Options de cookies pour la production (HTTPS)
        const cookieOptions = {
          ...options,
          secure: process.env.NODE_ENV === 'production' || requestUrl.protocol === 'https:',
          sameSite: 'lax' as const,
          httpOnly: options.httpOnly ?? false,
          path: options.path ?? '/',
        }
        response.cookies.set({ name, value: '', ...cookieOptions })
      },
    },
  })

  // Échanger le code pour une session
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('❌ Erreur échange code:', exchangeError.message)
    return redirect(`/auth/login?error=auth_failed`)
  }

  if (!sessionData?.session || !sessionData?.user) {
    console.error('❌ Session ou utilisateur manquant après échange')
    return redirect(`/auth/login?error=session_error`)
  }

  const { session, user } = sessionData

  // Vérifier si c'est un nouvel utilisateur (inscription) ou un utilisateur existant (connexion)
  const userCreatedAt = new Date(user.created_at)
  const now = new Date()
  const secondsSinceCreation = (now.getTime() - userCreatedAt.getTime()) / 1000
  const isNewUser = secondsSinceCreation < 10 // Moins de 10 secondes = nouvel utilisateur

  // Déterminer la destination
  let destination = '/dashboard'

  if (isNewUser) {
    // Nouvel utilisateur : vérifier si l'email est confirmé
    if (user.email_confirmed_at) {
      // Email confirmé : aller à l'onboarding
      destination = '/onboarding'
    } else {
      // Email non confirmé : aller à la page de vérification
      destination = '/verify-email'
    }
  } else {
    // Utilisateur existant : vérifier l'onboarding
    const onboardingCompleted = user.user_metadata?.onboarding_completed || false
    destination = onboardingCompleted ? '/dashboard' : '/onboarding'
  }

  // Si un plan a été sélectionné, rediriger vers plan-redirect
  if (plan) {
    destination = `/auth/plan-redirect?plan=${plan}`
  }

  // Créer la réponse de redirection avec les cookies de session
  const redirectResponse = redirect(destination)
  
  // Copier tous les cookies de session
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })

  return redirectResponse
}
