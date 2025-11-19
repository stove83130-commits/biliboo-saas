import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const {
      invoiceIds,
      format,
      options,
      destination,
      destinationEmail,
    } = body

    // Récupérer les factures sélectionnées
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .in('id', invoiceIds)
      .eq('user_id', user.id)

    if (invoicesError || !invoices) {
      return NextResponse.json({ error: 'Erreur récupération factures' }, { status: 500 })
    }

    // Calculer le montant total
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)

    // Générer le fichier selon le format
    let fileContent: string
    let fileName: string
    let mimeType: string

    if (format === 'csv') {
      const result = generateCSV(invoices, options)
      fileContent = result.content
      fileName = result.fileName
      mimeType = 'text/csv'
    } else if (format === 'zip') {
      // Pour ZIP, on doit utiliser l'API route.ts qui gère JSZip
      // Ici on retourne une erreur car ZIP doit être géré par /api/exports
      return NextResponse.json({ error: 'ZIP format doit être exporté via /api/exports' }, { status: 400 })
    } else if (format === 'pdf') {
      const result = generatePDF(invoices, options)
      fileContent = result.content
      fileName = result.fileName
      mimeType = 'application/pdf'
    } else {
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
    }

    // Sauvegarder dans l'historique
    const { data: exportRecord, error: exportError } = await supabase
      .from('export_history')
      .insert({
        user_id: user.id,
        format,
        invoice_count: invoices.length,
        total_amount: totalAmount,
        destination,
        destination_email: destinationEmail || null,
        file_name: fileName,
        file_size: Buffer.from(fileContent).length,
        options,
      })
      .select()
      .single()

    if (exportError) {
      console.error('Erreur sauvegarde historique:', exportError)
    }

    // Retourner le fichier selon la destination
    if (destination === 'download') {
      // Téléchargement direct
      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    } else if (destination === 'email' && destinationEmail) {
      // Envoyer le fichier par email
      console.log('🔍 [EXPORTS GENERATE] Envoi par email à:', destinationEmail, 'format:', format)
      try {
        // Convertir le contenu en base64 pour l'envoi
        let fileBase64: string
        if (format === 'pdf') {
          // Pour PDF (HTML), convertir en base64
          fileBase64 = Buffer.from(fileContent, 'utf-8').toString('base64')
        } else {
          // Pour CSV, convertir en base64
          fileBase64 = Buffer.from(fileContent, 'utf-8').toString('base64')
        }

        // Déterminer le type MIME et l'extension
        const attachmentType = format === 'pdf' ? 'text/html' : 'text/csv'
        const attachmentExtension = format === 'pdf' ? 'html' : 'csv'

        // Appeler l'API d'envoi d'email
        const origin = request.headers.get('origin') || request.headers.get('host')
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (origin ? `https://${origin}` : 'http://localhost:3001')
        
        const emailResponse = await fetch(`${baseUrl}/api/exports/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: destinationEmail,
            emailType: 'exports',
            subject: `Export ${format.toUpperCase()} - ${invoices.length} facture${invoices.length > 1 ? 's' : ''}`,
            attachments: [{
              filename: `export_factures_${new Date().toISOString().split('T')[0]}.${attachmentExtension}`,
              content: fileBase64,
              type: attachmentType
            }]
          }),
        })

        const emailData = await emailResponse.json()
        if (!emailResponse.ok || !emailData.ok) {
          console.error('❌ [EXPORTS GENERATE] Erreur envoi email:', emailData.error)
          return NextResponse.json({
            success: false,
            error: emailData.error || 'Erreur lors de l\'envoi de l\'email',
            exportId: exportRecord?.id,
          }, { status: 500 })
        }

        console.log('✅ [EXPORTS GENERATE] Email envoyé avec succès')
        return NextResponse.json({
          success: true,
          message: `Export envoyé à ${destinationEmail}`,
          exportId: exportRecord?.id,
          emailSent: true,
        })
      } catch (emailError: any) {
        console.error('❌ [EXPORTS GENERATE] Erreur lors de l\'envoi de l\'email:', emailError)
        return NextResponse.json({
          success: false,
          error: emailError.message || 'Erreur lors de l\'envoi de l\'email',
          exportId: exportRecord?.id,
        }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur génération export:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération de l\'export' },
      { status: 500 }
    )
  }
}

// Générer un fichier CSV
function generateCSV(invoices: any[], options: any) {
  const columns = options.columns || [
    'invoice_number',
    'vendor',
    'date',
    'amount',
    'currency',
    'payment_status',
    'category',
  ]

  // En-têtes
  const headers = columns.map((col: string) => {
    const labels: Record<string, string> = {
      invoice_number: 'Numéro de facture',
      vendor: 'Fournisseur',
      date: 'Date',
      amount: 'Montant',
      currency: 'Devise',
      payment_status: 'Statut',
      category: 'Catégorie',
      description: 'Description',
    }
    return labels[col] || col
  })

  let csv = headers.join(',') + '\n'

  // Données
  invoices.forEach((invoice) => {
    const row = columns.map((col: string) => {
      let value = invoice[col] || ''
      
      // Formater les dates
      if (col === 'date' && value) {
        value = new Date(value).toLocaleDateString('fr-FR')
      }
      
      // Échapper les virgules et guillemets
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`
      }
      
      return value
    })
    csv += row.join(',') + '\n'
  })

  const fileName = `export_factures_${new Date().toISOString().split('T')[0]}.csv`

  return { content: csv, fileName }
}

// Générer un fichier PDF
function generatePDF(invoices: any[], options: any) {
  const template = options.pdfOptions?.template || 'classic'
  const includePaymentTerms = options.pdfOptions?.includePaymentTerms || false
  const includeNotes = options.pdfOptions?.includeNotes || false

  // HTML simple pour le PDF (à améliorer avec une vraie lib PDF)
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #16a34a; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background-color: #16a34a; color: white; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    .total { font-weight: bold; background-color: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Export de Factures</h1>
  <p>Date d'export : ${new Date().toLocaleDateString('fr-FR')}</p>
  <p>Nombre de factures : ${invoices.length}</p>
  
  <table>
    <thead>
      <tr>
        <th>N° Facture</th>
        <th>Fournisseur</th>
        <th>Date</th>
        <th>Montant</th>
        <th>Statut</th>
        <th>Catégorie</th>
      </tr>
    </thead>
    <tbody>
`

  invoices.forEach((invoice) => {
    html += `
      <tr>
        <td>${invoice.invoice_number || '-'}</td>
        <td>${invoice.vendor || '-'}</td>
        <td>${invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : '-'}</td>
        <td>${invoice.amount?.toFixed(2) || '0.00'} ${invoice.currency || 'EUR'}</td>
        <td>${invoice.payment_status || '-'}</td>
        <td>${invoice.category || '-'}</td>
      </tr>
    `
  })

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)

  html += `
      <tr class="total">
        <td colspan="3">TOTAL</td>
        <td>${totalAmount.toFixed(2)} EUR</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
`

  if (includePaymentTerms) {
    html += `
  <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #16a34a;">
    <h3>Conditions de paiement</h3>
    <p>Paiement à 30 jours fin de mois.</p>
  </div>
`
  }

  if (includeNotes) {
    html += `
  <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
    <h3>Notes internes</h3>
    <p>Export généré automatiquement.</p>
  </div>
`
  }

  html += `
</body>
</html>
`

  const fileName = `export_factures_${new Date().toISOString().split('T')[0]}.html`

  return { content: html, fileName }
}

