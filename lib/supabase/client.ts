import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  // Nettoyer le localStorage au démarrage pour éviter les données corrompues
  if (typeof window !== 'undefined') {
    try {
      // Nettoyer toutes les clés Supabase du localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
