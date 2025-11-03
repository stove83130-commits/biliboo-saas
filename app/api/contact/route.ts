import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, phone, company, jobTitle, useCase } = body

    // Validation des champs obligatoires
    if (!email || !firstName || !lastName || !company || !jobTitle || !useCase) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      )
    }

    // Préparer le contenu de l'email
    const RESEND_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.EXPORTS_FROM_EMAIL || process.env.INVITES_FROM_EMAIL || 'noreply@bilibou.com'
    const TO_EMAIL = process.env.CONTACT_EMAIL || 'contact@bilibou.com' // Email où recevoir les demandes de contact

    if (!RESEND_KEY) {
      console.error('❌ RESEND_API_KEY manquante')
      return NextResponse.json(
        { error: 'Configuration email manquante' },
        { status: 500 }
      )
    }

    // Construire le contenu de l'email
    const emailSubject = `Nouvelle demande de contact - Plan Entreprise - ${company}`
    
    const useCaseLabels: Record<string, string> = {
      'invoice-extraction': 'Extraction de factures',
      'automation': 'Automatisation comptable',
      'team-collaboration': 'Collaboration d\'équipe',
      'export': 'Export et intégration'
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Inter, system-ui, -apple-system, sans-serif; line-height: 1.6; color: #0b0b0b; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
            .field { margin-bottom: 20px; }
            .label { font-weight: 600; color: #374151; margin-bottom: 5px; display: block; }
            .value { color: #111827; padding: 8px 12px; background: #f9fafb; border-radius: 6px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nouvelle demande de contact - Plan Entreprise</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
                Vous avez reçu une nouvelle demande de contact pour le plan Entreprise.
              </p>
              
              <div class="field">
                <span class="label">📧 Email professionnel</span>
                <div class="value">${email}</div>
              </div>
              
              <div class="field">
                <span class="label">👤 Nom complet</span>
                <div class="value">${firstName} ${lastName}</div>
              </div>
              
              ${phone ? `
              <div class="field">
                <span class="label">📱 Téléphone</span>
                <div class="value">${phone}</div>
              </div>
              ` : ''}
              
              <div class="field">
                <span class="label">🏢 Entreprise</span>
                <div class="value">${company}</div>
              </div>
              
              <div class="field">
                <span class="label">💼 Fonction</span>
                <div class="value">${jobTitle}</div>
              </div>
              
              <div class="field">
                <span class="label">🎯 Intérêt</span>
                <div class="value">${useCaseLabels[useCase] || useCase}</div>
              </div>
              
              <div class="footer">
                <p>Ce message a été envoyé depuis le formulaire de contact Bilibou.</p>
                <p>Répondez directement à cet email pour contacter le prospect.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Envoyer l'email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email, // Permettre de répondre directement au prospect
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur Resend:', errorText)
      return NextResponse.json(
        { error: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('✅ Email de contact envoyé:', result.id, 'à', TO_EMAIL)

    return NextResponse.json({ 
      success: true,
      message: 'Votre message a été envoyé avec succès. Notre équipe vous recontactera dans les 24 heures.'
    })

  } catch (error: any) {
    console.error('❌ Erreur API contact:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur interne lors de l\'envoi du formulaire' },
      { status: 500 }
    )
  }
}

