'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RefreshCw, AlertCircle } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('❌ Erreur auth:', error)
        setError(error.message)
        setIsAuthenticated(false)
        return
      }

      if (session?.user) {
        setIsAuthenticated(true)
        setError(null)
      } else {
        setIsAuthenticated(false)
        setError('Non authentifié')
      }
    } catch (err: any) {
      console.error('❌ Erreur inattendue:', err)
      setError(err.message || 'Erreur inattendue')
      setIsAuthenticated(false)
    }
  }

  const retry = () => {
    setIsAuthenticated(null)
    setError(null)
    checkAuth()
  }

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Vérification de l'authentification...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erreur d'authentification</h2>
            <p className="text-gray-600 mb-4">
              {error || 'Impossible de vérifier votre authentification'}
            </p>
            <div className="space-y-2">
              <Button onClick={retry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/auth/login'}
                className="w-full"
              >
                Se connecter
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}


