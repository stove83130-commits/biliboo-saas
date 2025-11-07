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

  // Définir loadEmailConfigs AVANT le useEffect qui l'utilise
  const loadEmailConfigs = useCallback(async () => {
    try {
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

      // Utiliser l'endpoint /api/connections
      const response = await fetch('/api/connections')
      const result = await response.json()

      if (result.success && result.data) {
        // Filtrer les connexions selon le type de workspace
        let filteredConnections = result.data

        if (isPersonalWorkspace) {
          // Pour un workspace personnel, charger les comptes avec workspace_id = null
          filteredConnections = result.data.filter((conn: any) => 
            conn.workspace_id === null || conn.workspace_id === 'personal' || !conn.workspace_id
          )
          console.log('✅ Extraction - Filtre workspace personnel:', filteredConnections.length, 'comptes')
        } else if (activeWorkspaceId) {
          // Pour un workspace d'organisation, charger uniquement les comptes de ce workspace
          filteredConnections = result.data.filter((conn: any) => 
            conn.workspace_id === activeWorkspaceId
          )
          console.log('✅ Extraction - Filtre workspace organisation:', filteredConnections.length, 'comptes')
        }

        // STRATÉGIE DE FALLBACK: Si aucun compte trouvé avec le filtre, charger tous les comptes
        if (filteredConnections.length === 0 && result.data.length > 0) {
          console.warn('⚠️ Aucun compte trouvé avec le filtre workspace, utilisation de tous les comptes (fallback)')
          filteredConnections = result.data
        }

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

    if (typeof window !== 'undefined') {
      window.addEventListener('workspace:changed', handleWorkspaceChange)
      return () => {
        window.removeEventListener('workspace:changed', handleWorkspaceChange)
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
            console.log(`✅ [FRONTEND] Job terminé avec ${invoicesCount} factures`);
            setLastResult(`✅ ${invoicesCount} factures extraites !`)
            setIsProcessing(false)
            setCurrentJobId(null)
            pollCountRef.current = 0
            startTimeRef.current = null
          } else if (result.job.status === 'failed') {
            setError(`Erreur : ${result.job.errorMessage || 'Échec de l\'extraction'}`)
            setIsProcessing(false)
            setCurrentJobId(null)
            pollCountRef.current = 0
            startTimeRef.current = null
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
        throw new Error(result.error || 'Erreur lors de l\'extraction')
      }

      if (result.success) {
        setLastResult(result.message)
        setCurrentJobId(result.jobId)
        setJobStatus({ status: 'processing' })
        
        // IMPORTANT: Appeler directement l'endpoint de traitement depuis le client
        // Ne PAS attendre la réponse (non bloquant) car l'extraction peut prendre plusieurs minutes
        // Le polling vérifiera le statut du job
        console.log('🚀 Lancement extraction depuis le client pour job:', result.jobId)
        
        // Appel non bloquant - ne pas attendre la réponse
        // Pas de timeout car l'extraction peut prendre du temps et l'appel est déjà non bloquant
        fetch(`/api/extraction/process?jobId=${result.jobId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }).then((processResponse) => {
          if (processResponse.ok) {
            console.log('✅ Extraction process démarrée avec succès')
          } else {
            console.warn('⚠️ Réponse extraction process:', processResponse.status, '- Le traitement continue en arrière-plan')
          }
        }).catch((processError) => {
          // Ignorer silencieusement les erreurs - l'extraction continue en arrière-plan de toute façon
          // Le polling vérifiera le statut du job
          console.log('ℹ️ Appel extraction process terminé (normal) - Le traitement continue en arrière-plan')
        })
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
    </AuthGuard>
  )
}
