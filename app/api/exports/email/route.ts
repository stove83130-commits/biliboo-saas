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
      // Format Resend: [{ filename: '...', content: 'base64' }]
      // Le content doit être en base64 string (pas de Buffer)
      emailAttachments = attachments.map((att: any) => {
        let content = att.content
        
        // Si content est déjà une string base64, l'utiliser tel quel
        // Sinon, convertir en base64
        if (typeof content !== 'string') {
          content = Buffer.from(content).toString('base64')
        } else {
          // Vérifier si c'est déjà en base64 (commence par data: ou est une string base64 valide)
          if (!content.startsWith('data:') && !/^[A-Za-z0-9+/=]+$/.test(content)) {
            // Si ce n'est pas du base64 valide, convertir
            content = Buffer.from(content).toString('base64')
          } else if (content.startsWith('data:')) {
            // Si c'est un data URL, extraire le base64
            const base64Match = content.match(/base64,(.+)$/)
            if (base64Match) {
              content = base64Match[1]
            }
          }
        }
        
        return {
          filename: att.filename || `attachment_${Date.now()}.pdf`,
          content: content, // Base64 string
        }
      })
    } else if (csv) {
      emailAttachments = [{ 
        filename: `export_factures_${Date.now()}.csv`, 
        content: Buffer.from(csv).toString('base64') 
      }]
    } else if (htmlAttachment) {
      // Pour HTML, convertir en base64
      const htmlContent = typeof htmlAttachment.content === 'string' 
        ? htmlAttachment.content 
        : Buffer.from(htmlAttachment.content).toString('utf-8')
      emailAttachments = [{ 
        filename: htmlAttachment.filename || `export_${Date.now()}.html`, 
        content: Buffer.from(htmlContent).toString('base64')
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
      console.error('❌ [EMAIL] Erreur Resend:', {
        status: res.status,
        statusText: res.statusText,
        response: text.substring(0, 500)
      })
      
      // Détecter si c'est une panne Resend (500, 503, 502)
      const isResendDown = res.status >= 500 && res.status < 600
      
      // Essayer de parser la réponse JSON si possible
      let errorMessage = text
      try {
        const errorJson = JSON.parse(text)
        errorMessage = errorJson.message || errorJson.error || text
      } catch {
        // Si ce n'est pas du JSON, utiliser le texte brut
      }
      
      return NextResponse.json({ 
        ok: false,
        error: isResendDown 
          ? 'Service d\'envoi d\'email temporairement indisponible. Le téléchargement direct est toujours disponible.'
          : `Échec envoi email: ${errorMessage}`,
        resendDown: isResendDown,
        // Toujours retourner le lien si disponible pour permettre le téléchargement direct
        downloadLink: link || undefined
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('❌ [EMAIL] Exception:', e)
    return NextResponse.json({ 
      ok: false,
      error: e?.message || 'Erreur inconnue lors de l\'envoi de l\'email',
      resendDown: true, // En cas d'exception, considérer que Resend est down
      downloadLink: link || undefined
    }, { status: 500 })
  }
}


