/**
 * 🎨 GÉNÉRATEUR DE LOGO INTELLIGENT
 * 
 * Utilise les données extraites du PDF pour créer un logo SVG ou récupérer un logo existant.
 * Stratégie en cascade :
 * 1. Clearbit API (gratuit) si on a un domaine
 * 2. Logo SVG généré à partir de la description (gratuit)
 * 3. Icône par défaut
 */

/**
 * Génère un logo SVG amélioré à partir des données extraites
 * Coût : 0€ (génération locale)
 */
export function generateLogoFromDescription(
  vendorName: string,
  logoDescription?: string | null,
  logoColors?: string[] | null,
  logoText?: string | null
): string {
  // Couleurs par défaut améliorées si non fournies
  const defaultColors = [
    ['#6366f1', '#8b5cf6'], // Indigo/Purple
    ['#3b82f6', '#06b6d4'], // Blue/Cyan
    ['#10b981', '#059669'], // Green
    ['#f59e0b', '#f97316'], // Orange
    ['#ef4444', '#dc2626'], // Red
  ];
  
  // Sélectionner une palette de couleurs basée sur le nom (pour cohérence)
  const colorIndex = vendorName.charCodeAt(0) % defaultColors.length;
  const colors = logoColors && logoColors.length > 0 
    ? logoColors.filter(c => c && c.startsWith('#')) // Filtrer les couleurs valides
    : defaultColors[colorIndex];
  
  const primaryColor = colors[0] || '#6366f1';
  const secondaryColor = colors[1] || colors[0] || '#8b5cf6';
  
  // Texte à afficher (priorité au texte du logo, sinon initiales)
  let displayText = '';
  if (logoText && logoText.trim().length > 0) {
    // Utiliser le texte du logo (limité à 3 caractères)
    displayText = logoText.trim().substring(0, 3).toUpperCase();
  } else {
    // Générer les initiales à partir du nom
    const words = vendorName.trim().split(/\s+/);
    if (words.length >= 2) {
      // Prendre la première lettre de chaque mot (max 2 mots)
      displayText = words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    } else {
      // Prendre les 2 premières lettres du nom
      displayText = vendorName.substring(0, 2).toUpperCase();
    }
  }
  
  // Si pas de texte, utiliser un symbole
  if (!displayText || displayText.length === 0) {
    displayText = vendorName[0]?.toUpperCase() || '?';
  }
  
  // Déterminer la forme du logo basée sur la description
  let shape = 'rect'; // rect, circle, rounded
  if (logoDescription) {
    const desc = logoDescription.toLowerCase();
    if (desc.includes('circulaire') || desc.includes('circle') || desc.includes('round')) {
      shape = 'circle';
    } else if (desc.includes('arrondi') || desc.includes('rounded')) {
      shape = 'rounded';
    }
  }
  
  // SVG amélioré avec dégradé et ombre
  const radius = shape === 'circle' ? '50' : (shape === 'rounded' ? '20' : '0');
  const viewBox = shape === 'circle' ? '0 0 100 100' : '0 0 100 100';
  
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100" height="100">
      <defs>
        <linearGradient id="grad-${vendorName.replace(/\s/g, '-')}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow-${vendorName.replace(/\s/g, '-')}">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      ${shape === 'circle' 
        ? `<circle cx="50" cy="50" r="45" fill="url(#grad-${vendorName.replace(/\s/g, '-')})" filter="url(#shadow-${vendorName.replace(/\s/g, '-')})"/>`
        : `<rect width="100" height="100" rx="${radius}" fill="url(#grad-${vendorName.replace(/\s/g, '-')})" filter="url(#shadow-${vendorName.replace(/\s/g, '-')})"/>`
      }
      <text 
        x="50" 
        y="50" 
        font-family="Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" 
        font-size="${displayText.length > 2 ? '32' : '40'}" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="central"
        style="text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
      >${displayText}</text>
    </svg>
  `)}`;
}

/**
 * Récupère un logo en utilisant la stratégie en cascade
 * Coût : 0€ (Clearbit gratuit + SVG local)
 */
export function getVendorLogo(
  vendorName: string,
  vendorWebsite?: string | null,
  vendorEmail?: string | null,
  logoDescription?: string | null,
  logoColors?: string[] | null,
  logoText?: string | null,
  size: number = 32
): string {
  // 1. Essayer Clearbit si on a un domaine (mais ne pas bloquer si ça échoue)
  if (vendorWebsite) {
    try {
      const url = vendorWebsite.startsWith('http') ? vendorWebsite : `https://${vendorWebsite}`;
      const domain = new URL(url).hostname.replace('www.', '');
      // Retourner l'URL Clearbit (le frontend gérera l'erreur avec onError)
      return `https://logo.clearbit.com/${domain}?size=${size}`;
    } catch (e) {
      // URL invalide, continuer
    }
  }
  
  // 2. Essayer d'extraire le domaine de l'email
  if (vendorEmail && vendorEmail.includes('@')) {
    const domain = vendorEmail.split('@')[1];
    if (domain && !domain.includes('gmail') && !domain.includes('outlook') && !domain.includes('yahoo') && !domain.includes('hotmail') && !domain.includes('icloud')) {
      return `https://logo.clearbit.com/${domain}?size=${size}`;
    }
  }
  
  // 3. Toujours générer un logo SVG à partir de la description/nom
  // Même si Clearbit est disponible, on génère un SVG comme fallback
  return generateLogoFromDescription(vendorName, logoDescription, logoColors, logoText);
}

/**
 * Récupère un logo avec fallback Google Favicon
 */
export function getVendorLogoWithFallback(
  vendorName: string,
  vendorWebsite?: string | null,
  vendorEmail?: string | null,
  logoDescription?: string | null,
  logoColors?: string[] | null,
  logoText?: string | null
): { primary: string; fallback: string } {
  const primary = getVendorLogo(vendorName, vendorWebsite, vendorEmail, logoDescription, logoColors, logoText);
  
  // Fallback Google Favicon
  let fallback = '';
  if (vendorWebsite) {
    try {
      const domain = new URL(vendorWebsite).hostname;
      fallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
      // URL invalide
    }
  } else if (vendorEmail && vendorEmail.includes('@')) {
    const domain = vendorEmail.split('@')[1];
    fallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }
  
  return { primary, fallback };
}

