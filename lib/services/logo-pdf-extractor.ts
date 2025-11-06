/**
 * 🎨 EXTRACTEUR DE LOGOS DEPUIS LES PDFs
 * 
 * Utilise pdf-lib pour extraire les images embarquées du PDF
 * et identifie le logo grâce aux informations de GPT-4o
 */

import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extrait le logo depuis un PDF en utilisant les images embarquées
 * @param pdfBuffer - Buffer du PDF
 * @param userId - ID de l'utilisateur
 * @param messageId - ID du message email
 * @param logoInfo - Informations sur le logo depuis GPT-4o (is_embedded_image, position)
 * @returns URL du logo uploadé ou null
 */
export async function extractLogoFromPDFImages(
  pdfBuffer: Buffer,
  userId: string,
  messageId: string,
  logoInfo: {
    vendor_logo_is_embedded_image?: boolean | null;
    vendor_logo_image_position?: string | null;
    vendor_logo_description?: string | null;
  }
): Promise<string | null> {
  // Si GPT-4o dit que le logo n'est pas une image embarquée, on ne peut pas l'extraire
  if (!logoInfo.vendor_logo_is_embedded_image) {
    console.log(`⚠️ [LOGO] Logo n'est pas une image embarquée, extraction impossible`);
    return null;
  }

  try {
    console.log(`🎨 [LOGO] Extraction des images embarquées du PDF...`);
    
    // Charger le PDF avec pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Extraire toutes les images de la première page
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      console.log(`⚠️ [LOGO] PDF sans pages`);
      return null;
    }

    const firstPage = pages[0];
    
    // pdf-lib ne fournit pas de méthode directe pour extraire les images
    // On doit accéder aux objets internes du PDF
    // Méthode alternative : utiliser les opérateurs de contenu de la page
    
    // Accéder au dictionnaire de la page
    const pageDict = firstPage.node;
    const contents = pageDict.get('Contents');
    
    // Si Contents est un array (plusieurs streams de contenu)
    const contentStreams = Array.isArray(contents) ? contents : [contents];
    
    // Parcourir les ressources de la page pour trouver les images
    const resources = firstPage.node.get('Resources');
    if (!resources) {
      console.log(`⚠️ [LOGO] Aucune ressource trouvée dans la page`);
      return null;
    }
    
    const xObject = resources.get('XObject');
    if (!xObject) {
      console.log(`⚠️ [LOGO] Aucune image XObject trouvée dans la page`);
      return null;
    }
    
    // Parcourir les objets XObject pour trouver les images
    const xObjectDict = xObject.dict;
    const imageKeys = xObjectDict.keys();
    
    let logoImage: any = null;
    let logoImageName: string | null = null;
    
    // Chercher la première image (généralement le logo est la première)
    for (const key of imageKeys) {
      const obj = xObjectDict.get(key);
      if (obj) {
        const subtype = obj.dict?.get('Subtype');
        if (subtype?.toString() === '/Image') {
          logoImage = obj;
          logoImageName = key.toString();
          console.log(`✅ [LOGO] Image trouvée: ${logoImageName}`);
          break;
        }
      }
    }
    
    if (!logoImage) {
      console.log(`⚠️ [LOGO] Aucune image embarquée trouvée dans le PDF`);
      return null;
    }
    
    // Extraire les données de l'image
    const imageDict = logoImage.dict;
    const width = imageDict.get('Width')?.valueOf() || 100;
    const height = imageDict.get('Height')?.valueOf() || 100;
    
    // Récupérer le stream de l'image
    const imageStream = logoImage.stream;
    if (!imageStream) {
      console.log(`⚠️ [LOGO] Pas de stream pour l'image`);
      return null;
    }
    
    // Obtenir les bytes de l'image
    const imageBytes = imageStream.getBytes();
    const imageBuffer = Buffer.from(imageBytes);
    
    // Déterminer le format selon les filtres
    const filter = imageDict.get('Filter');
    let mimeType = 'image/png';
    let extension = 'png';
    
    if (filter) {
      const filterStr = filter.toString();
      if (filterStr.includes('/DCTDecode') || filterStr.includes('/DCT')) {
        mimeType = 'image/jpeg';
        extension = 'jpg';
      } else if (filterStr.includes('/CCITTFaxDecode') || filterStr.includes('/CCF')) {
        mimeType = 'image/tiff';
        extension = 'tiff';
      } else {
        // Par défaut PNG pour FlateDecode et autres
        mimeType = 'image/png';
        extension = 'png';
      }
    }
    
    console.log(`📐 [LOGO] Image extraite: ${width}x${height}, format: ${mimeType}`);
    
    // Uploader l'image dans Supabase Storage
    const logoFileName = `${userId}/${messageId}_logo.${extension}`;
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('invoices')
      .upload(logoFileName, imageBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error(`❌ [LOGO] Erreur upload logo:`, uploadError);
      return null;
    }

    // Générer l'URL publique
    const { data: urlData } = supabaseService.storage
      .from('invoices')
      .getPublicUrl(logoFileName);

    console.log(`✅ [LOGO] Logo extrait et uploadé: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ [LOGO] Erreur extraction logo depuis images PDF:', error);
    return null;
  }
}

