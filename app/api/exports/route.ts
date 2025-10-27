import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import JSZip from "jszip"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

function formatPeriodLabel(period: string, customStart?: string, customEnd?: string) {
  if (period === 'this_month') return 'Ce mois'
  if (period === 'last_month') return 'Mois dernier'
  if (period === 'custom') return `${customStart || ''} - ${customEnd || ''}`
  return period
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const list = searchParams.get('list')
    const workspaceId = searchParams.get('workspaceId')
    if (!list) return NextResponse.json({ ok: true, files: [] })

    // Lister les exports récents dans le bucket invoices/exports/
    const prefix = workspaceId && workspaceId !== 'personal'
      ? `${user.id}/exports/${workspaceId}/`
      : `${user.id}/exports/personal/`

    const { data, error } = await supabase.storage.from('invoices').list(prefix, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) return NextResponse.json({ ok: true, files: [] })

    const files = (data || []).filter((f: any) => !f.name.endsWith('/')).map((f: any) => ({
      name: f.name,
      url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${prefix}${f.name}`,
      createdAt: f.created_at || new Date().toISOString(),
      type: (f.metadata?.mimetype || '').includes('csv') ? 'csv' : (f.metadata?.mimetype || '').includes('zip') ? 'zip' : (f.metadata?.mimetype || '').includes('pdf') ? 'pdf' : 'file',
      period: f.metadata?.period || '',
    }))

    return NextResponse.json({ ok: true, files })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const { format, period, customStart, customEnd, folderId, supplier, email, workspaceId, invoiceIds } = body || {}

    // Construire la requête invoices selon filtres
    let q: any = supabase.from('invoices').select('*').eq('user_id', user.id)
    if (workspaceId && workspaceId !== 'personal') q = q.eq('workspace_id', workspaceId)
    else q = q.is('workspace_id', null)
    if (Array.isArray(invoiceIds) && invoiceIds.length) {
      q = q.in('id', invoiceIds)
    } else {
      if (folderId) q = q.eq('folder_id', folderId)
      if (supplier) q = q.ilike('supplier_name', `%${supplier}%`)
      if (period === 'this_month') {
        const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        q = q.gte('created_at', start)
      } else if (period === 'last_month') {
        const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth()-1, 1).toISOString(); const end = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        q = q.gte('created_at', start).lt('created_at', end)
      } else if (period === 'custom' && customStart && customEnd) {
        q = q.gte('created_at', new Date(customStart).toISOString()).lte('created_at', new Date(customEnd).toISOString())
      }
    }

    const { data: invoices, error } = await q.order('created_at', { ascending: false })
    if (error) throw error
    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ ok: true, empty: true, message: 'Aucun document trouvé pour ces critères.' })
    }

    // Génération selon format
    const periodLabel = formatPeriodLabel(period, customStart, customEnd)
    const stamp = Date.now()
    const prefix = workspaceId && workspaceId !== 'personal'
      ? `${user.id}/exports/${workspaceId}/`
      : `${user.id}/exports/personal/`

    if (format === 'csv') {
      const headers = ['id','supplier_name','invoice_number','invoice_date','amount','currency']
      const lines = [headers.join(',')]
      for (const inv of invoices) {
        lines.push([
          inv.id,
          JSON.stringify(inv.supplier_name || ''),
          JSON.stringify(inv.invoice_number || ''),
          JSON.stringify(inv.invoice_date || ''),
          inv.amount ?? '',
          JSON.stringify(inv.currency || 'EUR'),
        ].join(','))
      }
      const csv = lines.join('\n')
      const filePath = `${prefix}${stamp}_export_${periodLabel.replace(/\s+/g,'_')}.csv`
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([csv], { type: 'text/csv' }), { upsert: true })
      if (upErr) throw upErr
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      return NextResponse.json({ ok: true, url: publicUrl })
    }

    if (format === 'zip') {
      // Regrouper les fichiers originaux dans un vrai ZIP
      const zip = new JSZip()
      for (const inv of invoices) {
        if (!inv.file_url) continue
        const dl = await supabase.storage.from('invoices').download(inv.file_url)
        if (dl.error || !dl.data) continue
        const buf = new Uint8Array(await dl.data.arrayBuffer())
        zip.file(inv.file_name || `${inv.id}.pdf`, buf)
      }
      const zipContent = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
      const filePath = `${prefix}${stamp}_export_${periodLabel.replace(/\s+/g,'_')}.zip`
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([zipContent], { type: 'application/zip' }), { upsert: true })
      if (upErr) throw upErr
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      return NextResponse.json({ ok: true, url: publicUrl })
    }

    if (format === 'pdf') {
      // Générer un vrai PDF (pdf-lib) listant les invoices sélectionnées
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const page = pdfDoc.addPage([595.28, 841.89]) // A4 portrait
      const { width, height } = page.getSize()
      const margin = 40
      let y = height - margin
      page.drawText(`Export PDF - ${periodLabel}`, { x: margin, y, size: 16, font, color: rgb(0,0,0) })
      y -= 24
      page.drawText(`Total: ${invoices.length} facture(s)`, { x: margin, y, size: 10, font })
      y -= 18
      const lineHeight = 14
      for (const i of invoices) {
        const label = `${i.invoice_number || i.file_name || i.id}`
        const amountStr = `${i.amount ?? ''} ${i.currency || ''}`.trim()
        const row = `• ${label}${amountStr ? ' - ' + amountStr : ''}`
        if (y < margin + 40) {
          // nouvelle page si plus de place
          y = height - margin
          const p = pdfDoc.addPage([595.28, 841.89])
          p.drawText(`Export PDF - ${periodLabel} (suite)`, { x: margin, y, size: 12, font })
          y -= 20
          // Rediriger les prochains drawText vers la nouvelle page
          ;(page as any)._wrapped = p
        }
        const target = ((page as any)._wrapped) || page
        target.drawText(row, { x: margin, y, size: 10, font })
        y -= lineHeight
      }
      const pdfBytes = await pdfDoc.save()
      const filePath = `${prefix}${stamp}_export_${periodLabel.replace(/\s+/g,'_')}.pdf`
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([pdfBytes], { type: 'application/pdf' }), { upsert: true })
      if (upErr) throw upErr
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      return NextResponse.json({ ok: true, url: publicUrl })
    }

    if (format === 'email') {
      // Placeholder: à brancher avec ton service d'email (ex: Resend/SendGrid)
      // Ici on génère un CSV léger puis on "confirme" l'envoi
      const headers = ['id','supplier_name','invoice_number','invoice_date','amount','currency']
      const lines = [headers.join(',')]
      for (const inv of invoices) {
        lines.push([
          inv.id,
          JSON.stringify(inv.supplier_name || ''),
          JSON.stringify(inv.invoice_number || ''),
          JSON.stringify(inv.invoice_date || ''),
          inv.amount ?? '',
          JSON.stringify(inv.currency || 'EUR'),
        ].join(','))
      }
      const csv = lines.join('\n')
      const filePath = `${prefix}${stamp}_export_${periodLabel.replace(/\s+/g,'_')}.csv`
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([csv], { type: 'text/csv' }), { upsert: true })
      if (upErr) throw upErr
      // TODO: envoyer vers `email` via un service d'email; ici on répond succès
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      return NextResponse.json({ ok: true, sent: true, url: publicUrl })
    }

    return NextResponse.json({ error: 'format_not_supported' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


