import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // cookies() peut être undefined dans certains contextes Next.js
  // Il faut vérifier qu'il est disponible avant de l'utiliser
  let cookieStore
  try {
    cookieStore = cookies()
    // Vérifier que cookieStore existe et a les méthodes nécessaires
    if (!cookieStore || typeof cookieStore.get !== 'function') {
      throw new Error('CookieStore not available')
    }
  } catch (error) {
    // Si cookies() n'est pas disponible, créer un fallback
    cookieStore = {
      get: () => undefined,
      set: () => {},
      delete: () => {},
    } as any
  }

  // Récupérer les variables d'environnement avec valeurs par défaut
  const supabaseUrl = 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://qkpfxpuhrjgctpadxslh.supabase.co'
    
  const supabaseAnonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGZ4cHVocmpnY3RwYWR4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTYzMTgsImV4cCI6MjA3NDEzMjMxOH0.Blc5wlKE6g00AqYFdGmsRDeD3ZTKDQfOx4jVpmqA5n4'

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        try {
          return cookieStore?.get(name)?.value
        } catch {
          return undefined
        }
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          if (cookieStore && typeof cookieStore.set === 'function') {
            cookieStore.set({ name, value, ...options })
          }
        } catch (error) {
          // Peut être ignoré si appelé depuis un Server Component
          // Le middleware gère la session
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          if (cookieStore && typeof cookieStore.set === 'function') {
            cookieStore.set({ name, value: '', ...options })
          }
        } catch (error) {
          // Peut être ignoré si appelé depuis un Server Component
        }
      },
    },
  })
}
