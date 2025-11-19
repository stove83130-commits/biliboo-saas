"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RefreshCw, CheckCircle2, X, ChevronDown, Plus } from "lucide-react"
import { useState, useEffect, useCallback, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { UpgradeModal } from "@/components/dashboard/upgrade-modal"
import { GoogleLogo, MicrosoftLogo } from "@/components/ui/brand-logos"
import { usePlan } from '@/contexts/plan-context'
import { cleanEmailDisplay } from "@/utils/email-cleaner"
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const [workspaceType, setWorkspaceType] = useState<'personal' | 'organization' | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Charger le type du workspace depuis l'API
  useEffect(() => {
    const loadWorkspaceType = async () => {
      // Charger l'ID depuis localStorage
      const workspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null
      const finalWorkspaceId = workspaceId && workspaceId.trim() !== '' ? workspaceId : null
      if (!finalWorkspaceId) {
        setWorkspaceType('personal')
        setIsInitialized(true)
        return
      }
      
      try {
        const response = await fetch('/api/workspaces')
        if (response.ok) {
          const data = await response.json()
          const workspace = data.workspaces?.find((w: any) => w.id === finalWorkspaceId)
          if (workspace) {
            setWorkspaceType(workspace.type || 'organization')
            console.log('📋 Workspace type chargé:', workspace.type, 'pour ID:', finalWorkspaceId)
          } else {
            // Si le workspace n'est pas trouvé, considérer comme personnel par défaut
            setWorkspaceType('personal')
            console.log('⚠️ Workspace non trouvé, considéré comme personnel')
          }
        } else {
          // En cas d'erreur, considérer comme personnel par défaut
          setWorkspaceType('personal')
          console.log('⚠️ Erreur chargement workspace, considéré comme personnel')
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement du type de workspace:', error)
        // En cas d'erreur, considérer comme personnel par défaut
        setWorkspaceType('personal')
      } finally {
        setIsInitialized(true)
    }
    }
    
    loadWorkspaceType()
  }, [])
  
  // Pour un workspace personnel (type === 'personal'), on a toujours les permissions
  // Pour un workspace d'organisation, on vérifie les permissions
  // IMPORTANT: Utiliser le TYPE du workspace, pas seulement l'ID
  const getCurrentWorkspaceId = () => {
    if (activeWorkspaceId !== null) return activeWorkspaceId
    if (typeof window === 'undefined') return null
    const workspaceId = localStorage.getItem('active_workspace_id')
    return workspaceId && workspaceId.trim() !== '' ? workspaceId : null
  }
  const currentWorkspaceId = getCurrentWorkspaceId()
  const isPersonalWorkspace = workspaceType === 'personal' || workspaceType === null
  // Si c'est un workspace personnel, on ne passe pas l'ID au hook (null), sinon on passe l'ID
  const normalizedWorkspaceId = isPersonalWorkspace ? null : currentWorkspaceId
  const workspacePermissions = useWorkspacePermissions(normalizedWorkspaceId)
  
  // Permissions adaptées : pour un workspace personnel, on a toujours les droits complets
  // IMPORTANT: On force canManageEmailConnections à true pour les espaces personnels
  // car le hook retourne false par défaut même pour null
  // DOUBLE CHECK: Si c'est un espace personnel, on a TOUJOURS les permissions, peu importe ce que dit le hook
  const canManageEmailConnections = isPersonalWorkspace ? true : workspacePermissions.canManageEmailConnections
  
  const permissions = {
    ...workspacePermissions,
    canManageEmailConnections, // Utiliser la valeur calculée
    canModifyOrganization: isPersonalWorkspace ? true : workspacePermissions.canModifyOrganization,
    canDeleteOrganization: isPersonalWorkspace ? true : workspacePermissions.canDeleteOrganization,
    canViewBilling: isPersonalWorkspace ? true : workspacePermissions.canViewBilling,
    canManageBilling: isPersonalWorkspace ? true : workspacePermissions.canManageBilling,
    canInviteMembers: isPersonalWorkspace ? true : workspacePermissions.canInviteMembers,
    canViewInvoices: isPersonalWorkspace ? true : workspacePermissions.canViewInvoices,
    canManageInvoices: isPersonalWorkspace ? true : workspacePermissions.canManageInvoices,
    canViewFullStatistics: isPersonalWorkspace ? true : workspacePermissions.canViewFullStatistics,
    canViewActivityLogs: isPersonalWorkspace ? true : workspacePermissions.canViewActivityLogs,
  }
  
  console.log('🔍 Permissions debug:', {
    activeWorkspaceId,
    workspaceType,
    isPersonalWorkspace,
    canManageEmailConnections,
    workspacePermissionsCanManage: workspacePermissions.canManageEmailConnections,
    workspacePermissionsRole: workspacePermissions.role,
    normalizedWorkspaceId
  })
  
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [emailLimitError, setEmailLimitError] = useState<string | null>(null)

  // IMPORTANT: Définir fetchEmailAccounts AVANT les useEffect qui l'utilisent
  const fetchEmailAccounts = useCallback(async (useCache = true) => {
    try {
      // OPTIMISATION: Charger depuis le cache immédiatement pour un affichage instantané
      if (useCache && typeof window !== 'undefined') {
        const cacheKey = `email_accounts_cache_${currentWorkspaceId || 'personal'}`
        const cachedData = localStorage.getItem(cacheKey)
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)
        
        // Si le cache existe et est récent (moins de 30 secondes), l'utiliser
        if (cachedData && cacheTimestamp) {
          const age = Date.now() - parseInt(cacheTimestamp, 10)
          if (age < 30000) { // 30 secondes
            try {
              const parsed = JSON.parse(cachedData)
              console.log('✅ [CACHE] Comptes email chargés depuis le cache:', parsed.length, 'comptes')
              setEmailAccounts(parsed)
              setLoading(false)
              // Continuer à rafraîchir en arrière-plan
            } catch (e) {
              console.warn('⚠️ [CACHE] Erreur parsing cache, rechargement...')
            }
          }
        }
      }
      
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('⚠️ Pas d\'utilisateur, arrêt du chargement des comptes')
        return
      }
      
      // Utiliser le workspaceType et currentWorkspaceId pour déterminer la requête
      // Charger l'ID depuis localStorage si nécessaire
      const workspaceIdFromStorage = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
      const workspaceIdToUse = currentWorkspaceId || workspaceIdFromStorage
      
      // IMPORTANT: Utiliser le TYPE du workspace pour déterminer la requête
      // Si c'est un workspace personnel (type === 'personal'), charger les comptes sans workspace_id
      // Si c'est un workspace d'organisation, charger uniquement les comptes de ce workspace
      // Si workspaceType n'est pas encore chargé, utiliser une logique de fallback pour charger les comptes personnels
      const isPersonal = workspaceType === 'personal' || (workspaceType === null && (!workspaceIdToUse || workspaceIdToUse === 'personal'))
      
      console.log('🔍 fetchEmailAccounts debug:', {
        workspaceType,
        workspaceIdToUse,
        isPersonal,
        currentWorkspaceId,
        isInitialized,
        userId: user.id
      })
      
      // STRATÉGIE: Charger TOUS les comptes actifs, puis filtrer côté client
      // Cela évite les problèmes de syntaxe Supabase avec .or() et garantit la récupération des comptes
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

      // Filtrer les comptes selon le type de workspace (côté client)
      let data = allAccounts || []
      
      if (isPersonal || workspaceType === null) {
        // Pour un workspace personnel, charger les comptes avec workspace_id = null ou 'personal'
        data = (allAccounts || []).filter((account: any) => 
          account.workspace_id === null || 
          account.workspace_id === 'personal' || 
          !account.workspace_id
        )
        console.log('✅ Filtre workspace personnel appliqué:', data.length, 'comptes sur', allAccounts?.length || 0)
      } else if (workspaceIdToUse && workspaceIdToUse.trim() !== '') {
        // Pour un workspace d'organisation, charger uniquement les comptes de ce workspace
        data = (allAccounts || []).filter((account: any) => 
          account.workspace_id === workspaceIdToUse
        )
        console.log('✅ Filtre workspace organisation appliqué:', data.length, 'comptes sur', allAccounts?.length || 0)
      } else {
        // Par défaut, charger les comptes personnels
        data = (allAccounts || []).filter((account: any) => 
          account.workspace_id === null || 
          account.workspace_id === 'personal' || 
          !account.workspace_id
        )
        console.log('✅ Filtre par défaut (personnel) appliqué:', data.length, 'comptes sur', allAccounts?.length || 0)
      }
      
      console.log('📧 Comptes email récupérés:', data?.length || 0, 'comptes')
      if (data && data.length > 0) {
        console.log('📧 Détails comptes:', data.map(a => ({ 
          id: a.id, 
          email: a.email, 
          provider: a.provider, 
          workspace_id: a.workspace_id,
          is_active: a.is_active
        })))
      } else {
        console.warn('⚠️ Aucun compte email trouvé pour cet utilisateur')
      }
      
      // Sauvegarder dans le cache
      if (typeof window !== 'undefined') {
        const cacheKey = `email_accounts_cache_${workspaceIdToUse || 'personal'}`
        localStorage.setItem(cacheKey, JSON.stringify(data))
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
        console.log('✅ [CACHE] Comptes email sauvegardés dans le cache')
      }
      
      setEmailAccounts(data || [])
    } catch (error) {
      console.error('❌ Error fetching email accounts:', error)
      setEmailAccounts([])
    } finally {
      setLoading(false)
    }
  }, [supabase, currentWorkspaceId, workspaceType, isInitialized])
  
  // Écouter les changements de workspace
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleWorkspaceChange = async (event?: any) => {
      const workspaceId = localStorage.getItem('active_workspace_id')
      const workspaceIdFromEvent = event?.detail?.id
      const finalWorkspaceId = workspaceIdFromEvent || workspaceId
      
      setActiveWorkspaceId(finalWorkspaceId && finalWorkspaceId.trim() !== '' ? finalWorkspaceId : null)
      
      // Recharger le type du workspace
      if (finalWorkspaceId && finalWorkspaceId.trim() !== '') {
        try {
          const response = await fetch('/api/workspaces')
          if (response.ok) {
            const data = await response.json()
            const workspace = data.workspaces?.find((w: any) => w.id === finalWorkspaceId)
            if (workspace) {
              setWorkspaceType(workspace.type || 'organization')
              console.log('🔄 Workspace changé:', finalWorkspaceId, 'Type:', workspace.type)
            } else {
              setWorkspaceType('personal')
            }
          }
        } catch (error) {
          console.error('❌ Erreur lors du rechargement du type:', error)
          setWorkspaceType('personal')
        }
      } else {
        setWorkspaceType('personal')
      }
      
      setIsInitialized(true)
      fetchEmailAccounts()
    }
    
    window.addEventListener('workspace:changed', handleWorkspaceChange as any)
    return () => {
      window.removeEventListener('workspace:changed', handleWorkspaceChange as any)
    }
  }, [fetchEmailAccounts])

  useEffect(() => {
    // Ne charger les comptes que si le workspace est initialisé ET que workspaceType est chargé
    if (isInitialized && workspaceType !== null) {
    fetchEmailAccounts()
    }
    const handler = () => fetchEmailAccounts()
    if (typeof window !== 'undefined') window.addEventListener('workspace:changed', handler as any)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('workspace:changed', handler as any) }
  }, [isInitialized, workspaceType, fetchEmailAccounts])

  useEffect(() => {
    // Check for success/error messages
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const upgrade = searchParams.get('upgrade')
    
    if (success === 'gmail_connected') {
      alert('✅ Gmail connecté avec succès !')
      // Remove query params
      router.replace('/dashboard/settings')
      // Force refresh accounts immediately and after a delay
      fetchEmailAccounts()
      setTimeout(() => {
        fetchEmailAccounts()
      }, 1000)
      // Also refresh after 2 seconds to ensure DB has updated
      setTimeout(() => {
        fetchEmailAccounts()
      }, 2000)
    } else if (success === 'outlook_connected') {
      alert('✅ Outlook connecté avec succès !')
      router.replace('/dashboard/settings')
      // Force refresh accounts immediately and after a delay
      fetchEmailAccounts()
      setTimeout(() => {
        fetchEmailAccounts()
      }, 1000)
      // Also refresh after 2 seconds to ensure DB has updated
      setTimeout(() => {
        fetchEmailAccounts()
      }, 2000)
    } else if (error) {
      let errorMessage = 'Une erreur est survenue'
      if (error === 'database_error') {
        errorMessage = '❌ Erreur de base de données : Les colonnes token_expires_at et workspace_id manquent dans la table email_accounts. Exécutez le script SQL dans scripts/add-missing-email-accounts-columns.sql dans Supabase SQL Editor pour corriger cela.'
      } else if (error === 'outlook_connection_failed') {
        errorMessage = '❌ Échec de la connexion Outlook. Vérifiez vos identifiants Microsoft.'
      } else if (error === 'no_code') {
        errorMessage = '❌ Code d\'autorisation manquant. Réessayez la connexion.'
      } else if (error === 'connection_failed') {
        errorMessage = '❌ Échec de la connexion. Vérifiez votre connexion internet et réessayez.'
      } else {
        errorMessage = `❌ Erreur: ${error}`
      }
      alert(errorMessage)
      router.replace('/dashboard/settings')
    } else if (upgrade === 'true') {
      setShowUpgradeModal(true)
      router.replace('/dashboard/settings')
    }
  }, [searchParams, fetchEmailAccounts])

  const handleConnectGmail = async () => {
    try {
      setEmailLimitError(null)
      // Vérifier d'abord la limite avant de rediriger
      const checkResponse = await fetch('/api/gmail/check-limit')
      
      if (!checkResponse.ok) {
        const errorData = await checkResponse.json()
        if (errorData.error === 'plan_limit_reached') {
          setEmailLimitError('Vous avez atteint la limite de comptes e-mail de votre plan actuel. Upgradez votre plan pour connecter plus de comptes e-mail.')
          return
        }
      }

      // Si la limite n'est pas atteinte, rediriger vers l'API de connexion
      const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
      const qs = activeWorkspaceId && activeWorkspaceId !== 'personal' && activeWorkspaceId.trim() !== '' 
        ? `?workspaceId=${encodeURIComponent(activeWorkspaceId)}` 
        : ''
      window.location.href = `/api/gmail/connect${qs}`
    } catch (error) {
      console.error('Erreur lors de la connexion Gmail:', error)
      // En cas d'erreur, essayer la redirection classique
      const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
      const qs = activeWorkspaceId && activeWorkspaceId !== 'personal' && activeWorkspaceId.trim() !== '' 
        ? `?workspaceId=${encodeURIComponent(activeWorkspaceId)}` 
        : ''
      window.location.href = `/api/gmail/connect${qs}`
    }
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              disabled={!hasActivePlan}
            >
                  <Plus className="h-4 w-4" /> Ajouter un compte
                  <ChevronDown className="h-4 w-4" />
            </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={hasActivePlan ? handleConnectGmail : () => alert('Aucun plan actif. Choisissez un plan pour ajouter des comptes email.')}
                  disabled={!hasActivePlan}
                  className="gap-2"
                >
                  <GoogleLogo className="h-4 w-4" /> Gmail
                </DropdownMenuItem>
                <DropdownMenuItem
              onClick={hasActivePlan ? handleConnectOutlook : () => alert('Aucun plan actif. Choisissez un plan pour ajouter des comptes email.')} 
                  disabled={!hasActivePlan}
              className="gap-2"
            >
                  <MicrosoftLogo className="h-4 w-4" /> Outlook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">Connecteur</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos connexions aux services de messagerie
          </p>
        </div>

        {/* Liste multi-comptes Gmail */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Comptes Gmail connectés</div>
            {permissions.canManageEmailConnections && (
              <Button
                onClick={hasActivePlan ? handleConnectGmail : () => alert('Aucun plan actif. Choisissez un plan pour connecter des comptes email.')}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!hasActivePlan}
              >
                <Plus className="h-4 w-4" /> Ajouter Gmail
              </Button>
            )}
          </div>
          {emailLimitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-600 mb-2">{emailLimitError}</p>
              <Button
                onClick={() => window.location.href = '/plans'}
                size="sm"
                className="text-white hover:opacity-90 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                }}
              >
                Voir les plans
              </Button>
            </div>
          )}
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
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Comptes Outlook connectés</div>
            {permissions.canManageEmailConnections && emailAccounts.filter(a=>a.provider==='outlook').length === 0 && (
              <Button
                onClick={hasActivePlan ? handleConnectOutlook : () => alert('Aucun plan actif. Choisissez un plan pour connecter des comptes email.')}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!hasActivePlan}
              >
                <Plus className="h-4 w-4" /> Ajouter Outlook
              </Button>
            )}
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
