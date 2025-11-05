import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier si l'email est déjà confirmé
    if (user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Email déjà confirmé' },
        { status: 400 }
      )
    }

    // Renvoyer l'email de confirmation
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: user.email || '',
    })

    if (resendError) {
      console.error('❌ Erreur lors de l\'envoi de l\'email:', resendError)
      return NextResponse.json(
        { error: resendError.message || 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email de confirmation renvoyé avec succès'
    })
  } catch (error: any) {
    console.error('❌ Erreur globale:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'envoi de l\'email' },
      { status: 500 }
    )
  }
}

