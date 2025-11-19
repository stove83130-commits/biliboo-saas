'use client'

import { createBrowserClient } from '@supabase/ssr'

// Singleton pour éviter de créer plusieurs instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

// Helper pour vérifier si un cookie d'auth existe
function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false
  
  const supabaseUrl = 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://qkpfxpuhrjgctpadxslh.supabase.co'
  
  const projectId = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || 'qkpfxpuhrjgctpadxslh'
  const authCookieName = `sb-${projectId}-auth-token`
  
  return document.cookie.includes(authCookieName)
}

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

  // Créer le client - @supabase/ssr 0.1.0 ne supporte pas les options auth
  // On va créer un wrapper pour gérer getSession() de manière sécurisée
  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

  // Wrapper pour getSession() qui vérifie d'abord le cookie
  const originalGetSession = supabaseClient.auth.getSession.bind(supabaseClient.auth)
  supabaseClient.auth.getSession = async () => {
    // Si pas de cookie d'auth, retourner directement null sans appeler Supabase
    if (!hasAuthCookie()) {
      return { data: { session: null }, error: null }
    }
    
    // Sinon, appeler la méthode originale avec gestion d'erreur
    try {
      const result = await originalGetSession()
      return result
    } catch (error: any) {
      // Si erreur refresh_token_not_found, retourner null au lieu de l'erreur
      if (error?.code === 'refresh_token_not_found' || error?.message?.includes('refresh_token_not_found')) {
        return { data: { session: null }, error: null }
      }
      throw error
    }
  }

  return supabaseClient
}
