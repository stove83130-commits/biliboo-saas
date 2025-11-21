import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null
let refreshBlocked = false

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
  
  // Nettoyer aussi localStorage
  try {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    }
  } catch (e) {
    console.warn('Erreur nettoyage localStorage:', e)
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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Intercepter refreshSession pour bloquer les refresh en boucle
  const originalRefresh = client.auth.refreshSession.bind(client.auth)
  client.auth.refreshSession = async () => {
    if (refreshBlocked) {
      console.warn('⚠️ Refresh bloqué pour éviter boucle')
      return { data: { session: null, user: null }, error: null }
    }
    
    if (!hasAuthCookie()) {
      return { data: { session: null, user: null }, error: null }
    }
    
    refreshBlocked = true
    
    try {
      const result = await originalRefresh()
      
      if (result.error) {
        const isAuthError = result.error.status === 400 || 
                           result.error.status === 429 || 
                           result.error.message?.includes('refresh_token')
        
        if (isAuthError) {
          console.warn('⚠️ Erreur refresh, nettoyage...')
          clearAuthCookies()
          return { data: { session: null, user: null }, error: null }
        }
      }
      
      return result
    } finally {
      setTimeout(() => { refreshBlocked = false }, 5000) // Débloquer après 5s
    }
  }

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
                           result.error.message?.includes('refresh_token')
        
        if (isAuthError) {
          console.warn('⚠️ Erreur auth, nettoyage...')
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
  refreshBlocked = false
  client = null
}
