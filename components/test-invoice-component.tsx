'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function InvoiceTestComponent() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Non authentifié')
        setLoading(false)
        return
      }

      console.log('🔍 [TEST] User ID:', user.id)

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ [TEST] Erreur:', error)
        setError(error.message)
        setLoading(false)
        return
      }

      console.log('🔍 [TEST] Factures récupérées:', data?.length || 0)
      console.log('🔍 [TEST] Données:', data)
      
      setInvoices(data || [])
      setLoading(false)
    } catch (err) {
      console.error('❌ [TEST] Erreur catch:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  if (error) {
    return (
      <Card className="p-4 bg-red-50 border-red-200">
        <p className="text-red-700">Erreur: {error}</p>
        <Button onClick={fetchInvoices} className="mt-2">
          Réessayer
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Test des factures</h3>
        <Button onClick={fetchInvoices} size="sm">
          Rafraîchir
        </Button>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        {invoices.length} facture(s) trouvée(s)
      </p>

      {invoices.length === 0 ? (
        <p className="text-gray-500">Aucune facture trouvée</p>
      ) : (
        <div className="space-y-2">
          {invoices.slice(0, 5).map((invoice) => (
            <div key={invoice.id} className="p-2 border rounded text-sm">
              <div><strong>ID:</strong> {invoice.id}</div>
              <div><strong>Vendor:</strong> {invoice.vendor}</div>
              <div><strong>Amount:</strong> {invoice.amount || 'N/A'}</div>
              <div><strong>Date:</strong> {invoice.date || 'N/A'}</div>
              <div><strong>Description:</strong> {invoice.description || 'N/A'}</div>
              <div><strong>Created:</strong> {new Date(invoice.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}


