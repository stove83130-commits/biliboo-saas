/**
 * 🎨 EXTRACTEUR D'IMAGES DE LOGOS DEPUIS LES FACTURES PDF
 * 
 * Utilise Puppeteer pour convertir la première page du PDF en image,
 * puis GPT-4o Vision pour identifier et extraire l'image du logo,
 * puis l'upload dans Supabase Storage
 */

import OpenAI from 'openai';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extrait l'image du logo depuis un PDF et l'upload dans Supabase Storage
 * @param pdfBuffer - Buffer du PDF
 * @param userId - ID de l'utilisateur
 * @param messageId - ID du message email (pour nommer le fichier)
 * @param vendorName - Nom du fournisseur (pour logs)
 * @returns URL du logo uploadé ou null si pas de logo trouvé
 */
export async function extractLogoImageFromPDF(
  pdfBuffer: Buffer,
  userId: string,
  messageId: string,
  vendorName: string
): Promise<string | null> {
  console.log(`🎨 [LOGO] Extraction du logo pour ${vendorName}...`);

  let browser: any = null;
  let tempPdfPath: string | null = null;

  try {
    // 1. Sauvegarder le PDF temporairement
    const tempDir = os.tmpdir();
    tempPdfPath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    // 2. Convertir la première page du PDF en image PNG avec Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    
    // Charger le PDF dans la page
    await page.goto(`file://${tempPdfPath}`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Attendre un peu pour que le PDF se charge
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Prendre un screenshot de la première page
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: 1200,
        height: 1600, // Hauteur suffisante pour capturer le haut de la page
      },
    });

    await browser.close();
    browser = null;

    // 3. Utiliser GPT-4o Vision pour identifier le logo dans l'image
    const base64Image = screenshotBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyse cette première page de facture et identifie le logo de l'entreprise.

Le logo est généralement :
- En haut à gauche ou en haut au centre de la page
- Une image distincte (pas du texte stylisé)
- Contient souvent le nom ou les initiales de l'entreprise
- A des couleurs distinctives
- Fait généralement entre 50x50 et 200x200 pixels

IMPORTANT : Donne les coordonnées EXACTES en pixels du logo dans l'image.

Réponds UNIQUEMENT avec un JSON dans ce format:
{
  "has_logo": true/false,
  "logo_position": {
    "x": nombre (coordonnée X en pixels depuis le bord gauche, 0 = gauche),
    "y": nombre (coordonnée Y en pixels depuis le bord haut, 0 = haut),
    "width": nombre (largeur en pixels),
    "height": nombre (hauteur en pixels)
  },
  "logo_description": "description détaillée du logo"
}

Si aucun logo n'est visible, mets has_logo à false.
Si le logo est détecté mais que tu ne peux pas donner les coordonnées exactes, mets has_logo à false.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const responseText = response.choices[0].message.content || '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.log(`⚠️ [LOGO] Pas de JSON valide dans la réponse GPT`);
      if (tempPdfPath) fs.unlinkSync(tempPdfPath);
      return null;
    }

    const logoInfo = JSON.parse(jsonMatch[0]);

    if (!logoInfo.has_logo || !logoInfo.logo_position) {
      console.log(`⚠️ [LOGO] Aucun logo détecté ou position non disponible`);
      if (tempPdfPath) fs.unlinkSync(tempPdfPath);
      return null;
    }

    // 4. Extraire la zone du logo depuis l'image avec sharp
    const { x, y, width, height } = logoInfo.logo_position;
    
    console.log(`📐 [LOGO] Position détectée: x=${x}, y=${y}, width=${width}, height=${height}`);

    // Utiliser sharp pour extraire la zone du logo
    const logoImage = await sharp(screenshotBuffer)
      .extract({
        left: Math.max(0, Math.floor(x)),
        top: Math.max(0, Math.floor(y)),
        width: Math.min(Math.floor(width), 500), // Limiter à 500px max
        height: Math.min(Math.floor(height), 500), // Limiter à 500px max
      })
      .resize(200, 200, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 0 } 
      })
      .png()
      .toBuffer();

    // 5. Uploader le logo dans Supabase Storage
    const logoFileName = `${userId}/${messageId}_logo.png`;
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('invoices')
      .upload(logoFileName, logoImage, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error(`❌ [LOGO] Erreur upload logo:`, uploadError);
      if (tempPdfPath) fs.unlinkSync(tempPdfPath);
      return null;
    }

    // Générer l'URL publique
    const { data: urlData } = supabaseService.storage
      .from('invoices')
      .getPublicUrl(logoFileName);

    console.log(`✅ [LOGO] Logo extrait et uploadé: ${urlData.publicUrl}`);
    
    // Nettoyer
    if (tempPdfPath) fs.unlinkSync(tempPdfPath);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ [LOGO] Erreur extraction:', error);
    
    // Nettoyer en cas d'erreur
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignorer les erreurs de fermeture
      }
    }
    if (tempPdfPath) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
    }
    
    return null;
  }
}

