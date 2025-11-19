'use client'

import { createBrowserClient } from '@supabase/ssr'

// Singleton pour éviter de créer plusieurs instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Si le client existe déjà, le retourner
  if (supabaseClient) {
    return supabaseClient
  }

  // Récupérer les variables d'environnement
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables Supabase manquantes')
  }

  // Créer le client (utilise automatiquement localStorage côté client)
  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return supabaseClient
}
