'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

export default function DebugPage() {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        
        // Récupérer la session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // Récupérer l'utilisateur
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        // Récupérer les cookies
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=')
          if (key.startsWith('sb-')) {
            acc[key] = value?.substring(0, 50) + (value && value.length > 50 ? '...' : '')
          }
          return acc
        }, {} as Record<string, string>)

        setInfo({
          hostname: window.location.hostname,
          origin: window.location.origin,
          protocol: window.location.protocol,
          session: session ? {
            user: {
              id: session.user.id,
              email: session.user.email,
            },
            expires_at: session.expires_at,
            access_token: session.access_token?.substring(0, 20) + '...',
          } : null,
          sessionError: sessionError?.message,
          user: user ? {
            id: user.id,
            email: user.email,
            app_metadata: user.app_metadata,
            user_metadata: user.user_metadata,
          } : null,
          userError: userError?.message,
          cookies,
          cookieCount: Object.keys(cookies).length,
        })
      } catch (err: any) {
        setInfo({
          error: err.message,
          stack: err.stack,
        })
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <Card className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">🔍 Diagnostic OAuth</h1>
        
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Informations du navigateur</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify({
                hostname: info?.hostname,
                origin: info?.origin,
                protocol: info?.protocol,
              }, null, 2)}
            </pre>
          </div>

          <div>
            <h2 className="font-semibold mb-2">Session Supabase</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify({
                session: info?.session,
                sessionError: info?.sessionError,
              }, null, 2)}
            </pre>
          </div>

          <div>
            <h2 className="font-semibold mb-2">Utilisateur Supabase</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify({
                user: info?.user,
                userError: info?.userError,
              }, null, 2)}
            </pre>
          </div>

          <div>
            <h2 className="font-semibold mb-2">Cookies Supabase ({info?.cookieCount || 0})</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(info?.cookies || {}, null, 2)}
            </pre>
          </div>

          {info?.error && (
            <div>
              <h2 className="font-semibold mb-2 text-red-600">Erreur</h2>
              <pre className="bg-red-50 p-4 rounded text-sm overflow-auto text-red-800">
                {JSON.stringify({
                  error: info.error,
                  stack: info.stack,
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

