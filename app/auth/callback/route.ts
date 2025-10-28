import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const plan = requestUrl.searchParams.get('plan')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    
    // Échanger le code contre une session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Erreur lors de l\'échange du code:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    console.log('✅ Session créée avec succès après OAuth')
  }

  // Si un plan a été sélectionné, rediriger vers une page intermédiaire qui gérera le paiement
  if (plan) {
    console.log(`🔄 Redirection vers plan-redirect avec plan: ${plan}`)
    return NextResponse.redirect(`${origin}/auth/plan-redirect?plan=${plan}`)
  }

  // Vérifier si c'est un nouvel utilisateur (OAuth) pour rediriger vers l'onboarding
  const supabaseAfterAuth = createClient()
  const { data: { user } } = await supabaseAfterAuth.auth.getUser()
  
  console.log('🔍 User après OAuth:', {
    userId: user?.id,
    email: user?.email,
    metadata: user?.user_metadata,
    identities: user?.identities
  })
  
  // Si c'est un nouvel utilisateur OAuth (pas d'onboarding défini ou false), rediriger vers l'onboarding
  // Par défaut, tous les nouveaux utilisateurs OAuth n'ont pas onboarding_completed
  const isNewOAuthUser = user && !user.user_metadata?.onboarding_completed
  const redirectPath = isNewOAuthUser ? '/onboarding' : '/dashboard'
  
  console.log(`🔄 Redirection vers ${redirectPath} (nouveau OAuth: ${isNewOAuthUser})`)
  const redirectUrl = `${origin}${redirectPath}`
  
  // Forcer la redirection avec status 302 (Found)
  return NextResponse.redirect(redirectUrl, { 
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}

