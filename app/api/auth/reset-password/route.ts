import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code, password } = await request.json()

    if (!code || !password) {
      return NextResponse.json(
        { error: 'Code et mot de passe requis' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Échanger le code contre une session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.json(
        { error: exchangeError.message },
        { status: 400 }
      )
    }

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

