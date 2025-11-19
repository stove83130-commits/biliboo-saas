import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canInviteMembers } from "@/lib/workspaces/permissions"


export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, email, role } = await request.json()
    if (!workspaceId || !email) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    // Vérifier les permissions
    const canInvite = await canInviteMembers(supabase, workspaceId, user.id)
    if (!canInvite) {
      return NextResponse.json({ error: "Vous n'avez pas la permission d'inviter des membres" }, { status: 403 })
    }

    // Trouver le profil par email
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single()
    if (!profile) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })

    // Vérifier que le workspace existe
    const { data: ws } = await supabase.from('workspaces').select('id').eq('id', workspaceId).single()
    if (!ws) return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 })

    // Empêcher l'invitation avec le rôle 'owner' sauf si c'est le propriétaire actuel
    if (role === 'owner') {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single()
      
      if (workspace?.owner_id !== user.id) {
        return NextResponse.json({ error: "Seul le propriétaire peut créer d'autres propriétaires" }, { status: 403 })
      }
    }

    const { error } = await supabase.from('workspace_members').insert({ workspace_id: workspaceId, user_id: profile.id, role: role || 'member', status: 'active' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


















