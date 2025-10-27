'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function SimpleInvoiceTest() {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      
      // Test 1: Vérifier l'authentification
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setError('Non authentifié: ' + (authError?.message || 'Pas d\'utilisateur'))
        setLoading(false)
        return
      }

      console.log('✅ Utilisateur authentifié:', user.id)

      // Test 2: Compter les factures
      const { count, error: countError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) {
        setError('Erreur comptage: ' + countError.message)
        setLoading(false)
        return
      }

      console.log('✅ Nombre de factures:', count)
      setCount(count)
      setLoading(false)

    } catch (err) {
      console.error('❌ Erreur:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <Card className="p-4 bg-yellow-50 border-yellow-200">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-yellow-800">🔍 Test Simple</h3>
        <Button onClick={testConnection} size="sm" variant="outline">
          Tester
        </Button>
      </div>
      
      {loading && <p className="text-yellow-700">Chargement...</p>}
      
      {error && (
        <div className="text-red-700">
          <p><strong>Erreur:</strong> {error}</p>
        </div>
      )}
      
      {count !== null && !loading && !error && (
        <div className="text-green-700">
          <p><strong>✅ Factures trouvées:</strong> {count}</p>
          {count === 0 && (
            <p className="text-sm mt-1">Aucune facture dans la base de données</p>
          )}
        </div>
      )}
    </Card>
  )
}


