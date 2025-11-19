import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * API endpoint pour vérifier si un email est confirmé
 * Peut être appelé même sans session active (utile pour vérifier depuis un autre appareil)
 * Utilise d'abord la session si disponible, sinon essaie de trouver l'utilisateur par email dans localStorage
 */
export async function GET(request: NextRequest) {
  try {
    // Méthode 1: Vérifier via la session si disponible
    const supabase = await createClient()
    const { data: { session }, error: userError } = await supabase.auth.getSession()
        const user = session?.user || null

    // Si on a une session, vérifier directement
    if (user && !userError) {
      const isVerified = !!user.email_confirmed_at
      return NextResponse.json({
        verified: isVerified,
        hasSession: true,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at || null
      })
    }

    // Méthode 2: Si pas de session, essayer de trouver l'utilisateur par email depuis localStorage
    // Note: On ne peut pas récupérer l'email depuis localStorage côté serveur,
    // mais on peut essayer de vérifier via le service role key si un email est fourni en paramètre
    const emailParam = request.nextUrl.searchParams.get('email')
    
    if (emailParam && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
        const supabaseAdmin = createAdminClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
        
        // Chercher l'utilisateur par email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (!listError && users) {
          const user = users.find(u => u.email === emailParam)
          if (user) {
            return NextResponse.json({
              verified: !!user.email_confirmed_at,
              hasSession: false,
              email: user.email,
              email_confirmed_at: user.email_confirmed_at || null
            })
          }
        }
      } catch (adminError) {
        console.warn('⚠️ Erreur lors de la vérification admin:', adminError)
      }
    }

    // Si pas de session et pas d'email en paramètre, retourner un état indiquant qu'il faut vérifier
    return NextResponse.json({
      verified: false,
      hasSession: false,
      message: 'Pas de session active. Confirmez votre email depuis le lien reçu.',
      needsEmail: !emailParam
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

