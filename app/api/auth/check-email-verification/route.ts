import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * API endpoint pour vérifier si un email est confirmé
 * Peut être appelé même sans session active (utile pour vérifier depuis un autre appareil)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Si pas de session, retourner un état indiquant qu'il faut vérifier
    if (userError || !user) {
      return NextResponse.json({
        verified: false,
        hasSession: false,
        message: 'Pas de session active'
      })
    }

    // Vérifier si l'email est confirmé
    const isVerified = !!user.email_confirmed_at

    return NextResponse.json({
      verified: isVerified,
      hasSession: true,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at || null
    })
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error)
    return NextResponse.json({
      verified: false,
      hasSession: false,
      error: error.message || 'Erreur lors de la vérification'
    }, { status: 500 })
  }
}

