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

  // Rediriger vers le dashboard après une connexion réussie
  console.log('🔄 Redirection vers le dashboard')
  const redirectUrl = `${origin}/dashboard`
  
  // Forcer la redirection avec status 302 (Found)
  return NextResponse.redirect(redirectUrl, { 
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}

