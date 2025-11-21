import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

function clearAuthCookies() {
  if (typeof document === 'undefined') return
  
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    const name = cookie.split('=')[0].trim()
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`
    }
  }
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
        autoRefreshToken: false, // Désactivé pour éviter refresh automatique
        persistSession: true,
        detectSessionInUrl: true,
      }
    }
  )

  // Wrapper getSession
  const originalGetSession = client.auth.getSession.bind(client.auth)
  client.auth.getSession = async () => {
    if (!hasAuthCookie()) {
      return { data: { session: null }, error: null }
    }
    
    try {
      const result = await originalGetSession()
      
      if (result.error) {
        const isAuthError = result.error.status === 400 || 
                           result.error.status === 429 || 
                           result.error.message?.includes('refresh_token') ||
                           result.error.code === 'refresh_token_not_found'
        
        if (isAuthError) {
          console.warn('⚠️ Erreur auth détectée, nettoyage cookies...')
          clearAuthCookies()
          return { data: { session: null }, error: null }
        }
      }
      
      return result
    } catch (error: any) {
      const isAuthError = error?.status === 400 || 
                         error?.status === 429 || 
                         error?.message?.includes('refresh_token')
      
      if (isAuthError) {
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
