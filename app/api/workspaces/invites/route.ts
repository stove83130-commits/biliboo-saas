import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, email, role } = await req.json()
    if (!workspaceId || !email) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    const { data: ws } = await supabase.from("workspaces").select("owner_id").eq("id", workspaceId).single()
    if (!ws || ws.owner_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })

    const { data: invite, error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: workspaceId, email, role: role || "member", created_by: user.id })
      .select("token")
      .single()
    if (error) throw error

    // Génération du magic link Supabase
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3001"
    const origin = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    const redirectUrl = `${origin}/invite/${invite.token}`

    try {
      // Générer un magic link qui redirige vers l'acceptation d'invitation
      const { data: magicLink, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: redirectUrl
        }
      })

      if (linkError) throw linkError

      // Envoi email via SMTP (configuré sur ton site)
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@tradia.app',
          to: email,
          subject: 'Invitation à rejoindre une organisation',
          html: `
            <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#0b0b0b">
              <h2 style="margin:0 0 12px 0">Vous avez été invité</h2>
              <p style="margin:0 0 16px 0">Cliquez sur le bouton ci-dessous pour rejoindre l'organisation sur Biliboo.</p>
              <p style="margin:0 0 24px 0">
                <a href="${magicLink.properties.action_link}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Rejoindre l'organisation</a>
              </p>
              <p style="margin:0;color:#6b7280;font-size:12px">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur:<br/>${magicLink.properties.action_link}</p>
            </div>
          `,
        })
      }
    } catch (e) {
      console.warn('Magic link generation or email send failed:', e)
    }

    return NextResponse.json({ ok: true, token: invite.token })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get("workspaceId")
    if (!workspaceId) return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 })

    const { data } = await supabase
      .from("workspace_invites")
      .select("id,email,role,status,expires_at,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })

    return NextResponse.json({ invites: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}