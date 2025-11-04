"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RefreshCw, CheckCircle2, X } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { UpgradeModal } from "@/components/dashboard/upgrade-modal"
import { GoogleLogo, MicrosoftLogo } from "@/components/ui/brand-logos"
import { usePlan } from '@/contexts/plan-context'
import { cleanEmailDisplay } from "@/utils/email-cleaner"
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions"

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
  const { hasActivePlan } = usePlan()
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  
  // Pour un workspace personnel (null ou 'personal'), on a toujours les permissions
  // Pour un workspace d'organisation, on vérifie les permissions
  const isPersonalWorkspace = !activeWorkspaceId || activeWorkspaceId === 'personal'
  const workspacePermissions = useWorkspacePermissions(isPersonalWorkspace ? null : activeWorkspaceId)
  
  // Permissions adaptées : pour un workspace personnel, on a toujours les droits
  const permissions = {
    ...workspacePermissions,
    canManageEmailConnections: isPersonalWorkspace ? true : workspacePermissions.canManageEmailConnections
  }
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const workspaceId = localStorage.getItem('active_workspace_id')
      setActiveWorkspaceId(workspaceId)
    }
  }, [])
  
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  useEffect(() => {
    fetchEmailAccounts()
    const handler = () => fetchEmailAccounts()
    if (typeof window !== 'undefined') window.addEventListener('workspace:changed', handler as any)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('workspace:changed', handler as any) }
  }, [])

  useEffect(() => {
    // Check for success/error messages
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const upgrade = searchParams.get('upgrade')
    
    if (success === 'gmail_connected') {
      alert('✅ Gmail connecté avec succès !')
      // Remove query params and refresh accounts
      router.replace('/dashboard/settings')
      // Wait a bit before refreshing to ensure DB has updated
      setTimeout(() => {
        fetchEmailAccounts()
      }, 500)
    } else if (success === 'outlook_connected') {
      alert('✅ Outlook connecté avec succès !')
      router.replace('/dashboard/settings')
      setTimeout(() => {
        fetchEmailAccounts()
      }, 500)
    } else if (error) {
      alert(`❌ Erreur: ${error}`)
      router.replace('/dashboard/settings')
    } else if (upgrade === 'true') {
      setShowUpgradeModal(true)
      router.replace('/dashboard/settings')
    }
  }, [searchParams])

  const fetchEmailAccounts = async () => {
    try {
      const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
      let query: any = supabase
        .from('email_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
        query = query.eq('workspace_id', activeWorkspaceId)
      } else {
        query = query.is('workspace_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      setEmailAccounts(data || [])
    } catch (error) {
      console.error('Error fetching email accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGmail = () => {
    // Pour ajouter un compte Gmail, on utilise toujours 'personal' ou on ne passe pas de workspaceId
    // Cela permet d'ajouter un compte personnel sans vérifier les permissions de workspace
    const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
    // Ne passer workspaceId que si c'est vraiment un workspace d'organisation (pas 'personal')
    const qs = activeWorkspaceId && activeWorkspaceId !== 'personal' && activeWorkspaceId.trim() !== '' 
      ? `?workspaceId=${encodeURIComponent(activeWorkspaceId)}` 
      : ''
    window.location.href = `/api/gmail/connect${qs}`
  }

  // Fonctions de scan supprimées - utiliser l'onglet "Extraction" à la place

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

  const gmailAccount = emailAccounts.find(acc => acc.provider === 'gmail' && acc.is_active)
  const outlookAccount = emailAccounts.find(acc => acc.provider === 'outlook' && acc.is_active)

  const handleConnectOutlook = () => {
    window.location.href = '/api/outlook/connect'
  }

  const handleScanOutlook = async () => {
    // Rediriger vers l'onglet Extraction pour utiliser le nouveau système
    window.location.href = '/dashboard/extraction'
  }

  const handleScanOutlookAccount = async (accountId: string) => {
    // Rediriger vers l'onglet Extraction pour utiliser le nouveau système
    window.location.href = '/dashboard/extraction'
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Résumé plan / limites */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Comptes e-mail utilisés: <span className="text-foreground font-medium">{emailAccounts.filter(a=>a.is_active).length}</span>
            {!hasActivePlan && (
              <span className="ml-2 text-amber-600">Limite atteinte - Plan requis</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={hasActivePlan ? handleConnectGmail : () => alert('Aucun plan actif. Choisissez un plan pour ajouter des comptes email.')} 
              className="gap-2"
              disabled={!hasActivePlan}
            >
              <GoogleLogo className="h-4 w-4" /> Ajouter un compte Gmail
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={hasActivePlan ? handleConnectOutlook : () => alert('Aucun plan actif. Choisissez un plan pour ajouter des comptes email.')} 
              className="gap-2"
              disabled={!hasActivePlan}
            >
              <MicrosoftLogo className="h-4 w-4" /> Ajouter un compte Outlook
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">Connecteur</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos connexions aux services de messagerie
          </p>
        </div>

        {/* Gmail Connection (premier compte) */}
        <Card className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gmailAccount ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
                  <GoogleLogo className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{gmailAccount.email}</p>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {gmailAccount.last_sync_at
                      ? `Dernière synchro: ${new Date(gmailAccount.last_sync_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : 'Jamais synchronisé'}
                  </p>
                </div>
              </div>
              {permissions.canManageEmailConnections && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDisconnectAccount(gmailAccount.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
                  <GoogleLogo className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Gmail</p>
                  <p className="text-xs text-muted-foreground">Non connecté</p>
                </div>
              </div>
              {permissions.canManageEmailConnections && (
                <Button
                  onClick={hasActivePlan ? handleConnectGmail : () => alert('Aucun plan actif. Choisissez un plan pour connecter des comptes email.')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!hasActivePlan}
                >
                  Connecter
                </Button>
              )}
              {!permissions.canManageEmailConnections && !isPersonalWorkspace && (
                <p className="text-xs text-muted-foreground">Seuls les propriétaires et administrateurs peuvent gérer les connexions</p>
              )}
            </div>
          )}
        </Card>

        {/* Outlook Connection (premier compte) */}
        <Card className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : outlookAccount ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
                  <MicrosoftLogo className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{outlookAccount.email}</p>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {outlookAccount.last_sync_at
                      ? `Dernière synchro: ${new Date(outlookAccount.last_sync_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : 'Jamais synchronisé'}
                  </p>
                </div>
              </div>
              {permissions.canManageEmailConnections && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDisconnectAccount(outlookAccount.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
                  <MicrosoftLogo className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Outlook</p>
                  <p className="text-xs text-muted-foreground">Non connecté</p>
                </div>
              </div>
              {permissions.canManageEmailConnections && (
                <Button
                  onClick={hasActivePlan ? handleConnectOutlook : () => alert('Aucun plan actif. Choisissez un plan pour connecter des comptes email.')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!hasActivePlan}
                >
                  Connecter
                </Button>
              )}
              {!permissions.canManageEmailConnections && !isPersonalWorkspace && (
                <p className="text-xs text-muted-foreground">Seuls les propriétaires et administrateurs peuvent gérer les connexions</p>
              )}
            </div>
          )}
        </Card>

        {/* Liste multi-comptes Gmail */}
        <Card className="p-6">
          <div className="mb-4 text-sm font-medium text-foreground">Comptes Gmail connectés</div>
          <div className="flex flex-col gap-3">
            {emailAccounts.filter(a=>a.provider==='gmail').length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun compte Gmail connecté.</div>
            )}
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
                  {permissions.canManageEmailConnections && (
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnectAccount(acc.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Liste multi-comptes Outlook */}
        <Card className="p-6">
          <div className="mb-4 text-sm font-medium text-foreground">Comptes Outlook connectés</div>
          <div className="flex flex-col gap-3">
            {emailAccounts.filter(a=>a.provider==='outlook').length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun compte Outlook connecté.</div>
            )}
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
                  {permissions.canManageEmailConnections && (
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnectAccount(acc.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan="starter"
        currentUsage={0}
        currentLimit={100}
      />
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
