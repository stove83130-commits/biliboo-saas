import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import JSZip from "jszip"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import fs from "fs"
import path from "path"


export const dynamic = 'force-dynamic'
function formatPeriodLabel(period: string, customStart?: string, customEnd?: string) {
  if (period === 'this_month') return 'Ce mois'
  if (period === 'last_month') return 'Mois dernier'
  if (period === 'custom') return `${customStart || ''} - ${customEnd || ''}`
  return period
}

// Fonction helper pour enregistrer l'historique des exports
async function saveExportHistory(
  supabase: any,
  userId: string,
  format: string,
  invoiceCount: number,
  totalAmount: number,
  destination: string,
  destinationEmail: string | null,
  fileUrl: string,
  fileName: string,
  fileSize: number,
  options: any
) {
  try {
    // Normaliser le format pour la base de données (supporter zip même si pas dans le CHECK initial)
    const normalizedFormat = format.toLowerCase()
    
    const { error: historyError } = await supabase
      .from('export_history')
      .insert({
        user_id: userId,
        format: normalizedFormat,
        invoice_count: invoiceCount,
        total_amount: totalAmount,
        destination: destination,
        destination_email: destinationEmail,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        options: options || null,
      })

    if (historyError) {
      // Si l'erreur est due à la contrainte CHECK (format non supporté), on essaie quand même
      // ou on log juste l'erreur sans bloquer l'export
      console.warn('⚠️ [EXPORTS API] Erreur enregistrement historique (non bloquant):', historyError)
    } else {
      console.log('✅ [EXPORTS API] Historique enregistré avec succès')
    }
  } catch (error) {
    // Ne pas bloquer l'export si l'historique échoue
    console.warn('⚠️ [EXPORTS API] Erreur enregistrement historique (non bloquant):', error)
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
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
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const { format, period, customStart, customEnd, folderId, supplier, email, workspaceId, invoiceIds, destination, destinationEmail, options } = body || {}
    
    // Normaliser invoiceIds : s'assurer que c'est un tableau
    let normalizedInvoiceIds: string[] | null = null
    if (invoiceIds) {
      if (Array.isArray(invoiceIds)) {
        normalizedInvoiceIds = invoiceIds
      } else if (typeof invoiceIds === 'string' || typeof invoiceIds === 'number') {
        // Si c'est un seul ID (string ou number), le convertir en tableau
        normalizedInvoiceIds = [String(invoiceIds)]
      }
    }
    
    console.log('🔍 [EXPORTS API] Requête reçue:', { format, invoiceIds: normalizedInvoiceIds, invoiceIdsCount: normalizedInvoiceIds?.length, workspaceId })

    // Construire la requête invoices selon filtres
    // 🔧 FIX : Charger toutes les factures puis filtrer côté serveur (comme dans le frontend)
    let q: any = supabase.from('invoices').select('*').eq('user_id', user.id)
    
    // Note: Le filtrage par workspace sera fait après la requête pour gérer les workspaces personnels
    if (normalizedInvoiceIds && normalizedInvoiceIds.length > 0) {
      q = q.in('id', normalizedInvoiceIds)
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

    const { data: allInvoices, error } = await q.order('created_at', { ascending: false })
    if (error) {
      console.error('❌ [EXPORTS API] Erreur récupération factures:', error)
      throw error
    }
    
    console.log('🔍 [EXPORTS API] Factures récupérées:', allInvoices?.length || 0)
    
    // 🔧 FIX : Filtrer par workspace côté serveur (comme dans le frontend)
    // MAIS : Si on a des invoiceIds spécifiques, on ne filtre PAS par workspace
    // car les factures sélectionnées peuvent être dans différents workspaces
    let invoices = allInvoices || []
    
    // Si on a des invoiceIds spécifiques, on ne filtre pas par workspace
    // (l'utilisateur a sélectionné des factures spécifiques, on les prend telles quelles)
    if (!normalizedInvoiceIds || normalizedInvoiceIds.length === 0) {
      // Seulement filtrer par workspace si on n'a pas d'invoiceIds spécifiques
      if (workspaceId && workspaceId !== 'personal' && workspaceId.trim() !== '') {
        // Workspace d'organisation : filtrer par workspace_id
        invoices = invoices.filter((inv: any) => inv.workspace_id === workspaceId)
        console.log('🔍 [EXPORTS API] Après filtrage workspace organisation:', invoices.length)
      } else {
        // Workspace personnel : workspace_id est null ou 'personal'
        invoices = invoices.filter((inv: any) => 
          inv.workspace_id === null || 
          inv.workspace_id === 'personal' || 
          !inv.workspace_id
        )
        console.log('🔍 [EXPORTS API] Après filtrage workspace personnel:', invoices.length)
      }
    } else {
      console.log('🔍 [EXPORTS API] Factures sélectionnées par ID, pas de filtrage workspace appliqué')
    }
    
    if (!invoices || invoices.length === 0) {
      console.warn('⚠️ [EXPORTS API] Aucune facture trouvée après filtrage')
      return NextResponse.json({ ok: false, error: 'Aucun document trouvé pour ces critères.' }, { status: 404 })
    }

    // Calculer le montant total des factures
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)

    // Génération selon format
    // Si period n'est pas défini (cas où on utilise invoiceIds), utiliser une valeur par défaut
    let periodLabel = 'selection' // Valeur par défaut
    if (period) {
      const formatted = formatPeriodLabel(period, customStart, customEnd)
      periodLabel = formatted || 'selection'
    }
    // S'assurer que periodLabel est toujours une chaîne valide
    periodLabel = String(periodLabel || 'selection').replace(/\s+/g, '_')
    const stamp = Date.now()
    const prefix = workspaceId && workspaceId !== 'personal'
      ? `${user.id}/exports/${workspaceId}/`
      : `${user.id}/exports/personal/`

    if (format === 'zip') {
      console.log('🔍 [EXPORTS API] Génération ZIP pour', invoices.length, 'factures')
      // Regrouper les fichiers originaux dans un vrai ZIP
      const zip = new JSZip()
      let fileCount = 0
      let invoicesWithoutFile = 0
      
      for (const inv of invoices) {
        // Vérifier les deux noms de colonnes possibles : file_url ou original_file_url
        const fileUrl = inv.file_url || inv.original_file_url
        if (!fileUrl) {
          invoicesWithoutFile++
          console.warn(`⚠️ [EXPORTS API] Facture ${inv.id} n'a pas de file_url ni original_file_url`)
          console.warn(`🔍 [EXPORTS API] Colonnes disponibles:`, Object.keys(inv).filter(k => k.includes('file') || k.includes('url')))
          continue
        }
        try {
          console.log(`🔍 [EXPORTS API] Téléchargement fichier pour facture ${inv.id}:`, fileUrl)
          
          // Déterminer si fileUrl est une URL complète ou un chemin relatif
          let filePath: string
          let downloadMethod: 'storage' | 'fetch'
          
          if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            // C'est une URL complète, on doit extraire le chemin relatif
            // Format: https://...supabase.co/storage/v1/object/public/invoices/PATH
            const urlMatch = fileUrl.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/)
            if (urlMatch && urlMatch[1]) {
              filePath = urlMatch[1]
              downloadMethod = 'storage'
              console.log(`🔍 [EXPORTS API] Chemin extrait depuis URL: ${filePath}`)
            } else {
              // Si on ne peut pas extraire le chemin, télécharger directement via fetch
              downloadMethod = 'fetch'
              console.log(`🔍 [EXPORTS API] Téléchargement direct via fetch depuis URL publique`)
            }
          } else {
            // C'est déjà un chemin relatif
            filePath = fileUrl
            downloadMethod = 'storage'
          }
          
          let buf: Uint8Array
          
          if (downloadMethod === 'storage') {
            const dl = await supabase.storage.from('invoices').download(filePath)
            if (dl.error || !dl.data) {
              console.warn(`❌ [EXPORTS API] Impossible de télécharger le fichier pour la facture ${inv.id}:`, dl.error)
              continue
            }
            buf = new Uint8Array(await dl.data.arrayBuffer())
          } else {
            // Télécharger directement depuis l'URL publique
            const response = await fetch(fileUrl)
            if (!response.ok) {
              console.warn(`❌ [EXPORTS API] Impossible de télécharger le fichier depuis l'URL publique: ${response.status} ${response.statusText}`)
              continue
            }
            const arrayBuffer = await response.arrayBuffer()
            buf = new Uint8Array(arrayBuffer)
          }
          
          // Utiliser original_file_name ou file_name ou générer un nom par défaut
          const fileName = inv.original_file_name || inv.file_name || `${inv.invoice_number || inv.id}.pdf`
          zip.file(fileName, buf)
          fileCount++
          console.log(`✅ [EXPORTS API] Fichier ajouté au ZIP: ${fileName}`)
        } catch (error) {
          console.warn(`❌ [EXPORTS API] Erreur lors du traitement de la facture ${inv.id}:`, error)
          continue
        }
      }
      
      console.log(`🔍 [EXPORTS API] Résumé ZIP: ${fileCount} fichiers ajoutés, ${invoicesWithoutFile} factures sans fichier`)
      
      if (fileCount === 0) {
        console.error('❌ [EXPORTS API] Aucun fichier à exporter dans le ZIP')
        return NextResponse.json({ 
          ok: false, 
          error: 'Aucun fichier à exporter. Les factures sélectionnées n\'ont pas de fichiers associés.' 
        }, { status: 400 })
      }
      
      console.log('🔍 [EXPORTS API] Génération du contenu ZIP...')
      const zipContent = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
      const filePath = `${prefix}${stamp}_export_${periodLabel}.zip`
      console.log('🔍 [EXPORTS API] Upload ZIP vers:', filePath)
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([zipContent], { type: 'application/zip' }), { upsert: true })
      if (upErr) {
        console.error('❌ [EXPORTS API] Erreur upload ZIP:', upErr)
        throw upErr
      }
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      console.log('✅ [EXPORTS API] ZIP généré avec succès:', publicUrl)
      
      // Enregistrer dans l'historique
      await saveExportHistory(
        supabase,
        user.id,
        'zip',
        invoices.length,
        totalAmount,
        destination || 'download',
        destinationEmail || null,
        publicUrl,
        `export_${periodLabel}.zip`,
        zipContent.length,
        options || null
      )
      
      // Si destination est 'email', envoyer le fichier par email
      if (destination === 'email' && destinationEmail) {
        console.log('🔍 [EXPORTS API] Envoi du ZIP par email à:', destinationEmail)
        try {
          // Télécharger le fichier ZIP depuis l'URL publique
          const fileResponse = await fetch(publicUrl)
          if (!fileResponse.ok) {
            throw new Error(`Erreur HTTP lors du téléchargement: ${fileResponse.status}`)
          }
          const zipBuffer = await fileResponse.arrayBuffer()
          const zipBase64 = Buffer.from(zipBuffer).toString('base64')
          
          // Appeler l'API d'envoi d'email
          // Utiliser l'URL de base depuis l'environnement ou construire depuis la requête
          const origin = request.headers.get('origin') || request.headers.get('host')
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (origin ? `https://${origin}` : 'http://localhost:3001')
          const emailResponse = await fetch(`${baseUrl}/api/exports/email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: destinationEmail,
              link: publicUrl,
              subject: `Export ZIP - ${invoices.length} facture${invoices.length > 1 ? 's' : ''}`,
              emailType: 'exports', // Spécifier le type d'email pour utiliser no-reply
              attachments: [{
                filename: `export_factures_${new Date().toISOString().split('T')[0]}.zip`,
                content: zipBase64,
                type: 'application/zip'
              }]
            }),
          })
          
          const emailData = await emailResponse.json()
            if (!emailResponse.ok || !emailData.ok) {
              console.error('❌ [EXPORTS API] Erreur envoi email:', emailData.error)
              // Retourner quand même l'URL pour que l'utilisateur puisse télécharger
              return NextResponse.json({ 
                ok: true, 
                url: publicUrl, 
                emailSent: false,
                emailError: emailData.error || 'Erreur lors de l\'envoi de l\'email',
                downloadAvailable: true,
                resendDown: emailData.resendDown || false
              })
            }
          
          console.log('✅ [EXPORTS API] Email envoyé avec succès')
          return NextResponse.json({ ok: true, url: publicUrl, emailSent: true })
        } catch (emailError: any) {
          console.error('❌ [EXPORTS API] Erreur lors de l\'envoi de l\'email:', emailError)
          // Retourner quand même l'URL pour que l'utilisateur puisse télécharger
          return NextResponse.json({ 
            ok: true, 
            url: publicUrl, 
            emailSent: false,
            emailError: emailError.message || 'Erreur lors de l\'envoi de l\'email',
            downloadAvailable: true,
            resendDown: true
          })
        }
      }
      
      return NextResponse.json({ ok: true, url: publicUrl })
    }

    if (format === 'pdf') {
      // PDF = Envoyer les fichiers originaux extraits des emails
      // Si une seule facture, envoyer le PDF original directement
      // Si plusieurs factures, créer un ZIP avec tous les PDFs originaux
      
      if (invoices.length === 1) {
        // Une seule facture : envoyer le PDF original directement
        const inv = invoices[0]
        const fileUrl = inv.file_url || inv.original_file_url
        
        if (!fileUrl) {
          return NextResponse.json({ 
            ok: false, 
            error: 'Cette facture n\'a pas de fichier associé.' 
          }, { status: 400 })
        }
        
        // Télécharger le fichier original
        let filePath: string
        let downloadMethod: 'storage' | 'fetch'
        
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          // C'est une URL complète
          if (fileUrl.includes('/storage/v1/object/public/invoices/')) {
            // Extraire le chemin relatif depuis l'URL Supabase
            const urlParts = fileUrl.split('/storage/v1/object/public/invoices/')
            if (urlParts.length > 1) {
              filePath = urlParts[1]
              downloadMethod = 'storage'
            } else {
              downloadMethod = 'fetch'
            }
          } else {
            downloadMethod = 'fetch'
          }
        } else {
          filePath = fileUrl
          downloadMethod = 'storage'
        }
        
        let fileBuffer: Uint8Array
        if (downloadMethod === 'storage') {
          const dl = await supabase.storage.from('invoices').download(filePath)
          if (dl.error || !dl.data) {
            return NextResponse.json({ 
              ok: false, 
              error: 'Impossible de télécharger le fichier.' 
            }, { status: 500 })
          }
          fileBuffer = new Uint8Array(await dl.data.arrayBuffer())
        } else {
          const response = await fetch(fileUrl)
          if (!response.ok) {
            return NextResponse.json({ 
              ok: false, 
              error: 'Impossible de télécharger le fichier.' 
            }, { status: 500 })
          }
          const arrayBuffer = await response.arrayBuffer()
          fileBuffer = new Uint8Array(arrayBuffer)
        }
        
        // Upload le fichier pour le rendre accessible
        const fileName = inv.original_file_name || inv.file_name || `${inv.invoice_number || inv.id}.pdf`
        const exportFileName = `${prefix}${stamp}_${fileName}`
        const { error: upErr } = await supabase.storage.from('invoices').upload(exportFileName, new Blob([fileBuffer], { type: 'application/pdf' }), { upsert: true })
        if (upErr) throw upErr
        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${exportFileName}`
        
        // Enregistrer dans l'historique
        await saveExportHistory(
          supabase,
          user.id,
          'pdf',
          invoices.length,
          totalAmount,
          destination || 'download',
          destinationEmail || null,
          publicUrl,
          fileName,
          fileBuffer.length,
          options || null
        )
        
        // Si destination est 'email', envoyer le fichier par email
        if (destination === 'email' && destinationEmail) {
          console.log('🔍 [EXPORTS API] Envoi du PDF original par email à:', destinationEmail)
          try {
            const pdfBase64 = Buffer.from(fileBuffer).toString('base64')
            const origin = request.headers.get('origin') || request.headers.get('host')
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (origin ? `https://${origin}` : 'http://localhost:3001')
            const emailResponse = await fetch(`${baseUrl}/api/exports/email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: destinationEmail,
                link: publicUrl,
                subject: `Facture PDF - ${inv.vendor || inv.supplier_name || 'Facture'}`,
                emailType: 'exports',
                attachments: [{
                  filename: fileName,
                  content: pdfBase64,
                  type: 'application/pdf'
                }]
              }),
            })
            
            const emailData = await emailResponse.json()
            if (!emailResponse.ok || !emailData.ok) {
              console.error('❌ [EXPORTS API] Erreur envoi email:', emailData.error)
              return NextResponse.json({ 
                ok: true, 
                url: publicUrl, 
                emailSent: false,
                emailError: emailData.error || 'Erreur lors de l\'envoi de l\'email'
              })
            }
            
            console.log('✅ [EXPORTS API] Email envoyé avec succès')
            return NextResponse.json({ ok: true, url: publicUrl, emailSent: true })
          } catch (emailError: any) {
            console.error('❌ [EXPORTS API] Erreur lors de l\'envoi de l\'email:', emailError)
            return NextResponse.json({ 
              ok: true, 
              url: publicUrl, 
              emailSent: false,
              emailError: emailError.message || 'Erreur lors de l\'envoi de l\'email'
            })
          }
        }
        
        return NextResponse.json({ ok: true, url: publicUrl })
      } else {
        // Plusieurs factures : créer un ZIP avec tous les PDFs originaux (même logique que ZIP actuellement)
        const zip = new JSZip()
        let fileCount = 0
        let invoicesWithoutFile = 0
        
        for (const inv of invoices) {
          try {
            const fileUrl = inv.file_url || inv.original_file_url
            if (!fileUrl) {
              invoicesWithoutFile++
              console.warn(`⚠️ [EXPORTS API] Facture ${inv.id} n'a pas de file_url ni original_file_url`)
              continue
            }
            
            let filePath: string
            let downloadMethod: 'storage' | 'fetch'
            
            if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
              if (fileUrl.includes('/storage/v1/object/public/invoices/')) {
                const urlParts = fileUrl.split('/storage/v1/object/public/invoices/')
                if (urlParts.length > 1) {
                  filePath = urlParts[1]
                  downloadMethod = 'storage'
                } else {
                  downloadMethod = 'fetch'
                }
              } else {
                downloadMethod = 'fetch'
              }
            } else {
              filePath = fileUrl
              downloadMethod = 'storage'
            }
            
            let buf: Uint8Array
            if (downloadMethod === 'storage') {
              const dl = await supabase.storage.from('invoices').download(filePath)
              if (dl.error || !dl.data) {
                console.warn(`❌ [EXPORTS API] Impossible de télécharger le fichier pour la facture ${inv.id}:`, dl.error)
                continue
              }
              buf = new Uint8Array(await dl.data.arrayBuffer())
            } else {
              const response = await fetch(fileUrl)
              if (!response.ok) {
                console.warn(`❌ [EXPORTS API] Impossible de télécharger le fichier depuis l'URL publique: ${response.status}`)
                continue
              }
              const arrayBuffer = await response.arrayBuffer()
              buf = new Uint8Array(arrayBuffer)
            }
            
            const fileName = inv.original_file_name || inv.file_name || `${inv.invoice_number || inv.id}.pdf`
            zip.file(fileName, buf)
            fileCount++
          } catch (error) {
            console.warn(`❌ [EXPORTS API] Erreur lors du traitement de la facture ${inv.id}:`, error)
            continue
          }
        }
        
        if (fileCount === 0) {
          return NextResponse.json({ 
            ok: false, 
            error: 'Aucun fichier à exporter. Les factures sélectionnées n\'ont pas de fichiers associés.' 
          }, { status: 400 })
        }
        
        const zipContent = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
        const filePath = `${prefix}${stamp}_export_${periodLabel}.zip`
        const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([zipContent], { type: 'application/zip' }), { upsert: true })
        if (upErr) throw upErr
        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
        
        // Enregistrer dans l'historique
        await saveExportHistory(
          supabase,
          user.id,
          'pdf',
          invoices.length,
          totalAmount,
          destination || 'download',
          destinationEmail || null,
          publicUrl,
          `export_${periodLabel}.zip`,
          zipContent.length,
          options || null
        )
        
        // Si destination est 'email', envoyer le ZIP par email
        if (destination === 'email' && destinationEmail) {
          console.log('🔍 [EXPORTS API] Envoi du ZIP de PDFs originaux par email à:', destinationEmail)
          try {
            const zipBase64 = Buffer.from(zipContent).toString('base64')
            const origin = request.headers.get('origin') || request.headers.get('host')
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (origin ? `https://${origin}` : 'http://localhost:3001')
            const emailResponse = await fetch(`${baseUrl}/api/exports/email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: destinationEmail,
                link: publicUrl,
                subject: `Export PDF - ${invoices.length} facture${invoices.length > 1 ? 's' : ''}`,
                emailType: 'exports',
                attachments: [{
                  filename: `export_factures_${new Date().toISOString().split('T')[0]}.zip`,
                  content: zipBase64,
                  type: 'application/zip'
                }]
              }),
            })
            
            const emailData = await emailResponse.json()
            if (!emailResponse.ok || !emailData.ok) {
              console.error('❌ [EXPORTS API] Erreur envoi email:', emailData.error)
              return NextResponse.json({ 
                ok: true, 
                url: publicUrl, 
                emailSent: false,
                emailError: emailData.error || 'Erreur lors de l\'envoi de l\'email'
              })
            }
            
            console.log('✅ [EXPORTS API] Email envoyé avec succès')
            return NextResponse.json({ ok: true, url: publicUrl, emailSent: true })
          } catch (emailError: any) {
            console.error('❌ [EXPORTS API] Erreur lors de l\'envoi de l\'email:', emailError)
            return NextResponse.json({ 
              ok: true, 
              url: publicUrl, 
              emailSent: false,
              emailError: emailError.message || 'Erreur lors de l\'envoi de l\'email'
            })
          }
        }
        
        return NextResponse.json({ ok: true, url: publicUrl })
      }
    }

    if (format === 'csv') {
      // CSV = Générer un vrai fichier CSV avec deux formats : compact ou détaillé
      const csvFormat = options?.csvFormat || 'compact'
      
      // Récupérer les items pour chaque facture
      const invoicesWithItems = await Promise.all(
        invoices.map(async (inv) => {
          // Récupérer les items depuis la base de données
          const { data: itemsData } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', inv.id)
            .order('created_at', { ascending: true })
          
          // Si pas d'items dans invoice_items, essayer de parser depuis la colonne items (JSONB)
          let items = itemsData || []
          if (items.length === 0 && inv.items) {
            try {
              const parsedItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items
              if (Array.isArray(parsedItems)) {
                items = parsedItems.map((item: any) => ({
                  description: item.description || item.name || '',
                  quantity: item.quantity || item.qty || 0,
                  unit_price: item.unitPrice || item.unit_price || item.price || 0,
                  amount: item.total || item.amount || (item.quantity || 0) * (item.unitPrice || item.unit_price || item.price || 0),
                }))
              }
            } catch (e) {
              console.warn(`⚠️ [EXPORTS API] Erreur parsing items pour facture ${inv.id}:`, e)
            }
          }
          
          return {
            ...inv,
            items: items || []
          }
        })
      )
      
      // Fonction pour échapper les valeurs CSV
      const escapeCsv = (value: any): string => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        // Si la valeur contient une virgule, des guillemets ou un saut de ligne, l'entourer de guillemets
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }
      
      let csvLines: string[] = []
      
      if (csvFormat === 'compact') {
        // Format compact : une ligne par reçu
        // En-têtes
        csvLines.push(['NUMÉRO DE REÇU', 'MARCHAND', 'DATE', 'TOTAL', 'DEVISE', 'RÉSUMÉ'].join(','))
        
        // Données
        for (const inv of invoicesWithItems) {
          const invoiceNumber = inv.invoice_number || inv.id.substring(0, 8).toUpperCase()
          const merchant = inv.vendor || inv.supplier_name || '-'
          const date = inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '-'
          const total = (inv.amount || 0).toFixed(2)
          const currency = inv.currency || 'EUR'
          
          // Regrouper les articles dans le résumé
          const summary = inv.items && inv.items.length > 0
            ? inv.items.map((item: any) => item.description || item.name || '').filter(Boolean).join(', ')
            : '-'
          
          csvLines.push([
            escapeCsv(invoiceNumber),
            escapeCsv(merchant),
            escapeCsv(date),
            escapeCsv(total),
            escapeCsv(currency),
            escapeCsv(summary)
          ].join(','))
        }
      } else {
        // Format détaillé : plusieurs lignes par reçu (une ligne par article)
        // En-têtes
        csvLines.push(['IDENTIFIANT', 'MARCHAND', 'DATE', 'TOTAL', 'DEVISE', 'DESCRIPTION', 'QUANTITÉ', 'PRIX UNITAIRE', 'MONTANT', 'TAXE'].join(','))
        
        // Données
        for (const inv of invoicesWithItems) {
          const invoiceNumber = inv.invoice_number || inv.id.substring(0, 8).toUpperCase()
          const merchant = inv.vendor || inv.supplier_name || '-'
          const date = inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '-'
          const currency = inv.currency || 'EUR'
          
          if (inv.items && inv.items.length > 0) {
            // Une ligne par article
            for (const item of inv.items) {
              const description = item.description || item.name || '-'
              const quantity = (item.quantity || item.qty || 0).toFixed(2)
              const unitPrice = (item.unit_price || item.unitPrice || item.price || 0).toFixed(2)
              const amount = (item.amount || item.total || (item.quantity || 0) * (item.unit_price || item.unitPrice || item.price || 0)).toFixed(2)
              const tax = inv.tax_amount && inv.items.length > 0 
                ? ((inv.tax_amount / inv.items.length) || 0).toFixed(2)
                : '0.00'
              
              csvLines.push([
                escapeCsv(invoiceNumber),
                escapeCsv(merchant),
                escapeCsv(date),
                escapeCsv(amount),
                escapeCsv(currency),
                escapeCsv(description),
                escapeCsv(quantity),
                escapeCsv(unitPrice),
                escapeCsv(amount),
                escapeCsv(tax)
              ].join(','))
            }
          } else {
            // Si pas d'items, une ligne avec le total de la facture
            const total = (inv.amount || 0).toFixed(2)
            csvLines.push([
              escapeCsv(invoiceNumber),
              escapeCsv(merchant),
              escapeCsv(date),
              escapeCsv(total),
              escapeCsv(currency),
              escapeCsv('-'),
              escapeCsv('1'),
              escapeCsv(total),
              escapeCsv(total),
              escapeCsv(inv.tax_amount ? inv.tax_amount.toFixed(2) : '0.00')
            ].join(','))
          }
        }
      }
      
      const csv = csvLines.join('\n')
      // Ajouter BOM pour Excel (UTF-8 avec BOM)
      const csvWithBom = '\ufeff' + csv
      const filePath = `${prefix}${stamp}_export_${periodLabel}.csv`
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' }), { upsert: true })
      if (upErr) throw upErr
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      console.log('✅ [EXPORTS API] CSV généré avec succès:', publicUrl)
      
      // Enregistrer dans l'historique
      await saveExportHistory(
        supabase,
        user.id,
        'csv',
        invoices.length,
        totalAmount,
        destination || 'download',
        destinationEmail || null,
        publicUrl,
        `export_${periodLabel}.csv`,
        Buffer.from(csvWithBom, 'utf-8').length,
        options || null
      )
      
      // Si destination est 'email', envoyer le fichier par email
      if (destination === 'email' && destinationEmail) {
        console.log('🔍 [EXPORTS API] Envoi du CSV par email à:', destinationEmail)
        try {
          const csvBase64 = Buffer.from(csvWithBom, 'utf-8').toString('base64')
          const origin = request.headers.get('origin') || request.headers.get('host')
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (origin ? `https://${origin}` : 'http://localhost:3001')
          const emailResponse = await fetch(`${baseUrl}/api/exports/email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: destinationEmail,
              link: publicUrl,
              subject: `Export CSV - ${invoices.length} facture${invoices.length > 1 ? 's' : ''}`,
              emailType: 'exports',
              attachments: [{
                filename: `export_factures_${new Date().toISOString().split('T')[0]}.csv`,
                content: csvBase64,
                type: 'text/csv'
              }]
            }),
          })
          
          const emailData = await emailResponse.json()
          if (!emailResponse.ok || !emailData.ok) {
            console.error('❌ [EXPORTS API] Erreur envoi email:', emailData.error)
            return NextResponse.json({ 
              ok: true, 
              url: publicUrl, 
              emailSent: false,
              emailError: emailData.error || 'Erreur lors de l\'envoi de l\'email'
            })
          }
          
          console.log('✅ [EXPORTS API] Email envoyé avec succès')
          return NextResponse.json({ ok: true, url: publicUrl, emailSent: true })
        } catch (emailError: any) {
          console.error('❌ [EXPORTS API] Erreur lors de l\'envoi de l\'email:', emailError)
          return NextResponse.json({ 
            ok: true, 
            url: publicUrl, 
            emailSent: false,
            emailError: emailError.message || 'Erreur lors de l\'envoi de l\'email'
          })
        }
      }
      
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
      const filePath = `${prefix}${stamp}_export_${periodLabel}.csv`
      const { error: upErr } = await supabase.storage.from('invoices').upload(filePath, new Blob([csv], { type: 'text/csv' }), { upsert: true })
      if (upErr) throw upErr
      // TODO: envoyer vers `email` via un service d'email; ici on répond succès
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoices/${filePath}`
      return NextResponse.json({ ok: true, sent: true, url: publicUrl })
    }

    return NextResponse.json({ ok: false, error: 'format_not_supported' }, { status: 400 })
  } catch (e: any) {
    console.error('❌ [EXPORTS API] Erreur dans POST:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Erreur lors de la génération de l\'export' }, { status: 500 })
  }
}


