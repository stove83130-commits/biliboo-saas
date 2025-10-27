import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, userId } = await request.json()
    if (!workspaceId || !userId) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single()
    if (!ws || ws.owner_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })

    const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


















