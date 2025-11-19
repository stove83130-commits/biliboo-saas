import puppeteer from 'puppeteer';

/**
 * Convertit le HTML d'un email en image PNG
 * @param html - Le contenu HTML de l'email
 * @param width - Largeur de la capture (défaut: 800px)
 * @returns Buffer de l'image PNG
 */
export async function convertHtmlToImage(
  html: string,
  width: number = 800
): Promise<Buffer> {
  let browser;
  
  try {
    // Lancer le navigateur headless
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
    
    // Définir la taille de la page
    await page.setViewport({
      width: width,
      height: 1080,
      deviceScaleFactor: 2, // Pour une meilleure qualité
    });

    // Charger le HTML
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Attendre que tout soit chargé (nouvelle méthode compatible)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Prendre un screenshot de toute la page
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      omitBackground: false,
    });

    return screenshot as Buffer;
  } catch (error) {
    console.error('❌ Erreur lors de la conversion HTML → Image:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Nettoie le HTML pour améliorer le rendu
 * (supprime les scripts, optimise les styles)
 */
export function cleanHtmlForScreenshot(html: string): string {
  return html
    // Supprimer les scripts
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    // Ajouter un style de base pour un meilleur rendu
    .replace('<head>', `<head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 20px;
          background: white;
          max-width: 800px;
          margin: 0 auto;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        td, th {
          padding: 8px;
          text-align: left;
        }
      </style>
    `);
}

