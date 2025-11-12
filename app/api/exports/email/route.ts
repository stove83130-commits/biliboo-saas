import { NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  try {
    const { to, csv, link, subject, htmlAttachment, attachments, emailType, fromEmail } = await req.json()
    if (!to || (!csv && !link && !htmlAttachment && !attachments)) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const RESEND_KEY = process.env.RESEND_API_KEY

    if (!RESEND_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY manquante côté serveur' }, { status: 500 })
    }

    // Fonction pour valider un email et ignorer les placeholders
    const isValidEmail = (email: string | undefined): boolean => {
      if (!email) return false
      // Ignorer les placeholders communs
      const placeholders = ['ton_email_ici', 'your-email', 'email@example.com', 'no-reply@your-domain.test', 'votredomaine.com']
      if (placeholders.some(p => email.toLowerCase().includes(p.toLowerCase()))) return false
      // Validation basique du format email
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    // Debug: Afficher les valeurs des variables d'environnement (masquées partiellement)
    const maskEmail = (email: string | undefined) => {
      if (!email) return 'non défini'
      if (email.length > 10) {
        return email.substring(0, 5) + '...' + email.substring(email.length - 5)
      }
      return email
    }
    console.log('🔍 [EMAIL DEBUG] Variables d\'environnement:', {
      EXPORTS_NO_REPLY_EMAIL: maskEmail(process.env.EXPORTS_NO_REPLY_EMAIL),
      EXPORTS_FROM_EMAIL: maskEmail(process.env.EXPORTS_FROM_EMAIL),
      INVITES_FROM_EMAIL: maskEmail(process.env.INVITES_FROM_EMAIL),
      CONTACT_FROM_EMAIL: maskEmail(process.env.CONTACT_FROM_EMAIL),
    })

    // Déterminer l'expéditeur selon le type d'email ou le paramètre fromEmail
    let FROM: string
    if (fromEmail && isValidEmail(fromEmail)) {
      // Si fromEmail est fourni explicitement et valide, l'utiliser
      FROM = fromEmail
      console.log('🔍 [EMAIL DEBUG] Utilisation de fromEmail fourni:', FROM)
    } else if (emailType === 'exports' || emailType === 'export') {
      // Pour les exports, utiliser no-reply par défaut
      const noReply = process.env.EXPORTS_NO_REPLY_EMAIL
      const fallback = process.env.EXPORTS_FROM_EMAIL
      console.log('🔍 [EMAIL DEBUG] Exports - noReply:', noReply, 'fallback:', fallback)
      FROM = (noReply && isValidEmail(noReply)) 
        ? noReply 
        : (fallback && isValidEmail(fallback)) 
          ? fallback 
          : 'no-reply@bilibou.com'
      console.log('🔍 [EMAIL DEBUG] Email sélectionné pour exports:', FROM)
    } else if (emailType === 'invites' || emailType === 'invite') {
      // Pour les invitations
      const invites = process.env.INVITES_FROM_EMAIL
      const fallback = process.env.EXPORTS_FROM_EMAIL
      FROM = (invites && isValidEmail(invites))
        ? invites
        : (fallback && isValidEmail(fallback))
          ? fallback
          : 'noreply@bilibou.com'
    } else if (emailType === 'contact') {
      // Pour les contacts
      const contact = process.env.CONTACT_FROM_EMAIL
      const fallback = process.env.EXPORTS_FROM_EMAIL
      FROM = (contact && isValidEmail(contact))
        ? contact
        : (fallback && isValidEmail(fallback))
          ? fallback
          : 'noreply@bilibou.com'
    } else {
      // Par défaut, utiliser EXPORTS_FROM_EMAIL ou no-reply
      const fallback = process.env.EXPORTS_FROM_EMAIL
      const noReply = process.env.EXPORTS_NO_REPLY_EMAIL
      FROM = (fallback && isValidEmail(fallback))
        ? fallback
        : (noReply && isValidEmail(noReply))
          ? noReply
          : 'no-reply@bilibou.com'
    }

    // Déterminer le nom de l'expéditeur selon le type d'email
    let fromName: string | undefined
    if (emailType === 'exports' || emailType === 'export') {
      fromName = process.env.EXPORTS_FROM_NAME || 'Bilibou'
    } else if (emailType === 'invites' || emailType === 'invite') {
      fromName = process.env.INVITES_FROM_NAME || 'Bilibou'
    } else if (emailType === 'contact') {
      fromName = process.env.CONTACT_FROM_NAME || 'Bilibou'
    } else {
      fromName = process.env.EXPORTS_FROM_NAME || 'Bilibou'
    }

    // Formater l'expéditeur avec le nom si fourni
    const fromFormatted = fromName ? `${fromName} <${FROM}>` : FROM

    console.log(`📧 [EMAIL] Envoi depuis: ${fromFormatted} (type: ${emailType || 'default'})`)

    // Construire les pièces jointes
    let emailAttachments: any[] | undefined = undefined
    
    if (attachments && Array.isArray(attachments)) {
      // Format: [{ filename: '...', content: 'base64', type: '...' }]
      emailAttachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content, // Déjà en base64
      }))
    } else if (csv) {
      emailAttachments = [{ 
        filename: `export_factures_${Date.now()}.csv`, 
        content: Buffer.from(csv).toString('base64') 
      }]
    } else if (htmlAttachment) {
      emailAttachments = [{ 
        filename: htmlAttachment.filename || `export_${Date.now()}.html`, 
        content: htmlAttachment.content 
      }]
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromFormatted,
        to: [to],
        subject: subject || (csv ? 'Export CSV - Factures' : attachments ? 'Export ZIP - Factures' : 'Export - Lien de téléchargement'),
        html: link
          ? `<p>Votre export est prêt. Téléchargez-le ici:</p><p><a href="${link}">${link}</a></p>`
          : '<p>Veuillez trouver votre export en pièce jointe.</p>',
        attachments: emailAttachments,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Échec Resend: ${text}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur inconnue' }, { status: 500 })
  }
}


