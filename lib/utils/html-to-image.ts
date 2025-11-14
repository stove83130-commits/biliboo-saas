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
    // Détecter si on est sur Vercel (serverless) ou en local
    const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (isVercel) {
      // Sur Vercel, utiliser puppeteer-core avec @sparticuz/chromium
      // IMPORTANT: Importation dynamique pour éviter le bundling par Next.js
      console.log('🔧 Utilisation de @sparticuz/chromium pour Vercel');
      
      const puppeteerCore = (await import('puppeteer-core')).default;
      const chromium = (await import('@sparticuz/chromium')).default;
      
      // 🔧 FIX: setGraphicsMode n'existe pas dans les versions récentes de @sparticuz/chromium
      // Cette méthode n'est plus nécessaire pour le bon fonctionnement
      
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // En local, utiliser puppeteer normal
      // IMPORTANT: Importation dynamique pour éviter le bundling par Next.js
      console.log('🔧 Utilisation de puppeteer pour développement local');
      
      const puppeteer = (await import('puppeteer')).default;
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }

    const page = await browser.newPage();
    
    // 🔧 FIX PRODUCTION : Désactiver le chargement des ressources externes pour éviter les timeouts
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      // Bloquer les images, fonts, et autres ressources externes qui peuvent causer des timeouts
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Définir la taille de la page
    await page.setViewport({
      width: width,
      height: 1080,
      deviceScaleFactor: 2, // Pour une meilleure qualité
    });

    // 🔧 FIX PRODUCTION : Utiliser 'load' au lieu de 'networkidle0' pour éviter les timeouts
    // 'load' attend juste que le DOM soit chargé, sans attendre que toutes les ressources soient chargées
    await page.setContent(html, {
      waitUntil: 'load', // Changé de 'networkidle0' à 'load' pour Vercel
      timeout: 45000, // Augmenté à 45s pour laisser plus de temps à Chromium sur Vercel
    });

    // Attendre un peu pour que le rendu se stabilise (mais moins longtemps qu'avant)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Prendre un screenshot de toute la page
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      omitBackground: false,
    });

    return screenshot as Buffer;
  } catch (error: any) {
    // 🔧 FIX PRODUCTION : Logs détaillés pour diagnostiquer les erreurs en production
    console.error('❌ Erreur lors de la conversion HTML → Image:', error?.message || error);
    console.error('❌ Type d\'erreur:', error?.name || 'Unknown');
    console.error('❌ Stack trace:', error?.stack);
    if (error?.message?.includes('timeout')) {
      console.error('⏱️ TIMEOUT détecté - Chromium a pris trop de temps à répondre');
    }
    if (error?.message?.includes('memory') || error?.message?.includes('Memory')) {
      console.error('💾 ERREUR MÉMOIRE - Chromium a manqué de mémoire');
    }
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn('⚠️ Erreur lors de la fermeture du navigateur:', closeError);
      }
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
    // 🔧 FIX PRODUCTION : Supprimer les liens vers des ressources externes qui peuvent causer des timeouts
    .replace(/<link[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi, '') // Supprimer les <link> vers des URLs externes
    .replace(/<img[^>]*src=["']https?:\/\/[^"']+["'][^>]*>/gi, '<img>') // Remplacer les images externes par un placeholder
    // 🔧 FIX PRODUCTION : Supprimer les @import dans les styles qui pointent vers des URLs externes
    .replace(/@import\s+url\(["']?https?:\/\/[^"')]+["']?\)/gi, '')
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

