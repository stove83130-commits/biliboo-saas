import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

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

  // Wrapper getSession pour vérifier cookie d'abord
  const originalGetSession = client.auth.getSession.bind(client.auth)
  client.auth.getSession = async () => {
    if (!hasAuthCookie()) {
      return { data: { session: null }, error: null }
    }
    try {
      const result = await originalGetSession()
      if (result.error?.status === 429) {
        console.warn('⚠️ Rate limit on getSession')
        return { data: { session: null }, error: null }
      }
      return result
    } catch (error: any) {
      if (error?.status === 429) {
        return { data: { session: null }, error: null }
      }
      throw error
    }
  }

  return client
}

export const resetClient = () => {
  client = null
}
