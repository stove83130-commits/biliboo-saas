import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import nodemailer from "nodemailer"
import { canInviteMembers } from "@/lib/workspaces/permissions"


export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { workspaceId, email, role } = await req.json()
    if (!workspaceId || !email) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    // Vérifier les permissions
    const canInvite = await canInviteMembers(supabase, workspaceId, user.id)
    if (!canInvite) {
      return NextResponse.json({ error: "Vous n'avez pas la permission d'inviter des membres" }, { status: 403 })
    }

    const { data: ws } = await supabase.from("workspaces").select("owner_id").eq("id", workspaceId).single()
    if (!ws) return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 })

    // Empêcher l'invitation avec le rôle 'owner' sauf si c'est le propriétaire actuel
    if (role === 'owner' && ws.owner_id !== user.id) {
      return NextResponse.json({ error: "Seul le propriétaire peut créer d'autres propriétaires" }, { status: 403 })
    }

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
    const directLink = `${origin}/invite/${invite.token}`

    let emailSent = false
    const RESEND_KEY = process.env.RESEND_API_KEY
    const hasSMTPConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

    try {
      // Créer un client admin pour générer le magic link (nécessite service role key)
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      )

      // Générer un magic link qui redirige vers l'acceptation d'invitation
      const { data: magicLink, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: redirectUrl
        }
      })

      if (linkError) throw linkError

      // Récupérer le nom de l'organisation
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", workspaceId)
        .single()
      
      const workspaceName = workspace?.name || "une organisation"

      // Préparer le contenu de l'email
      const emailHtml = `
        <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#0b0b0b;max-width:600px;margin:0 auto">
          <h2 style="margin:0 0 12px 0;color:#0b0b0b">Vous avez été invité à rejoindre ${workspaceName}</h2>
          <p style="margin:0 0 16px 0;color:#374151">Vous avez été invité à rejoindre l'organisation <strong>${workspaceName}</strong> sur Bilibou.</p>
          <p style="margin:0 0 8px 0;color:#374151"><strong>Rôle :</strong> ${role === 'owner' ? 'Propriétaire' : role === 'admin' ? 'Administrateur' : 'Membre'}</p>
          <p style="margin:0 0 24px 0;color:#374151">Cliquez sur le bouton ci-dessous pour accepter l'invitation et accéder à votre organisation.</p>
          <p style="margin:0 0 24px 0;text-align:center">
            <a href="${magicLink.properties.action_link}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500">Rejoindre l'organisation</a>
          </p>
          <p style="margin:0 0 16px 0;color:#6b7280;font-size:12px">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
          <p style="margin:0;color:#6b7280;font-size:12px;word-break:break-all">${magicLink.properties.action_link}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="margin:0;color:#9ca3af;font-size:11px">Cet email a été envoyé automatiquement. Si vous n'avez pas demandé cette invitation, vous pouvez l'ignorer.</p>
        </div>
      `
      const emailSubject = `Invitation à rejoindre ${workspaceName} sur Bilibou`

      // Essayer Resend d'abord (plus fiable)
      const FROM_EMAIL = process.env.INVITES_FROM_EMAIL || process.env.EXPORTS_FROM_EMAIL || 'noreply@bilibou.com'

      if (RESEND_KEY) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [email],
              subject: emailSubject,
              html: emailHtml,
            }),
          })

          if (resendRes.ok) {
            const resendBody = await resendRes.json()
            console.log('✅ Email d\'invitation envoyé via Resend à', email, 'ID:', resendBody.id)
            emailSent = true
          } else {
            const resendError = await resendRes.text()
            console.error('❌ Erreur Resend:', resendError)
          }
        } catch (resendError: any) {
          console.error('❌ Erreur lors de l\'envoi via Resend:', resendError.message)
        }
      }

      // Si Resend n'est pas configuré ou a échoué, essayer SMTP
      if (!emailSent) {
        if (!hasSMTPConfig) {
          console.warn('⚠️ Aucun service d\'email configuré (ni RESEND_API_KEY ni SMTP) - l\'email n\'a pas pu être envoyé')
          console.warn('Variables manquantes:', {
            RESEND_API_KEY: !!RESEND_KEY,
            SMTP_HOST: !!process.env.SMTP_HOST,
            SMTP_USER: !!process.env.SMTP_USER,
            SMTP_PASS: !!process.env.SMTP_PASS
          })
        } else {
          try {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT || 587),
              secure: process.env.SMTP_SECURE === 'true',
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            })

            const emailResult = await transporter.sendMail({
              from: process.env.SMTP_FROM || FROM_EMAIL,
              to: email,
              subject: emailSubject,
              html: emailHtml,
            })

            console.log('✅ Email d\'invitation envoyé via SMTP à', email, 'Message ID:', emailResult.messageId)
            emailSent = true
          } catch (emailError: any) {
            console.error('❌ Erreur lors de l\'envoi de l\'email via SMTP:', emailError)
            console.error('Détails:', {
              message: emailError.message,
              code: emailError.code,
              command: emailError.command,
              response: emailError.response
            })
          }
        }
      }
    } catch (e) {
      console.error('❌ Erreur lors de la génération du magic link:', e)
      // Ne pas faire échouer l'invitation, on peut toujours partager le lien directement
    }

    // Retourner le lien direct si l'email n'a pas pu être envoyé
    
    // Vérifier pourquoi l'email n'a pas été envoyé pour le debug
    if (!emailSent && RESEND_KEY) {
      console.error('⚠️ Resend est configuré mais l\'email n\'a pas été envoyé. Vérifiez les logs ci-dessus.')
    }
    
    return NextResponse.json({ 
      ok: true, 
      token: invite.token,
      emailSent: emailSent,
      hasResendConfig: !!RESEND_KEY,
      hasSMTPConfig: hasSMTPConfig,
      ...(emailSent ? {} : { 
        directLink, 
        message: emailSent ? "" : "Email non envoyé - partagez ce lien manuellement : " + directLink,
        reason: !RESEND_KEY && !hasSMTPConfig 
          ? "Aucun service email configuré (ni Resend ni SMTP)"
          : RESEND_KEY && !emailSent
          ? "Erreur lors de l'envoi via Resend - vérifiez les logs"
          : "Erreur lors de l'envoi email"
      })
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
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

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { inviteId, workspaceId } = await req.json()
    if (!inviteId || !workspaceId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
    }

    // Vérifier les permissions
    const canInvite = await canInviteMembers(supabase, workspaceId, user.id)
    if (!canInvite) {
      return NextResponse.json({ error: "Vous n'avez pas la permission de gérer les invitations" }, { status: 403 })
    }

    // Vérifier que l'invitation appartient bien à ce workspace et qu'elle est encore en attente
    const { data: invite } = await supabase
      .from('workspace_invites')
      .select('id,status,workspace_id')
      .eq('id', inviteId)
      .single()

    if (!invite || invite.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 })
    }

    if (invite.status && invite.status !== 'pending') {
      return NextResponse.json({ error: "Seules les invitations en attente peuvent être révoquées" }, { status: 400 })
    }

    // Marquer l'invitation comme révoquée pour qu'elle disparaisse des "pending"
    const { data: updated, error: updError } = await supabase
      .from('workspace_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .select('id')

    if (updError) throw updError

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Aucune invitation en attente à révoquer" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}