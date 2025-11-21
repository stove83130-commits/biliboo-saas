'use client'

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RefreshCw, X, Plus } from "lucide-react"
import { useState, useEffect, useCallback, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { GoogleLogo, MicrosoftLogo } from "@/components/ui/brand-logos"
import { cleanEmailDisplay } from "@/utils/email-cleaner"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface EmailAccount {
  id: string
  provider: string
  email: string
  is_active: boolean
  last_sync_at: string | null
}

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEmailAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('⚠️ Pas d\'utilisateur, arrêt du chargement des comptes')
        return
      }
      
      const { data: allAccounts, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Erreur requête email_accounts:', error)
        throw error
      }

      setEmailAccounts(allAccounts || [])
    } catch (error) {
      console.error('❌ Error fetching email accounts:', error)
      setEmailAccounts([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchEmailAccounts()
  }, [fetchEmailAccounts])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success === 'gmail_connected' || success === 'outlook_connected') {
      alert('✅ Compte connecté avec succès !')
      router.replace('/dashboard/settings')
      fetchEmailAccounts()
      setTimeout(() => fetchEmailAccounts(), 1000)
      setTimeout(() => fetchEmailAccounts(), 2000)
    } else if (error) {
      alert(`❌ Erreur: ${error}`)
      router.replace('/dashboard/settings')
    }
  }, [searchParams, fetchEmailAccounts, router])

  const handleDisconnectAccount = async (accountId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter ce compte ?')) return

    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({ is_active: false })
        .eq('id', accountId)

      if (error) throw error
      alert('Compte déconnecté')
      fetchEmailAccounts()
    } catch (error) {
      console.error('Error disconnecting account:', error)
      alert('Erreur lors de la déconnexion')
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Connecteur</h1>
            <p className="text-sm text-muted-foreground">
              Gérez vos connexions aux services de messagerie
            </p>
          </div>
        </div>

        {/* Liste multi-comptes Gmail */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Comptes Gmail connectés</div>
          </div>
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : emailAccounts.filter(a=>a.provider==='gmail').length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun compte Gmail connecté.</div>
            ) : null}
            {emailAccounts.filter(a=>a.provider==='gmail').map(acc => (
              <div key={acc.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background">
                    <GoogleLogo className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm text-foreground">{cleanEmailDisplay(acc.email)}</div>
                    <div className="text-xs text-muted-foreground">{acc.is_active ? 'Actif' : 'Inactif'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDisconnectAccount(acc.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Liste multi-comptes Outlook */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Comptes Outlook connectés</div>
          </div>
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : emailAccounts.filter(a=>a.provider==='outlook').length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun compte Outlook connecté.</div>
            ) : null}
            {emailAccounts.filter(a=>a.provider==='outlook').map(acc => (
              <div key={acc.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background">
                    <MicrosoftLogo className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm text-foreground">{cleanEmailDisplay(acc.email)}</div>
                    <div className="text-xs text-muted-foreground">{acc.is_active ? 'Actif' : 'Inactif'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDisconnectAccount(acc.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}
