import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"


export const dynamic = 'force-dynamic'
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { data: inv } = await supabase
      .from("workspace_invites")
      .select("id,workspace_id,email,role,status,expires_at")
      .eq("token", params.token)
      .single()

    if (!inv) return NextResponse.json({ error: "invite introuvable" }, { status: 404 })
    if (inv.status !== "pending") return NextResponse.json({ error: "invite non valide" }, { status: 400 })
    if (new Date(inv.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "invite expirée" }, { status: 400 })

    const { error: addErr } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: inv.workspace_id, user_id: user.id, role: inv.role, status: "active" })
    if (addErr && !addErr.message?.includes("duplicate")) throw addErr

    await supabase.from("workspace_invites").update({ status: "accepted" }).eq("id", inv.id)

    return NextResponse.json({ ok: true, workspaceId: inv.workspace_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}











