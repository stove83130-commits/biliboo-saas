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
  }, [])

  // Fonction pour définir une période prédéfinie
  const setDatePreset = (preset: string) => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    switch (preset) {
      case 'current_month':
        setSearchSince(new Date(year, month, 1).toISOString().split('T')[0])
        setSearchUntil(today.toISOString().split('T')[0])
        break
      case 'last_month':
        setSearchSince(new Date(year, month - 1, 1).toISOString().split('T')[0])
        setSearchUntil(new Date(year, month, 0).toISOString().split('T')[0])
        break
      case 'july':
        setSearchSince(new Date(year, 6, 1).toISOString().split('T')[0]) // Juillet = mois 6
        setSearchUntil(new Date(year, 6, 31).toISOString().split('T')[0])
        break
      case 'august':
        setSearchSince(new Date(year, 7, 1).toISOString().split('T')[0])
        setSearchUntil(new Date(year, 7, 31).toISOString().split('T')[0])
        break
      case 'september':
        setSearchSince(new Date(year, 8, 1).toISOString().split('T')[0])
        setSearchUntil(new Date(year, 8, 30).toISOString().split('T')[0])
        break
      case 'october':
        setSearchSince(new Date(year, 9, 1).toISOString().split('T')[0])
        setSearchUntil(new Date(year, 9, 31).toISOString().split('T')[0])
        break
      case 'last_7_days':
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(today.getDate() - 7)
        setSearchSince(sevenDaysAgo.toISOString().split('T')[0])
        setSearchUntil(today.toISOString().split('T')[0])
        break
      case 'last_30_days':
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(today.getDate() - 30)
        setSearchSince(thirtyDaysAgo.toISOString().split('T')[0])
        setSearchUntil(today.toISOString().split('T')[0])
        break
      case 'last_90_days':
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(today.getDate() - 90)
        setSearchSince(ninetyDaysAgo.toISOString().split('T')[0])
        setSearchUntil(today.toISOString().split('T')[0])
        break
    }
  }

  // Polling du statut du job en cours
  useEffect(() => {
    if (!currentJobId) return

    const pollJobStatus = async () => {
      try {
        const response = await fetch(`/api/extraction/status?jobId=${currentJobId}`)
        const result = await response.json()

        if (result.success && result.job) {
          setJobStatus(result.job)

          if (result.job.status === 'completed') {
            setLastResult(`✅ ${result.job.invoicesExtracted} factures extraites !`)
            setIsProcessing(false)
            setCurrentJobId(null)
          } else if (result.job.status === 'failed') {
            setError(`Erreur : ${result.job.errorMessage}`)
            setIsProcessing(false)
            setCurrentJobId(null)
          }
        }
      } catch (err) {
        console.error('Erreur polling job:', err)
      }
    }

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

              {/* Presets de dates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Période prédéfinie
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('last_7_days')}
                    className="text-xs"
                  >
                    7 derniers jours
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('last_30_days')}
                    className="text-xs"
                  >
                    30 derniers jours
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('current_month')}
                    className="text-xs"
                  >
                    Mois en cours
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('last_month')}
                    className="text-xs"
                  >
                    Mois dernier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('july')}
                    className="text-xs bg-blue-50 hover:bg-blue-100"
                  >
                    🌞 Juillet 2025
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('august')}
                    className="text-xs"
                  >
                    Août 2025
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('september')}
                    className="text-xs"
                  >
                    Septembre 2025
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('october')}
                    className="text-xs"
                  >
                    Octobre 2025
                  </Button>
                </div>
              </div>

              {/* Sélection manuelle des dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={searchSince}
                    onChange={(e) => setSearchSince(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={searchUntil}
                    onChange={(e) => setSearchUntil(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
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
