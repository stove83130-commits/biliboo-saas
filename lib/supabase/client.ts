'use client'

import { createBrowserClient } from '@supabase/ssr'

// Singleton pour éviter de créer plusieurs instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Si le client existe déjà, le retourner
  if (supabaseClient) {
    return supabaseClient
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

  // Créer le client - createBrowserClient de @supabase/ssr gère automatiquement les cookies
  // autoRefreshToken est désactivé par défaut dans certaines configurations
  // Pour éviter les erreurs 429, on utilise simplement createBrowserClient sans options
  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return supabaseClient
}
