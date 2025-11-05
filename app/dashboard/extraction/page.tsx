'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RefreshCw, CheckCircle, XCircle, FileText, Calendar, Database, Check } from 'lucide-react'
import { GoogleLogo, MicrosoftLogo } from '@/components/ui/brand-logos'

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
  }, [])

  // (Périodes prédéfinies supprimées pour un flux minimaliste)

  // Polling du statut du job en cours
  useEffect(() => {
    if (!currentJobId) return

    let pollCount = 0
    const maxPolls = 300 // Maximum 10 minutes (300 * 2 secondes)
    const startTime = Date.now()
    const maxDuration = 10 * 60 * 1000 // 10 minutes maximum

    const pollJobStatus = async () => {
      try {
        // Vérifier le timeout
        if (Date.now() - startTime > maxDuration) {
          console.warn('⏰ Timeout polling extraction après 10 minutes')
          setError('Extraction en cours depuis trop longtemps. Veuillez réessayer.')
          setIsProcessing(false)
          setCurrentJobId(null)
          return
        }

        pollCount++
        if (pollCount > maxPolls) {
          console.warn('⏰ Limite de polling atteinte')
          setError('Extraction en cours depuis trop longtemps. Veuillez réessayer.')
          setIsProcessing(false)
          setCurrentJobId(null)
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
            return
          }
          throw new Error(`Erreur HTTP: ${response.status}`)
        }

        const result = await response.json()

        if (result.success && result.job) {
          setJobStatus(result.job)

          if (result.job.status === 'completed') {
            setLastResult(`✅ ${result.job.invoicesExtracted || 0} factures extraites !`)
            setIsProcessing(false)
            setCurrentJobId(null)
          } else if (result.job.status === 'failed') {
            setError(`Erreur : ${result.job.errorMessage || 'Échec de l\'extraction'}`)
            setIsProcessing(false)
            setCurrentJobId(null)
          }
          // Si le status est 'processing', on continue le polling
        } else if (result.error) {
          // Si l'API retourne une erreur, arrêter le polling
          console.error('❌ Erreur API polling:', result.error)
          setError(`Erreur : ${result.error}`)
          setIsProcessing(false)
          setCurrentJobId(null)
        }
      } catch (err) {
        console.error('❌ Erreur polling job:', err)
        // Après 3 erreurs consécutives, arrêter le polling
        if (pollCount >= 3) {
          setError('Erreur lors de la vérification du statut. Veuillez réessayer.')
          setIsProcessing(false)
          setCurrentJobId(null)
        }
      }
    }

    // Premier appel immédiat
    pollJobStatus()

    const interval = setInterval(pollJobStatus, 2000)
    return () => clearInterval(interval)
  }, [currentJobId])

  const loadEmailConfigs = async () => {
    try {
      // Récupérer le workspace actif - ISOLATION STRICTE
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      if (!activeWorkspaceId) {
        setEmailConfigs([])
        return
      }

      // Utiliser l'ancien endpoint /api/connections qui existe déjà
      const response = await fetch('/api/connections')
      const result = await response.json()

      if (result.success && result.data) {
        // Adapter le format des anciennes connexions au nouveau format
        // ET FILTRER PAR WORKSPACE
        const adaptedConfigs = result.data
          .filter((conn: any) => conn.workspace_id === activeWorkspaceId)
          .map((conn: any) => ({
            id: conn.id,
            imap_email: conn.email,
            email_provider: conn.provider,
            is_active: conn.is_active,
            last_sync_at: conn.last_synced_at,
          }))
        setEmailConfigs(adaptedConfigs)
        if (adaptedConfigs.length > 0) {
          setSelectedConfig(adaptedConfigs[0].id)
        }
      }
    } catch (err) {
      console.error('Erreur chargement configs:', err)
    }
  }

  const handleExtract = async () => {
    if (!selectedConfig) {
      setError('Veuillez sélectionner une configuration email')
      return
    }

    if (!searchSince) {
      setError('Veuillez sélectionner une date de début')
      return
    }

    if (!searchUntil) {
      setError('Veuillez sélectionner une date de fin')
      return
    }

    try {
      setIsProcessing(true)
      setError(null)
      setLastResult(null)

      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

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

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'extraction')
      }

      if (result.success) {
        setLastResult(result.message)
        setCurrentJobId(result.jobId)
        setJobStatus({ status: 'processing' })
      } else {
        setError(result.error || 'Erreur lors de l\'extraction')
        setIsProcessing(false)
      }
    } catch (err) {
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
              <span>{emailConfigs.length} configuration(s)</span>
            </div>
          </div>

          <Card className="p-6">
            <div className="space-y-6">
              {/* Sélection de la configuration email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration email
                </label>
                {emailConfigs.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Aucune configuration. Veuillez d'abord configurer un compte email.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {emailConfigs.map((config) => (
                      <div
                        key={config.id}
                        onClick={() => setSelectedConfig(config.id)}
                        className={`flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer transition-all ${
                          selectedConfig === config.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded border border-border bg-white">
                            {config.email_provider === 'gmail' ? (
                              <GoogleLogo className="h-4 w-4" />
                            ) : (
                              <MicrosoftLogo className="h-4 w-4" />
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{config.imap_email}</p>
                        </div>
                        {selectedConfig === config.id && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
            {jobStatus && isProcessing && (
              <div className="mt-6">
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-blue-700 font-medium">Extraction en cours...</span>
                  </div>
                  {jobStatus.emailsFound !== undefined && (
                    <div className="text-sm text-blue-600">
                      <div>📧 Emails trouvés : {jobStatus.emailsFound || 0}</div>
                      <div className="mt-2 font-semibold">
                        💰 Factures extraites : {jobStatus.invoicesExtracted || 0}
                      </div>
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
