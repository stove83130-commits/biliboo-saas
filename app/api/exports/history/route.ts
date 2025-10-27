import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: exports, error } = await supabase
      .from('export_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Erreur récupération historique:', error)
      return NextResponse.json({ error: 'Erreur récupération historique' }, { status: 500 })
    }

    return NextResponse.json({ exports })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exportId = searchParams.get('id')

    if (!exportId) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
    }

    const { error } = await supabase
      .from('export_history')
      .delete()
      .eq('id', exportId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Erreur suppression:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

