'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleLogo } from '@/components/ui/brand-logos'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      
      // Vérifier que le client est bien créé
      if (!supabase) {
        setError('Erreur de configuration Supabase')
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        console.error('❌ Erreur login Supabase:', error)
        // Messages d'erreur plus explicites
        if (error.message.includes('Invalid login credentials')) {
          setError('Email ou mot de passe incorrect')
        } else if (error.message.includes('Email not confirmed')) {
          setError('Veuillez confirmer votre email avant de vous connecter')
        } else {
          setError(error.message || 'Erreur lors de la connexion')
        }
        setLoading(false)
        return
      }

      if (data?.user) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Aucun utilisateur retourné')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('❌ Erreur inattendue login:', err)
      setError(err?.message || 'Une erreur est survenue lors de la connexion')
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      setError(null)
      
      const supabase = createClient()
      const redirectUrl = `${window.location.origin}/auth/callback?next=/dashboard`
      
      console.log('🔍 Google OAuth - Configuration:', {
        origin: window.location.origin,
        hostname: window.location.hostname,
        redirectUrl,
      })
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('❌ Erreur Google OAuth:', error)
        setError(`Erreur lors de la connexion avec Google: ${error.message}`)
        setGoogleLoading(false)
      } else if (data?.url) {
        console.log('✅ Redirection Google OAuth vers:', data.url)
        // signInWithOAuth redirige automatiquement
      }
      // Note: signInWithOAuth redirige automatiquement, donc on ne fait rien d'autre
    } catch (err: any) {
      console.error('❌ Erreur inattendue Google login:', err)
      setError(err?.message || 'Une erreur est survenue lors de la connexion avec Google')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Connexion</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gray-50 px-2 text-gray-500">Ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
        >
          <GoogleLogo className="h-4 w-4 mr-2" />
          {googleLoading ? 'Connexion...' : 'Continuer avec Google'}
        </Button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <a href="/auth/signup" className="text-primary hover:underline">
            S'inscrire
          </a>
        </p>
      </Card>
    </div>
  )
}

