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
 * Génère un logo SVG simple à partir des données extraites
 * Coût : 0€ (génération locale)
 */
export function generateLogoFromDescription(
  vendorName: string,
  logoDescription?: string | null,
  logoColors?: string[] | null,
  logoText?: string | null
): string {
  // Couleurs par défaut si non fournies
  const colors = logoColors && logoColors.length > 0 
    ? logoColors 
    : ['#6366f1', '#8b5cf6']; // Indigo/Purple par défaut
  
  const primaryColor = colors[0];
  const secondaryColor = colors[1] || colors[0];
  
  // Texte à afficher (initiales ou texte du logo)
  const displayText = logoText 
    ? logoText.substring(0, 3).toUpperCase()
    : vendorName
        .split(' ')
        .map(word => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
  
  // SVG simple avec dégradé
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#grad)"/>
      <text 
        x="50" 
        y="50" 
        font-family="Arial, sans-serif" 
        font-size="40" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="central"
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
  // 1. Essayer Clearbit si on a un domaine
  if (vendorWebsite) {
    try {
      const domain = new URL(vendorWebsite).hostname.replace('www.', '');
      return `https://logo.clearbit.com/${domain}?size=${size}`;
    } catch (e) {
      // URL invalide, continuer
    }
  }
  
  // 2. Essayer d'extraire le domaine de l'email
  if (vendorEmail && vendorEmail.includes('@')) {
    const domain = vendorEmail.split('@')[1];
    if (domain && !domain.includes('gmail') && !domain.includes('outlook') && !domain.includes('yahoo')) {
      return `https://logo.clearbit.com/${domain}?size=${size}`;
    }
  }
  
  // 3. Générer un logo SVG à partir de la description
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

