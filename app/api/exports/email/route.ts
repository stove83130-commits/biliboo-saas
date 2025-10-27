import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { to, csv, link, subject, htmlAttachment } = await req.json()
    if (!to || (!csv && !link && !htmlAttachment)) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const RESEND_KEY = process.env.RESEND_API_KEY
    const FROM = process.env.EXPORTS_FROM_EMAIL || 'no-reply@your-domain.test'

    if (!RESEND_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY manquante côté serveur' }, { status: 500 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: subject || (csv ? 'Export CSV - Factures' : 'Export - Lien de téléchargement'),
        html: link
          ? `<p>Votre export est prêt. Téléchargez-le ici:</p><p><a href="${link}">${link}</a></p>`
          : '<p>Veuillez trouver votre export en pièce jointe.</p>',
        attachments: (
          csv
            ? [{ filename: `export_factures_${Date.now()}.csv`, content: Buffer.from(csv).toString('base64') }]
            : htmlAttachment
              ? [{ filename: htmlAttachment.filename || `export_${Date.now()}.html`, content: htmlAttachment.content }]
              : undefined
        ),
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


