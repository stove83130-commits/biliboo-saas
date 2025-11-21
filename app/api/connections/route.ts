import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer toutes les connexions email de l'utilisateur
    const { data: connections, error } = await supabaseService
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Erreur récupération connexions:', error)
      return NextResponse.json({ error: 'Erreur récupération connexions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: connections || []
    })
  } catch (error) {
    console.error('❌ Erreur API connections:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

