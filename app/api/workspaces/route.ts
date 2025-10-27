import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer les workspaces de l'utilisateur
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erreur lors de la récupération des workspaces:', error)
      return NextResponse.json({ error: 'Erreur lors de la récupération des espaces' }, { status: 500 })
    }

    // Ajouter l'espace personnel par défaut s'il n'existe pas
    const personalWorkspace = workspaces?.find(w => w.type === 'personal')
    if (!personalWorkspace) {
      // Créer l'espace personnel par défaut
      const { data: newPersonalWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          name: 'Espace personnel',
          type: 'personal',
          owner_id: user.id,
          is_active: true
        })
        .select()
        .single()

      if (createError) {
        console.error('Erreur lors de la création de l\'espace personnel:', createError)
      } else {
        workspaces?.unshift(newPersonalWorkspace)
      }
    }

    // Formater les données pour l'affichage
    const formattedWorkspaces = workspaces?.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      is_active: workspace.is_active,
      created_at: workspace.created_at,
      // Supporte différents schémas possibles pour le logo
      logo_url: (workspace.logo_url || workspace.logo || workspace.avatar_url || null),
      member_count: workspace.type === 'personal' ? 1 : 0 // À implémenter pour les organisations
    })) || []

    return NextResponse.json({ workspaces: formattedWorkspaces })
  } catch (error) {
    console.error('Erreur dans /api/workspaces:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Nom et type requis' }, { status: 400 })
    }

    if (type !== 'organization' && type !== 'personal') {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    // Créer le workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        type: type,
        owner_id: user.id,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur lors de la création du workspace:', error)
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
    }

    return NextResponse.json({ 
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        is_active: workspace.is_active,
        created_at: workspace.created_at
      }
    })
  } catch (error) {
    console.error('Erreur dans POST /api/workspaces:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}