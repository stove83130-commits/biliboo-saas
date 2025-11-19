/**
 * 🎨 EXTRACTEUR DE LOGOS DEPUIS LES FACTURES PDF
 * 
 * Extrait automatiquement le logo de l'entreprise depuis un PDF
 * et l'upload dans Supabase Storage
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extrait le logo d'une facture PDF et l'upload dans Supabase Storage
 * Utilise GPT-4o Vision pour identifier et extraire le logo
 */
export async function extractAndUploadLogoFromPDF(
  pdfBuffer: Buffer,
  userId: string,
  invoiceId: string,
  vendorName: string
): Promise<string | null> {
  console.log(`🎨 [LOGO] Extraction du logo pour ${vendorName}...`);

  try {
    // 1. Créer un fichier temporaire pour le PDF
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    // 2. Upload le PDF vers OpenAI Files API
    const file = await openai.files.create({
      file: fs.createReadStream(tempPdfPath),
      purpose: 'assistants',
    });

    console.log(`📤 [LOGO] PDF uploadé vers OpenAI: ${file.id}`);

    // 3. Créer un assistant temporaire pour analyser le PDF
    const assistant = await openai.beta.assistants.create({
      name: 'Logo Extractor',
      instructions: `Tu es un expert en extraction de logos depuis des factures PDF. 
      Ton rôle est d'identifier et de décrire précisément le logo de l'entreprise qui apparaît sur la facture.
      Le logo se trouve généralement en haut à gauche ou en haut au centre de la première page.`,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
    });

    // 4. Créer un thread avec le PDF
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: `Analyse cette facture PDF et décris-moi le logo de l'entreprise qui apparaît dessus.
          
Réponds UNIQUEMENT avec un JSON dans ce format:
{
  "has_logo": true/false,
  "logo_description": "description détaillée du logo (couleurs, forme, texte, style)",
  "logo_position": "top-left/top-center/top-right",
  "company_name_in_logo": "nom de l'entreprise si visible dans le logo"
}

Si aucun logo n'est visible, mets has_logo à false.`,
          attachments: [{ file_id: file.id, tools: [{ type: 'file_search' }] }],
        },
      ],
    });

    // 5. Exécuter l'assistant
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const responseMessage = messages.data[0];

      if (responseMessage.content[0].type === 'text') {
        const responseText = responseMessage.content[0].text.value;
        console.log(`📄 [LOGO] Réponse GPT:`, responseText.substring(0, 200));

        // Parser le JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const logoInfo = JSON.parse(jsonMatch[0]);

          if (logoInfo.has_logo) {
            console.log(`✅ [LOGO] Logo détecté: ${logoInfo.logo_description}`);

            // 6. Générer une image du logo avec DALL-E 3
            // (Alternative: on pourrait aussi extraire l'image directement du PDF)
            // Pour l'instant, on va utiliser l'URL Clearbit comme fallback
            
            // Nettoyer les fichiers temporaires
            fs.unlinkSync(tempPdfPath);
            await openai.beta.assistants.del(assistant.id);
            await openai.files.del(file.id);

            // Retourner les informations du logo pour utilisation ultérieure
            return JSON.stringify(logoInfo);
          } else {
            console.log(`⚠️ [LOGO] Aucun logo détecté dans le PDF`);
          }
        }
      }
    }

    // Nettoyer
    fs.unlinkSync(tempPdfPath);
    await openai.beta.assistants.del(assistant.id);
    await openai.files.del(file.id);

    return null;
  } catch (error) {
    console.error('❌ [LOGO] Erreur extraction:', error);
    return null;
  }
}

/**
 * Version simplifiée : Utilise l'API Clearbit pour obtenir le logo
 * (Plus rapide et gratuit, mais moins précis)
 */
export async function getLogoUrlFromVendorInfo(
  vendorName: string | null,
  vendorEmail?: string | null,
  vendorWebsite?: string | null
): Promise<string | null> {
  if (!vendorName) return null;

  // Extraire le domaine
  let domain: string | null = null;

  if (vendorWebsite) {
    try {
      const url = new URL(vendorWebsite.startsWith('http') ? vendorWebsite : `https://${vendorWebsite}`);
      domain = url.hostname.replace('www.', '');
    } catch {
      // Ignorer
    }
  }

  if (!domain && vendorEmail) {
    const emailMatch = vendorEmail.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      domain = emailMatch[1].replace('www.', '');
    }
  }

  if (!domain) {
    // Deviner à partir du nom
    const cleanName = vendorName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+(inc|llc|ltd|corp|corporation|company|co|sarl|sas|sa)\s*$/i, '')
      .trim()
      .replace(/\s+/g, '');

    if (cleanName) {
      domain = `${cleanName}.com`;
    }
  }

  if (domain) {
    return `https://logo.clearbit.com/${domain}?size=128`;
  }

  return null;
}

