import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes!')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌ MANQUANT')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌ MANQUANT')
    throw new Error('Variables d\'environnement Supabase manquantes')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
