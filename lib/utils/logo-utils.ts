/**
 * 🎨 UTILITAIRES POUR LES LOGOS DE MARQUES
 * 
 * Génère automatiquement les URLs des logos d'entreprises
 * en utilisant plusieurs sources (Clearbit, Google S2, etc.)
 */

/**
 * Extrait le domaine d'une entreprise à partir de son nom ou email
 */
function extractDomain(vendorName: string, vendorEmail?: string | null, vendorWebsite?: string | null): string | null {
  // 1. Si on a un site web, l'utiliser directement
  if (vendorWebsite) {
    try {
      const url = new URL(vendorWebsite.startsWith('http') ? vendorWebsite : `https://${vendorWebsite}`);
      return url.hostname.replace('www.', '');
    } catch {
      // Ignorer les URLs invalides
    }
  }

  // 2. Si on a un email, extraire le domaine
  if (vendorEmail) {
    const emailMatch = vendorEmail.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      return emailMatch[1].replace('www.', '');
    }
  }

  // 3. Sinon, deviner le domaine à partir du nom
  const cleanName = vendorName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Supprimer les caractères spéciaux
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co|sarl|sas|sa)\s*$/i, '') // Supprimer les suffixes légaux
    .trim()
    .replace(/\s+/g, ''); // Supprimer les espaces

  if (!cleanName) return null;

  // Domaines connus pour certaines marques populaires
  const knownDomains: Record<string, string> = {
    'anthropic': 'anthropic.com',
    'openai': 'openai.com',
    'cursor': 'cursor.sh',
    'replit': 'replit.com',
    'github': 'github.com',
    'google': 'google.com',
    'microsoft': 'microsoft.com',
    'amazon': 'amazon.com',
    'stripe': 'stripe.com',
    'paypal': 'paypal.com',
    'notion': 'notion.so',
    'figma': 'figma.com',
    'slack': 'slack.com',
    'discord': 'discord.com',
    'zoom': 'zoom.us',
    'dropbox': 'dropbox.com',
    'adobe': 'adobe.com',
    'apple': 'apple.com',
    'netflix': 'netflix.com',
    'spotify': 'spotify.com',
    'vercel': 'vercel.com',
    'netlify': 'netlify.com',
    'cloudflare': 'cloudflare.com',
    'aws': 'aws.amazon.com',
    'digitalocean': 'digitalocean.com',
    'heroku': 'heroku.com',
    'mongodb': 'mongodb.com',
    'supabase': 'supabase.com',
    'firebase': 'firebase.google.com',
  };

  if (knownDomains[cleanName]) {
    return knownDomains[cleanName];
  }

  // Par défaut, supposer .com
  return `${cleanName}.com`;
}

/**
 * Génère l'URL du logo d'une entreprise
 * Utilise plusieurs sources de logos (Clearbit, Google S2, etc.)
 */
export function getCompanyLogoUrl(
  vendorName: string | null | undefined,
  vendorEmail?: string | null,
  vendorWebsite?: string | null,
  size: number = 128
): string | null {
  if (!vendorName) return null;

  const domain = extractDomain(vendorName, vendorEmail, vendorWebsite);
  if (!domain) return null;

  // Clearbit Logo API (gratuit, pas de clé API nécessaire)
  // Format: https://logo.clearbit.com/{domain}?size={size}
  return `https://logo.clearbit.com/${domain}?size=${size}`;
}

/**
 * Génère une URL de fallback pour les logos (Google S2 Favicon)
 */
export function getCompanyLogoFallbackUrl(
  vendorName: string | null | undefined,
  vendorEmail?: string | null,
  vendorWebsite?: string | null
): string | null {
  if (!vendorName) return null;

  const domain = extractDomain(vendorName, vendorEmail, vendorWebsite);
  if (!domain) return null;

  // Google S2 Favicon API (gratuit)
  // Format: https://www.google.com/s2/favicons?domain={domain}&sz={size}
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * Composant React pour afficher un logo avec fallback automatique
 */
export function CompanyLogo({
  vendorName,
  vendorEmail,
  vendorWebsite,
  size = 32,
  className = '',
}: {
  vendorName: string | null | undefined;
  vendorEmail?: string | null;
  vendorWebsite?: string | null;
  size?: number;
  className?: string;
}) {
  const logoUrl = getCompanyLogoUrl(vendorName, vendorEmail, vendorWebsite, size);
  const fallbackUrl = getCompanyLogoFallbackUrl(vendorName, vendorEmail, vendorWebsite);

  if (!logoUrl) {
    return (
      <div 
        className={`rounded border border-border bg-muted flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg className="text-muted-foreground" width={size * 0.5} height={size * 0.5} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={vendorName || 'Logo'}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (fallbackUrl && target.src !== fallbackUrl) {
          // Essayer le fallback
          target.src = fallbackUrl;
        } else {
          // Si le fallback échoue aussi, afficher l'icône par défaut
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div class="rounded border border-border bg-muted flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
                <svg class="text-muted-foreground" width="${size * 0.5}" height="${size * 0.5}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            `;
          }
        }
      }}
    />
  );
}

