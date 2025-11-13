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

    // Déterminer l'URL de redirection pour la confirmation d'email
    // IMPORTANT: Normaliser TOUJOURS pour bilibou.com (sans www) pour correspondre à Supabase
    let baseUrl: string;
    if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'http://localhost:3001';
    }
    
    // Normaliser TOUJOURS pour bilibou.com (sans www) pour correspondre à Supabase
    // Supabase est strict sur le format exact de l'URL
    if (baseUrl.includes('bilibou.com')) {
      baseUrl = baseUrl.replace(/^https?:\/\/(www\.)?bilibou\.com/, 'https://bilibou.com');
    } else {
      // Pour les autres domaines, normaliser en enlevant www
      baseUrl = baseUrl.replace(/^https?:\/\/(www\.)?/, (match) => {
        return match.startsWith('http://') ? 'http://' : 'https://';
      });
    }
    
    const redirectUrl = `${baseUrl}/auth/callback`;
    
    console.log('📧 URL de redirection email (resend):', redirectUrl);
    
    // Renvoyer l'email de confirmation avec la bonne URL de redirection
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: user.email || '',
      options: {
        emailRedirectTo: redirectUrl,
      },
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

