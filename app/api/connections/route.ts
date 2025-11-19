import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Récupérer l'utilisateur connecté
    const { data: { session }, error: userError } = await supabase.auth.getSession()$n    const user = session?.user || null
    
    if (userError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Non authentifié' 
      }, { status: 401 })
    }

    // Récupérer le workspace_id depuis les query params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Construire la requête avec filtrage par workspace
    let query = supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Filtrer par workspace_id selon le type de workspace
    let connections: any[] = []
    
    if (workspaceId && workspaceId.trim() !== '' && workspaceId !== 'personal') {
      // Workspace d'organisation : filtrer par workspace_id exact
      const { data, error } = await query.eq('workspace_id', workspaceId)
      if (error) {
        console.error('❌ [CONNECTIONS API] Erreur récupération connexions organisation:', error)
        return NextResponse.json({ 
          success: false, 
          error: 'Erreur base de données' 
        }, { status: 500 })
      }
      connections = data || []
      console.log('✅ [CONNECTIONS API] Filtre workspace organisation:', workspaceId, '-', connections.length, 'comptes')
    } else {
      // Workspace personnel : workspace_id est null, 'personal', ou vide
      // Récupérer tous les comptes actifs de l'utilisateur, puis filtrer côté serveur
      const { data: allConnections, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ [CONNECTIONS API] Erreur récupération connexions:', error)
        return NextResponse.json({ 
          success: false, 
          error: 'Erreur base de données' 
        }, { status: 500 })
      }
      
      // Filtrer côté serveur pour les comptes personnels (workspace_id null, 'personal', ou vide)
      connections = (allConnections || []).filter((conn: any) => 
        conn.workspace_id === null || 
        conn.workspace_id === 'personal' || 
        conn.workspace_id === '' ||
        !conn.workspace_id
      )
      console.log('✅ [CONNECTIONS API] Filtre workspace personnel:', connections.length, 'comptes sur', allConnections?.length || 0)
    }

    // Filtrer les connexions actives seulement (double vérification)
    const activeConnections = connections.filter(conn => conn.is_active)

    console.log('✅ [CONNECTIONS API] Connexions trouvées:', activeConnections.length, 'pour workspace:', workspaceId || 'personnel')

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
