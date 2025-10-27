import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const workspaceId = params.id
    if (!workspaceId) return NextResponse.json({ error: "workspace id manquant" }, { status: 400 })

    // Vérifier ownership
    const { data: ws, error: werr } = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .single()

    if (werr || !ws) return NextResponse.json({ error: "workspace introuvable" }, { status: 404 })
    if (ws.owner_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })

    // Supprimer les dépendances connues avant la workspace
    // 1) Factures
    await supabase.from('invoices').delete().eq('workspace_id', workspaceId)
    // 2) Comptes email (Gmail/Outlook)
    await supabase.from('email_accounts').delete().eq('workspace_id', workspaceId)
    // 3) Membres
    await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId)

    // Enfin, supprimer la workspace elle-même
    const { error: derr } = await supabase.from('workspaces').delete().eq('id', workspaceId)
    if (derr) throw derr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}





