import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null
let isCleaningCookies = false

function clearAuthCookies() {
  if (typeof document === 'undefined' || isCleaningCookies) return
  
  isCleaningCookies = true
  
  // Supprimer TOUS les cookies Supabase
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    const name = cookie.split('=')[0].trim()
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`
    }
  }
  
  isCleaningCookies = false
}

function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.includes('sb-qkpfxpuhrjgctpadxslh-auth-token')
}

export const createClient = () => {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false, // ❌ DÉSACTIVER auto-refresh
        persistSession: true,
        detectSessionInUrl: true,
      }
    }
  )

  // Wrapper getSession avec protection rate limit
  const originalGetSession = client.auth.getSession.bind(client.auth)
  client.auth.getSession = async () => {
    // Si pas de cookie, retourner null immédiatement
    if (!hasAuthCookie()) {
      return { data: { session: null }, error: null }
    }
    
    try {
      const result = await originalGetSession()
      
      // Si rate limit ou erreur de refresh, nettoyer les cookies
      if (result.error) {
        if (result.error.status === 429 || 
            result.error.message?.includes('refresh_token') ||
            result.error.code === 'refresh_token_not_found') {
          console.warn('⚠️ Cookie corrompu détecté, nettoyage...')
          clearAuthCookies()
          return { data: { session: null }, error: null }
        }
      }
      
      return result
    } catch (error: any) {
      if (error?.status === 429 || error?.message?.includes('refresh_token')) {
        console.warn('⚠️ Erreur refresh, nettoyage cookies...')
        clearAuthCookies()
        return { data: { session: null }, error: null }
      }
      throw error
    }
  }

  return client
}

export const resetClient = () => {
  clearAuthCookies()
  client = null
}
