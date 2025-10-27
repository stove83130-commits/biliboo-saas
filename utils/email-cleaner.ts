/**
 * Utilitaires pour nettoyer et formater les adresses email
 */

/**
 * Nettoie l'affichage d'une adresse email en retirant les caractères spéciaux
 * @param email - L'adresse email à nettoyer
 * @returns L'adresse email nettoyée
 */
export function cleanEmailDisplay(email: string | null | undefined): string {
  if (!email) return '';
  
  // Retire les caractères de contrôle et les espaces
  return email
    .replace(/[\x00-\x1F\x7F]/g, '') // Retire les caractères de contrôle
    .replace(/\s+/g, '') // Retire les espaces
    .trim();
}

/**
 * Valide le format d'une adresse email
 * @param email - L'adresse email à valider
 * @returns true si l'email est valide
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Masque partiellement une adresse email pour l'affichage
 * @param email - L'adresse email à masquer
 * @returns L'adresse email masquée (ex: j***@example.com)
 */
export function maskEmail(email: string): string {
  if (!email || !isValidEmail(email)) return email;
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) return email;
  
  const maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
}

/**
 * Extrait le nom d'utilisateur d'une adresse email
 * @param email - L'adresse email
 * @returns Le nom d'utilisateur (partie avant @)
 */
export function getEmailUsername(email: string): string {
  if (!email) return '';
  return email.split('@')[0] || '';
}

/**
 * Extrait le domaine d'une adresse email
 * @param email - L'adresse email
 * @returns Le domaine (partie après @)
 */
export function getEmailDomain(email: string): string {
  if (!email) return '';
  const parts = email.split('@');
  return parts.length > 1 ? parts[1] : '';
}


