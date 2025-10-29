import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { hasWorkspaceAccess } from "@/lib/workspaces/permissions"


export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: "workspaceId requis" }, { status: 400 })

    // Vérifier que l'utilisateur a accès au workspace
    const hasAccess = await hasWorkspaceAccess(supabase, workspaceId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Vous n'avez pas accès à ce workspace" }, { status: 403 })
    }

    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single()
    if (!ws) return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 })

    // Récupérer tous les membres (même ceux sans profil)
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('workspace_id', workspaceId)

    if (error) throw error

    // Pour chaque membre, récupérer l'email depuis profiles
    // Si l'utilisateur n'a pas de profil, on récupère l'email depuis auth.users via Admin API
    const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY 
      ? createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
      : null
    
    const membersWithEmail = await Promise.all(
      (members || []).map(async (member) => {
        // Essayer de récupérer depuis profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', member.user_id)
          .single()

        let email = profile?.email

        // Si pas de profil et qu'on a accès à l'admin API, récupérer depuis auth.users
        if (!email && supabaseAdmin) {
          try {
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(member.user_id)
            if (!userError && userData?.user?.email) {
              email = userData.user.email
            }
          } catch (e) {
            console.error('Erreur récupération email pour user_id:', member.user_id, e)
          }
        }

        return {
          user_id: member.user_id,
          email: email || 'Email non disponible',
          role: member.role,
          status: member.status
        }
      })
    )

    return NextResponse.json({ members: membersWithEmail })
  } catch (e: any) {
    console.error('Erreur GET /api/workspaces/members:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, userId } = await request.json()
    if (!workspaceId || !userId) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    // Vérifier les permissions avec le nouveau système
    const { canRemoveMember } = await import('@/lib/workspaces/permissions')
    const canRemove = await canRemoveMember(supabase, workspaceId, user.id, userId)
    if (!canRemove) {
      return NextResponse.json({ error: "Vous n'avez pas la permission de supprimer ce membre" }, { status: 403 })
    }

    const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


















