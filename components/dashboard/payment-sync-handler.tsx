'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function PaymentSyncHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const syncIfNeeded = async () => {
      const shouldSync = searchParams.get('sync') === 'true'
      const paymentSuccess = searchParams.get('payment') === 'success'
      
      if (shouldSync || paymentSuccess) {
        // Retirer les paramètres de l'URL immédiatement pour éviter les re-synchronisations
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.delete('sync')
        currentUrl.searchParams.delete('payment')
        router.replace(currentUrl.pathname + currentUrl.search)

        try {
          // Attendre un peu pour que le webhook Stripe ait le temps de s'exécuter
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Synchroniser automatiquement avec Stripe
          const response = await fetch('/api/billing/sync-plan', {
            method: 'POST',
          })
          
          const data = await response.json()
          
          if (response.ok && data.success) {
            console.log('✅ Synchronisation automatique réussie après paiement:', data)
            // Forcer un refresh de la page pour charger les nouvelles données
            window.location.reload()
          } else {
            console.warn('⚠️ Synchronisation automatique échouée, réessai dans 3 secondes...')
            // Réessayer après 3 secondes au cas où le webhook n'a pas encore traité
            setTimeout(async () => {
              const retryResponse = await fetch('/api/billing/sync-plan', {
                method: 'POST',
              })
              const retryData = await retryResponse.json()
              if (retryResponse.ok && retryData.success) {
                console.log('✅ Synchronisation automatique réussie (réessai):', retryData)
                window.location.reload()
              }
            }, 3000)
          }
        } catch (error) {
          console.error('❌ Erreur synchronisation automatique:', error)
        }
      }
    }

    syncIfNeeded()
  }, [searchParams, router])

  return null // Ce composant ne rend rien
}
