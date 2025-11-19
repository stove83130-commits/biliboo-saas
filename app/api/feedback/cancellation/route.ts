import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Pour l'instant, tout utilisateur connecté peut lister (à sécuriser si besoin par rôle)
    const { data, error } = await supabase
      .from('cancellation_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ feedbacks: data || [] })
  } catch (e) {
    console.error('Erreur GET feedback:', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { feedback } = await request.json()

    if (!feedback || !feedback.trim()) {
      return NextResponse.json({ error: 'Feedback requis' }, { status: 400 })
    }

    // Tenter l'insertion en base (table: cancellation_feedback)
    const payload = {
      user_id: user.id,
      email: user.email || user.user_metadata?.email || null,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      plan: user.user_metadata?.selected_plan || null,
      feedback: feedback.trim(),
      created_at: new Date().toISOString()
    }

    const { error: insertError } = await supabase
      .from('cancellation_feedback')
      .insert(payload as any)

    if (insertError) {
      // Si la table n'existe pas encore, fallback: log serveur
      console.warn('Table cancellation_feedback manquante ou insertion échouée, fallback log:', insertError?.message)
      console.log('Feedback d\'annulation (fallback log):', payload)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur lors de l\'envoi du feedback:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
