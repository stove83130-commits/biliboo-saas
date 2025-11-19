/**
 * 📊 CATÉGORIES COMPTABLES POUR LES FACTURES
 * 
 * Liste des catégories utilisées pour classifier les factures.
 * Ces catégories sont utilisées par :
 * - GPT-4o pour la catégorisation automatique (invoice-ocr-extractor.ts)
 * - L'interface utilisateur (page de détails de facture)
 * - Les exports et rapports comptables
 */

export const INVOICE_CATEGORIES = [
  {
    value: 'Salaires et charges sociales',
    label: '💼 Salaires et charges sociales',
    description: 'Paie, cotisations sociales, URSSAF',
    keywords: ['salaire', 'paie', 'urssaf', 'cotisation', 'sociale', 'sécurité sociale'],
  },
  {
    value: 'Loyer et charges locales',
    label: '🏢 Loyer et charges locales',
    description: 'Loyer bureau, charges immeuble, copropriété',
    keywords: ['loyer', 'bail', 'copropriété', 'charges', 'immeuble'],
  },
  {
    value: 'Matières premières',
    label: '📦 Matières premières',
    description: 'Matériaux, stocks, fournitures production',
    keywords: ['matière', 'stock', 'fourniture', 'production', 'matériau'],
  },
  {
    value: 'Services externes (comptable, avocat, consultant)',
    label: '👔 Services externes (comptable, avocat, consultant)',
    description: 'Honoraires professionnels',
    keywords: ['comptable', 'avocat', 'consultant', 'honoraire', 'conseil', 'audit'],
  },
  {
    value: 'Matériel informatique et logiciels',
    label: '💻 Matériel informatique et logiciels',
    description: 'Ordinateurs, licences, SaaS, abonnements tech',
    keywords: ['informatique', 'logiciel', 'saas', 'licence', 'software', 'ordinateur', 'serveur', 'cloud', 'hosting'],
  },
  {
    value: 'Marketing et publicité',
    label: '📢 Marketing et publicité',
    description: 'Campagnes pub, SEO, réseaux sociaux, communication',
    keywords: ['marketing', 'publicité', 'seo', 'ads', 'communication', 'campagne', 'social media'],
  },
  {
    value: 'Transports et déplacements',
    label: '🚗 Transports et déplacements',
    description: 'Carburant, péages, billets train/avion, hôtels',
    keywords: ['transport', 'déplacement', 'carburant', 'essence', 'péage', 'train', 'avion', 'hôtel', 'voyage'],
  },
  {
    value: 'Énergie',
    label: '⚡ Énergie',
    description: 'Électricité, gaz, eau',
    keywords: ['électricité', 'gaz', 'eau', 'énergie', 'edf', 'engie'],
  },
  {
    value: 'Entretien et réparations',
    label: '🔧 Entretien et réparations',
    description: 'Maintenance, réparations équipements',
    keywords: ['entretien', 'réparation', 'maintenance', 'dépannage'],
  },
  {
    value: 'Assurances',
    label: '🛡️ Assurances',
    description: 'Assurances professionnelles, RC, véhicules',
    keywords: ['assurance', 'rc', 'responsabilité civile', 'garantie'],
  },
  {
    value: 'Frais bancaires et financiers',
    label: '🏦 Frais bancaires et financiers',
    description: 'Frais bancaires, intérêts, commissions',
    keywords: ['banque', 'frais bancaire', 'intérêt', 'commission', 'agios', 'stripe', 'paypal', 'payment'],
  },
  {
    value: 'Fournitures de bureau',
    label: '📝 Fournitures de bureau',
    description: 'Papeterie, mobilier bureau',
    keywords: ['fourniture', 'bureau', 'papeterie', 'mobilier'],
  },
  {
    value: 'Sous-traitance',
    label: '🤝 Sous-traitance',
    description: 'Prestations externes, freelances',
    keywords: ['sous-traitance', 'freelance', 'prestation', 'externe'],
  },
  {
    value: 'Télécommunications',
    label: '📞 Télécommunications',
    description: 'Téléphone, internet, mobile',
    keywords: ['téléphone', 'internet', 'mobile', 'télécom', 'fibre', 'forfait'],
  },
  {
    value: 'Formation et développement',
    label: '🎓 Formation et développement',
    description: 'Formations, séminaires, coaching',
    keywords: ['formation', 'séminaire', 'coaching', 'développement', 'cours'],
  },
  {
    value: 'Taxes et cotisations',
    label: '💰 Taxes et cotisations',
    description: 'Taxes professionnelles, CFE, impôts',
    keywords: ['taxe', 'impôt', 'cfe', 'cotisation', 'fiscal'],
  },
  {
    value: 'Amortissements',
    label: '📉 Amortissements',
    description: 'Amortissements comptables',
    keywords: ['amortissement', 'dépréciation'],
  },
  {
    value: 'Charges exceptionnelles',
    label: '⚠️ Charges exceptionnelles',
    description: 'Charges non récurrentes, imprévues',
    keywords: ['exceptionnel', 'imprévu', 'extraordinaire'],
  },
] as const;

/**
 * Obtenir la catégorie par défaut
 */
export const DEFAULT_CATEGORY = 'Charges exceptionnelles';

/**
 * Obtenir le label d'une catégorie
 */
export function getCategoryLabel(value: string): string {
  const category = INVOICE_CATEGORIES.find(cat => cat.value === value);
  return category?.label || value;
}

/**
 * Obtenir l'emoji d'une catégorie
 */
export function getCategoryEmoji(value: string): string {
  const category = INVOICE_CATEGORIES.find(cat => cat.value === value);
  if (!category) return '📄';
  return category.label.split(' ')[0]; // Récupérer l'emoji (premier mot)
}

/**
 * Valider qu'une catégorie existe
 */
export function isValidCategory(value: string): boolean {
  return INVOICE_CATEGORIES.some(cat => cat.value === value);
}


