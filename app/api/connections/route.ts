import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Récupérer l'utilisateur connecté
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Non authentifié' 
      }, { status: 401 })
    }

    // Récupérer les connexions email actives de l'utilisateur
    // Utiliser la même logique que l'onglet settings
    const { data: connections, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur récupération connexions:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Erreur base de données' 
      }, { status: 500 })
    }

    // Filtrer les connexions actives seulement
    const activeConnections = (connections || []).filter(conn => conn.is_active)

    return NextResponse.json({
      success: true,
      data: activeConnections
    })

  } catch (error) {
    console.error('Erreur API connections:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Erreur serveur' 
    }, { status: 500 })
  }
}
