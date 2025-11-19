'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RefreshCw, CheckCircle, XCircle, FileText, Calendar, Database, Check } from 'lucide-react'
import { GoogleLogo, MicrosoftLogo } from '@/components/ui/brand-logos'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlanLimitModal } from '@/components/dashboard/plan-limit-modal'

interface EmailConfig {
  id: string
  imap_email: string
  email_provider: string
  is_active: boolean
  last_sync_at: string | null
}

export default function ExtractionPage() {
  const [emailConfigs, setEmailConfigs] = useState<EmailConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  const [searchSince, setSearchSince] = useState<string>('')
  const [searchUntil, setSearchUntil] = useState<string>('')
  const [periodType, setPeriodType] = useState<'month' | 'year' | 'custom'>('month')
  const [monthSelect, setMonthSelect] = useState<string>('') // format MM
  const [yearSelect, setYearSelect] = useState<string>('')
  const [yearOnly, setYearOnly] = useState<string>('') // sélection d'une année entière
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<any>(null)
  const completedAtRef = useRef<number | null>(null) // Timestamp quand le job a été marqué comme "completed"
  const lastInvoiceCountRef = useRef<number>(0) // Dernier nombre de factures vu
  const stableCountRef = useRef<number>(0) // Nombre de fois que le count est resté stable
  const [showLimitModal, setShowLimitModal] = useState(false)

  // Définir loadEmailConfigs AVANT le useEffect qui l'utilise
  const loadEmailConfigs = useCallback(async (useCache = true) => {
    try {
      // OPTIMISATION: Charger depuis le cache immédiatement pour un affichage instantané
      if (useCache && typeof window !== 'undefined') {
        const activeWorkspaceId = localStorage.getItem('active_workspace_id') || 'personal'
        const cacheKey = `extraction_connections_cache_${activeWorkspaceId}`
        const cachedData = localStorage.getItem(cacheKey)
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)
        
        // Si le cache existe et est récent (moins de 30 secondes), l'utiliser
        if (cachedData && cacheTimestamp) {
          const age = Date.now() - parseInt(cacheTimestamp, 10)
          if (age < 30000) { // 30 secondes
            try {
              const parsed = JSON.parse(cachedData)
              console.log('✅ [CACHE] Comptes extraction chargés depuis le cache:', parsed.length, 'comptes')
              setEmailConfigs(parsed)
              if (parsed.length > 0) {
                setSelectedConfig(parsed[0].id)
              }
              // Continuer à rafraîchir en arrière-plan
            } catch (e) {
              console.warn('⚠️ [CACHE] Erreur parsing cache, rechargement...')
            }
          }
        }
      }
      
      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      // Déterminer le type de workspace
      let workspaceType: 'personal' | 'organization' | null = null
      let isPersonalWorkspace = false

      if (activeWorkspaceId && activeWorkspaceId.trim() !== '') {
        try {
          const workspaceResponse = await fetch('/api/workspaces')
          if (workspaceResponse.ok) {
            const workspaceData = await workspaceResponse.json()
            const workspace = workspaceData.workspaces?.find((w: any) => w.id === activeWorkspaceId)
            if (workspace) {
              workspaceType = workspace.type || 'organization'
              isPersonalWorkspace = workspaceType === 'personal'
            } else {
              // Workspace non trouvé, considérer comme personnel par défaut
              isPersonalWorkspace = true
            }
          } else {
            // Erreur API, considérer comme personnel par défaut
            isPersonalWorkspace = true
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de la vérification du type de workspace:', error)
          // En cas d'erreur, considérer comme personnel par défaut
          isPersonalWorkspace = true
        }
      } else {
        // Pas de workspace actif = workspace personnel
        isPersonalWorkspace = true
      }

      console.log('🔍 Extraction - Workspace debug:', {
        activeWorkspaceId,
        workspaceType,
        isPersonalWorkspace
      })

      // Utiliser l'endpoint /api/connections avec le workspace_id en paramètre
      // Le filtrage se fait maintenant côté serveur pour garantir l'isolation des données
      const workspaceIdParam = isPersonalWorkspace ? 'personal' : (activeWorkspaceId || 'personal')
      const response = await fetch(`/api/connections?workspaceId=${workspaceIdParam}`)
      const result = await response.json()

      if (result.success && result.data) {
        // Les connexions sont déjà filtrées côté serveur, pas besoin de filtrer à nouveau
        // Mais on fait une double vérification pour sécurité
        let filteredConnections = result.data

        if (isPersonalWorkspace) {
          // Double vérification : s'assurer que ce sont bien des comptes personnels
          filteredConnections = result.data.filter((conn: any) => 
            conn.workspace_id === null || conn.workspace_id === 'personal' || !conn.workspace_id
          )
          console.log('✅ Extraction - Filtre workspace personnel (vérification):', filteredConnections.length, 'comptes')
        } else if (activeWorkspaceId) {
          // Double vérification : s'assurer que ce sont bien les comptes de ce workspace
          filteredConnections = result.data.filter((conn: any) => 
            conn.workspace_id === activeWorkspaceId
          )
          console.log('✅ Extraction - Filtre workspace organisation (vérification):', filteredConnections.length, 'comptes')
        }

        // SUPPRIMÉ: Plus de fallback qui charge tous les comptes
        // Si aucun compte n'est trouvé, c'est normal (l'utilisateur n'a peut-être pas de comptes pour ce workspace)

        // Adapter le format des connexions au format attendu
        const adaptedConfigs = filteredConnections.map((conn: any) => ({
          id: conn.id,
          imap_email: conn.email,
          email_provider: conn.provider,
          is_active: conn.is_active,
          last_sync_at: conn.last_synced_at,
        }))

        console.log('📧 Extraction - Comptes email chargés:', adaptedConfigs.length, 'comptes')
        if (adaptedConfigs.length > 0) {
          console.log('📧 Extraction - Détails comptes:', adaptedConfigs.map(c => ({ 
            id: c.id, 
            email: c.imap_email, 
            provider: c.email_provider 
          })))
        }

        // Sauvegarder dans le cache
        if (typeof window !== 'undefined') {
          const cacheKey = `extraction_connections_cache_${workspaceIdParam}`
          localStorage.setItem(cacheKey, JSON.stringify(adaptedConfigs))
          localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
          console.log('✅ [CACHE] Comptes extraction sauvegardés dans le cache')
        }

        setEmailConfigs(adaptedConfigs)
        if (adaptedConfigs.length > 0) {
          setSelectedConfig(adaptedConfigs[0].id)
        }
      } else {
        console.warn('⚠️ Extraction - Aucune connexion trouvée dans la réponse API')
        setEmailConfigs([])
      }
    } catch (err) {
      console.error('❌ Erreur chargement configs extraction:', err)
      setEmailConfigs([])
    }
  }, [])

  // Charger les configurations email au montage du composant
  useEffect(() => {
    loadEmailConfigs()
    // Définir la date par défaut (90 jours)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    setSearchSince(ninetyDaysAgo.toISOString().split('T')[0])
    setSearchUntil(new Date().toISOString().split('T')[0])
    // valeurs par défaut pour sélecteurs
    const now = new Date()
    setMonthSelect(String(now.getMonth() + 1).padStart(2, '0'))
    setYearSelect(String(now.getFullYear()))
    setYearOnly('')
    // initialiser en "mois" courant
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setSearchSince(first.toISOString().split('T')[0])
    setSearchUntil(last.toISOString().split('T')[0])

    // Écouter les changements de workspace
    const handleWorkspaceChange = () => {
      console.log('🔄 Workspace changé, rechargement des comptes email...')
      loadEmailConfigs()
    }

    // Écouter le focus de la fenêtre pour recharger les comptes (après connexion d'un nouveau compte)
    const handleFocus = () => {
      console.log('🔄 Fenêtre refocusée, rechargement des comptes email...')
      loadEmailConfigs()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('workspace:changed', handleWorkspaceChange)
      window.addEventListener('focus', handleFocus)
      
      // Recharger aussi quand la page devient visible (retour d'un autre onglet)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          console.log('🔄 Page visible, rechargement des comptes email...')
          loadEmailConfigs()
        }
      })
      
      return () => {
        window.removeEventListener('workspace:changed', handleWorkspaceChange)
        window.removeEventListener('focus', handleFocus)
      }
    }
  }, [loadEmailConfigs])

  // (Périodes prédéfinies supprimées pour un flux minimaliste)

  // Polling du statut du job en cours
  const pollCountRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!currentJobId) {
      // Réinitialiser les compteurs quand il n'y a pas de job
      pollCountRef.current = 0
      startTimeRef.current = null
      completedAtRef.current = null
      lastInvoiceCountRef.current = 0
      stableCountRef.current = 0
      return
    }

    // Initialiser le temps de départ
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now()
      pollCountRef.current = 0
    }

    const maxPolls = 1800 // Maximum 60 minutes (1800 * 2 secondes = 3600 secondes = 60 minutes)
    const maxDuration = 60 * 60 * 1000 // 60 minutes maximum (pour permettre l'extraction de grandes quantités d'emails)

    const pollJobStatus = async () => {
      try {
        // Vérifier le timeout
        if (startTimeRef.current && Date.now() - startTimeRef.current > maxDuration) {
          console.warn('⏰ Timeout polling extraction après 60 minutes')
          setError('Extraction en cours depuis plus d\'une heure. L\'extraction continue en arrière-plan, vous pouvez fermer cette page et revenir plus tard.')
          setIsProcessing(false)
          setCurrentJobId(null)
          pollCountRef.current = 0
          startTimeRef.current = null
          return
        }

        pollCountRef.current++
        if (pollCountRef.current > maxPolls) {
          console.warn('⏰ Limite de polling atteinte (60 minutes)')
          setError('Extraction en cours depuis plus d\'une heure. L\'extraction continue en arrière-plan, vous pouvez fermer cette page et revenir plus tard.')
          setIsProcessing(false)
          setCurrentJobId(null)
          pollCountRef.current = 0
          startTimeRef.current = null
          return
        }

        const response = await fetch(`/api/extraction/status?jobId=${currentJobId}`)
        
        if (!response.ok) {
          // Si le job n'existe plus ou erreur 404, arrêter le polling
          if (response.status === 404) {
            console.warn('⚠️ Job non trouvé, arrêt du polling')
            setError('Job d\'extraction introuvable')
            setIsProcessing(false)
            setCurrentJobId(null)
            pollCountRef.current = 0
            startTimeRef.current = null
            return
          }
          throw new Error(`Erreur HTTP: ${response.status}`)
        }

        const result = await response.json()

        if (result.success && result.job) {
          // Logs pour déboguer
          console.log('📊 [FRONTEND] Job status reçu:', {
            status: result.job.status,
            invoicesExtracted: result.job.invoicesExtracted,
            emailsFound: result.job.emailsFound,
            progress: result.job,
          });

          setJobStatus(result.job)

          if (result.job.status === 'completed') {
            const invoicesCount = result.job.invoicesExtracted || 0;
            
            // Si c'est la première fois qu'on voit "completed", enregistrer le timestamp
            if (completedAtRef.current === null) {
              completedAtRef.current = Date.now();
              lastInvoiceCountRef.current = invoicesCount;
              stableCountRef.current = 0;
              console.log(`✅ [FRONTEND] Job marqué comme "completed" avec ${invoicesCount} factures - Vérification de stabilité...`);
            } else {
              // Vérifier si le nombre de factures a changé depuis la dernière vérification
              if (invoicesCount !== lastInvoiceCountRef.current) {
                console.log(`📊 [FRONTEND] Nombre de factures a changé: ${lastInvoiceCountRef.current} → ${invoicesCount} - Attente de stabilité...`);
                lastInvoiceCountRef.current = invoicesCount;
                stableCountRef.current = 0; // Réinitialiser le compteur de stabilité
              } else {
                stableCountRef.current++;
                console.log(`📊 [FRONTEND] Nombre de factures stable (${invoicesCount}) - ${stableCountRef.current}/3 vérifications`);
              }
              
              // Attendre au moins 5 secondes après "completed" ET 3 vérifications stables consécutives
              const timeSinceCompleted = Date.now() - completedAtRef.current;
              const minWaitTime = 5000; // 5 secondes minimum
              const requiredStableChecks = 3; // 3 vérifications stables consécutives
              
              if (timeSinceCompleted >= minWaitTime && stableCountRef.current >= requiredStableChecks) {
                console.log(`✅ [FRONTEND] Job terminé et stable avec ${invoicesCount} factures (${timeSinceCompleted}ms après "completed", ${stableCountRef.current} vérifications stables)`);
                setLastResult(`✅ ${invoicesCount} factures extraites !`)
            setIsProcessing(false)
            setCurrentJobId(null)
                pollCountRef.current = 0
                startTimeRef.current = null
                completedAtRef.current = null
                lastInvoiceCountRef.current = 0
                stableCountRef.current = 0
              } else {
                // Continuer le polling pour vérifier la stabilité
                console.log(`⏳ [FRONTEND] Attente de stabilité: ${timeSinceCompleted}ms/${minWaitTime}ms, ${stableCountRef.current}/${requiredStableChecks} vérifications stables`);
              }
            }
          } else if (result.job.status === 'failed') {
            setError(`Erreur : ${result.job.errorMessage || 'Échec de l\'extraction'}`)
            setIsProcessing(false)
            setCurrentJobId(null)
            pollCountRef.current = 0
            startTimeRef.current = null
            completedAtRef.current = null
            lastInvoiceCountRef.current = 0
            stableCountRef.current = 0
          } else if (result.job.status === 'processing') {
            // Si le status est 'processing', réinitialiser les compteurs de stabilité
            // (au cas où le job repasserait de "completed" à "processing")
            if (completedAtRef.current !== null) {
              console.log(`⚠️ [FRONTEND] Job repassé de "completed" à "processing" - Réinitialisation des compteurs`);
              completedAtRef.current = null;
              lastInvoiceCountRef.current = 0;
              stableCountRef.current = 0;
            }
          }
          // Si le status est 'processing', on continue le polling
        } else if (result.error) {
          // Si l'API retourne une erreur, arrêter le polling
          console.error('❌ Erreur API polling:', result.error)
          setError(`Erreur : ${result.error}`)
          setIsProcessing(false)
          setCurrentJobId(null)
          pollCountRef.current = 0
          startTimeRef.current = null
        }
      } catch (err) {
        console.error('❌ Erreur polling job:', err)
        // Après 3 erreurs consécutives, arrêter le polling
        if (pollCountRef.current >= 3) {
          setError('Erreur lors de la vérification du statut. Veuillez réessayer.')
          setIsProcessing(false)
          setCurrentJobId(null)
          pollCountRef.current = 0
          startTimeRef.current = null
        }
      }
    }

    // Premier appel immédiat
    pollJobStatus()

    const interval = setInterval(pollJobStatus, 2000)
    return () => clearInterval(interval)
  }, [currentJobId])

  const handleExtract = async () => {
    console.log('🔴 ========== CLIENT: handleExtract appelé ==========')
    console.log('📋 Paramètres:', {
      selectedConfig,
      searchSince,
      searchUntil,
      emailConfigsLength: emailConfigs.length
    })
    
    if (!selectedConfig) {
      console.error('❌ Pas de configuration sélectionnée')
      setError('Veuillez sélectionner une configuration email')
      return
    }

    if (!searchSince) {
      console.error('❌ Pas de date de début')
      setError('Veuillez sélectionner une date de début')
      return
    }

    if (!searchUntil) {
      console.error('❌ Pas de date de fin')
      setError('Veuillez sélectionner une date de fin')
      return
    }

    try {
      console.log('🚀 Démarrage extraction...')
      setIsProcessing(true)
      setError(null)
      setLastResult(null)

      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      console.log('📡 Appel API /api/extraction/start avec:', {
        emailConfigId: selectedConfig,
        searchSince,
        searchUntil,
        workspaceId: activeWorkspaceId
      })

      const response = await fetch('/api/extraction/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailConfigId: selectedConfig,
          searchSince: searchSince,
          searchUntil: searchUntil,
          searchKeywords: ['facture', 'invoice', 'reçu', 'receipt', 'bill'],
          workspaceId: activeWorkspaceId, // 🏢 Passer le workspace actif
        }),
      })

      console.log('📥 Réponse reçue, status:', response.status)

      const result = await response.json()
      console.log('📦 Résultat:', result)

      if (!response.ok) {
        console.error('❌ Erreur HTTP:', response.status, result)
        
        // Gérer l'erreur de limite de plan
        if (result.error === 'plan_limit_reached' && result.feature === 'invoices') {
          setShowLimitModal(true)
          setError(result.message || 'Limite mensuelle de factures atteinte')
          setIsProcessing(false)
          return
        }
        
        throw new Error(result.error || 'Erreur lors de l\'extraction')
      }

      if (result.success) {
        setLastResult(result.message)
        setCurrentJobId(result.jobId)
        setJobStatus({ status: 'processing' })
        
        // IMPORTANT: Ne PAS appeler /api/extraction/process depuis le frontend
        // car /api/extraction/start l'appelle déjà automatiquement
        // Cela évite les appels multiples qui créent des instances parallèles
        console.log('✅ Job d\'extraction créé:', result.jobId, '- Le traitement démarre automatiquement côté serveur')
        console.log('📊 Le polling vérifiera le statut du job toutes les 2 secondes')
      } else {
        setError(result.error || 'Erreur lors de l\'extraction')
        setIsProcessing(false)
      }
    } catch (err) {
      console.error('❌ Erreur dans handleExtract:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setIsProcessing(false)
    }
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Extraire mes factures</h1>
              <p className="text-gray-600 mt-1">
                Extraction automatique via IMAP/OAuth avec analyse IA
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail className="h-4 w-4" />
              <span>{emailConfigs.length} compte{emailConfigs.length > 1 ? 's' : ''} configuré{emailConfigs.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <Card className="p-6">
            <div className="space-y-6">
              {/* Sélection du compte de messagerie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compte de messagerie
                </label>
                {emailConfigs.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Aucun compte configuré. Veuillez d'abord configurer un compte email.
                  </div>
                ) : (
                  <Select
                    value={selectedConfig}
                    onValueChange={setSelectedConfig}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un compte de messagerie">
                        {selectedConfig
                          ? emailConfigs.find(c => c.id === selectedConfig)?.imap_email || 'Sélectionner un compte'
                          : 'Sélectionner un compte de messagerie'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                    {emailConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                        <div className="flex items-center gap-2">
                            <div className="flex h-5 w-5 items-center justify-center">
                            {config.email_provider === 'gmail' ? (
                              <GoogleLogo className="h-4 w-4" />
                            ) : (
                              <MicrosoftLogo className="h-4 w-4" />
                            )}
                          </div>
                            <span>{config.imap_email}</span>
                          </div>
                        </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Périodes prédéfinies supprimées */}

              {/* Sélection par onglets */}
              <div className="space-y-4">
                <div className="border-b border-border">
                  <nav className="flex gap-6">
                    {([
                      { key: 'month', label: 'Mois spécifique' },
                      { key: 'year', label: 'Année complète' },
                      { key: 'custom', label: 'Période personnalisée' },
                    ] as const).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setPeriodType(t.key)}
                        className={`pb-2 text-sm font-medium border-b-2 -mb-px ${
                          periodType === t.key
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {periodType === 'month' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Mois et année</label>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={monthSelect}
                        onChange={(e) => {
                          const m = e.target.value
                          setMonthSelect(m)
                          const y = Number(yearSelect || new Date().getFullYear())
                          const first = new Date(y, Number(m) - 1, 1)
                          const last = new Date(y, Number(m), 0)
                          setSearchSince(first.toISOString().split('T')[0])
                          setSearchUntil(last.toISOString().split('T')[0])
                          setYearOnly('')
                        }}
                        className="w-full h-9 px-3 py-2 border border-border rounded-md bg-background"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={String(m).padStart(2, '0')}>
                            {new Date(2000, m - 1, 1).toLocaleString('fr-FR', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                      <select
                        value={yearSelect}
                        onChange={(e) => {
                          const y = e.target.value
                          setYearSelect(y)
                          if (monthSelect) {
                            const first = new Date(Number(y), Number(monthSelect) - 1, 1)
                            const last = new Date(Number(y), Number(monthSelect), 0)
                            setSearchSince(first.toISOString().split('T')[0])
                            setSearchUntil(last.toISOString().split('T')[0])
                            setYearOnly('')
                          }
                        }}
                        className="w-full h-9 px-3 py-2 border border-border rounded-md bg-background"
                      >
                        {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {periodType === 'year' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Année</label>
                    <select
                      value={yearOnly}
                      onChange={(e) => {
                        const y = e.target.value
                        setYearOnly(y)
                        if (y) {
                          const first = new Date(Number(y), 0, 1)
                          const last = new Date(Number(y), 12, 0)
                          setSearchSince(first.toISOString().split('T')[0])
                          setSearchUntil(last.toISOString().split('T')[0])
                        }
                      }}
                      className="w-full h-9 px-3 py-2 border border-border rounded-md bg-background max-w-xs"
                    >
                      <option value="">— Choisir une année —</option>
                      {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Période personnalisée */}
              {periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Date de début</label>
                    <input
                      type="date"
                      value={searchSince}
                      onChange={(e) => { setSearchSince(e.target.value); setYearOnly('') }}
                      className="w-full h-9 px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Date de fin</label>
                    <input
                      type="date"
                      value={searchUntil}
                      onChange={(e) => { setSearchUntil(e.target.value); setYearOnly('') }}
                      className="w-full h-9 px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 -mt-2">
                💡 Utilisez les boutons ci-dessus pour sélectionner rapidement une période, ou modifiez les dates manuellement.
              </p>

              {/* Bouton d'extraction */}
              <div className="flex justify-center">
                <Button
                  onClick={handleExtract}
                  disabled={isProcessing || emailConfigs.length === 0}
                  className="flex items-center gap-2 px-8 py-3"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {isProcessing ? 'Extraction en cours...' : 'Lancer l\'extraction'}
                </Button>
              </div>
            </div>

            {/* Statut de l'extraction */}
            {jobStatus && (isProcessing || jobStatus.status === 'completed') && (
              <div className="mt-6">
                <Card className={`p-4 ${jobStatus.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isProcessing ? (
                      <>
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-blue-700 font-medium">Extraction en cours...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 font-medium">Extraction terminée</span>
                      </>
                    )}
                  </div>
                  {jobStatus && (
                    <div className={`text-sm ${jobStatus.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
                      <div>📧 Emails trouvés : {jobStatus.emailsFound ?? 0}</div>
                      <div className="mt-2 font-semibold">
                        💰 Factures extraites : {jobStatus.invoicesExtracted ?? 0}
                      </div>
                      {/* Debug: Afficher le statut du job (uniquement en dev) - Retiré pour production */}
                    </div>
                  )}
                  {isProcessing && (
                    <div className="text-xs text-blue-600 mt-2 italic">
                      ⏱️ L'extraction peut prendre plusieurs minutes selon le nombre d'emails. Vous pouvez fermer cette page, l'extraction continuera en arrière-plan.
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Résultat de l'extraction */}
            {lastResult && (
              <div className="mt-6 flex items-center gap-3">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-lg px-4 py-2">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {lastResult}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = '/dashboard/invoices'}
                  className="text-sm"
                >
                  Voir mes factures
                </Button>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="mt-6">
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  {error}
                </Badge>
              </div>
            )}
          </Card>

        </div>
      </DashboardLayout>
      
      {/* Modal de limite de plan */}
      <PlanLimitModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        feature="invoice"
      />
    </AuthGuard>
  )
}
