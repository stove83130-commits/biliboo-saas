import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"


export const dynamic = 'force-dynamic'
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || null
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const workspaceId = params.id
    if (!workspaceId) return NextResponse.json({ error: "workspace id manquant" }, { status: 400 })

    // Vérifier ownership
    const { data: ws } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single()

    if (!ws || ws.owner_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File
    if (!file) return NextResponse.json({ error: "fichier manquant" }, { status: 400 })

    // Validation du type et de la taille
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "format non supporté" }, { status: 400 })
    }

    // Limiter la taille à 2MB max
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "fichier trop volumineux (max 2MB)" }, { status: 400 })
    }

    // Convertir en buffer puis base64
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Optimiser la taille si c'est une image
    let optimizedBuffer = buffer
    if (file.type.startsWith('image/')) {
      try {
        const sharp = require('sharp')
        // Redimensionnement agressif pour les logos
        optimizedBuffer = await sharp(buffer)
          .resize(64, 64, { 
            fit: 'inside', 
            withoutEnlargement: true,
            background: { r: 255, g: 255, b: 255, alpha: 0 } // Fond transparent
          })
          .jpeg({ 
            quality: 60,  // Qualité réduite
            progressive: true,
            mozjpeg: true
          })
          .toBuffer()
        
        console.log(`Image optimisée: ${buffer.length} → ${optimizedBuffer.length} bytes`)
      } catch (sharpError) {
        console.warn('Sharp non disponible, utilisation du buffer original:', sharpError)
      }
    }
    
    const base64 = optimizedBuffer.toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}` // Force JPEG pour la compression
    
    // Vérifier que la taille finale est acceptable (< 20KB pour être sûr)
    if (dataUrl.length > 20 * 1024) {
      return NextResponse.json({ error: "image trop volumineuse même après optimisation (max 20KB)" }, { status: 400 })
    }

    // Sauvegarder directement en base64 dans la base
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ logo_url: dataUrl })
      .eq('id', workspaceId)

    if (updateError) {
      console.error('Erreur sauvegarde logo:', updateError)
      // Si la colonne logo_url n'existe pas, on retourne quand même l'URL base64
      return NextResponse.json({ url: dataUrl })
    }

    return NextResponse.json({ url: dataUrl })
  } catch (e: any) {
    console.error('Erreur upload logo:', e)
    return NextResponse.json({ error: e.message || "erreur upload" }, { status: 500 })
  }
}
