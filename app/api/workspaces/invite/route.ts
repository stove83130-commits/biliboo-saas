import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"


export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, email, role } = await request.json()
    if (!workspaceId || !email) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    // Trouver le profil par email
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single()
    if (!profile) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })

    // Vérifier ownership
    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single()
    if (!ws || ws.owner_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })

    const { error } = await supabase.from('workspace_members').insert({ workspace_id: workspaceId, user_id: profile.id, role: role || 'member', status: 'active' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


















