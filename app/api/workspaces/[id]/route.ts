import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canDeleteOrganization, canModifyOrganization } from "@/lib/workspaces/permissions"


export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const workspaceId = params.id
    if (!workspaceId) return NextResponse.json({ error: "workspace id manquant" }, { status: 400 })

    // Vérifier les permissions
    const canModify = await canModifyOrganization(supabase, workspaceId, user.id)
    if (!canModify) {
      return NextResponse.json({ error: "Seul le propriétaire peut modifier l'organisation" }, { status: 403 })
    }

    const body = await request.json()
    const { name, logo_url } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (logo_url !== undefined) updateData.logo_url = logo_url

    const { data, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspaceId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ workspace: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const workspaceId = params.id
    if (!workspaceId) return NextResponse.json({ error: "workspace id manquant" }, { status: 400 })

    // Vérifier les permissions
    const canDelete = await canDeleteOrganization(supabase, workspaceId, user.id)
    if (!canDelete) {
      return NextResponse.json({ error: "Seul le propriétaire peut supprimer l'organisation" }, { status: 403 })
    }

    const { data: ws, error: werr } = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .single()

    if (werr || !ws) return NextResponse.json({ error: "workspace introuvable" }, { status: 404 })

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





