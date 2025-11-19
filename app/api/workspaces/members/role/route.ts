import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canModifyMemberRole } from "@/lib/workspaces/permissions"


export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()$n    const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, userId, role } = await request.json()
    if (!workspaceId || !userId || !role) {
      return NextResponse.json({ error: "workspaceId, userId et role requis" }, { status: 400 })
    }

    // Vérifier les permissions
    const canModify = await canModifyMemberRole(supabase, workspaceId, user.id, userId, role)
    if (!canModify) {
      return NextResponse.json({ error: "Vous n'avez pas la permission de modifier ce rôle" }, { status: 403 })
    }

    // Mettre à jour le rôle
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

