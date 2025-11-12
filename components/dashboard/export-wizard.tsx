"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
  Table2, 
  FileSpreadsheet,
  Download,
  Mail,
  Check,
  Loader2,
  X,
  Archive
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Invoice {
  id: string
  invoice_number: string | null
  vendor: string | null
  date: string | null
  amount: number | null
  currency: string | null
  payment_status: string | null
  category: string | null
}

interface ExportWizardProps {
  onClose: () => void
  onComplete: () => void
}

export function ExportWizard({ onClose, onComplete }: ExportWizardProps) {
  const [step, setStep] = useState(1)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Filtres
  const [dateFilter, setDateFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Format
  const [format, setFormat] = useState<"pdf" | "zip" | "csv">("pdf")
  
  // Options CSV
  const [csvFormat, setCsvFormat] = useState<"compact" | "detailed">("compact")
  
  // Destination
  const [destination, setDestination] = useState<"download" | "email">("download")
  const [email, setEmail] = useState("")
  const [sendCopyToAccountant, setSendCopyToAccountant] = useState(false)

  // Charger les factures au montage et quand les filtres changent
  useEffect(() => {
    console.log('🔍 [EXPORT] useEffect déclenché - dateFilter:', dateFilter, 'statusFilter:', statusFilter)
    loadInvoices()
  }, [dateFilter, statusFilter])

  // Charger aussi au montage initial
  useEffect(() => {
    console.log('🔍 [EXPORT] Montage initial du composant')
    loadInvoices()
  }, [])

  async function loadInvoices() {
    console.log('🔍 [EXPORT] loadInvoices() appelé')
    setLoading(true)
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ [EXPORT] Erreur authentification:', userError)
      setLoading(false)
      return
    }
    
    if (!user) {
      console.warn('⚠️ [EXPORT] Pas d\'utilisateur connecté')
      setLoading(false)
      return
    }

    console.log('🔍 [EXPORT] Utilisateur connecté:', user.id)

    // Récupérer le workspace actif
    const activeWorkspaceId = typeof window !== 'undefined' 
      ? localStorage.getItem('active_workspace_id') 
      : null

    console.log('🔍 [EXPORT] Chargement factures - Workspace ID:', activeWorkspaceId)

    // Déterminer le type de workspace (MÊME LOGIQUE QUE invoice-table-new.tsx)
    let isPersonalWorkspace = false
    if (activeWorkspaceId && activeWorkspaceId.trim() !== '') {
      try {
        const workspaceResponse = await fetch('/api/workspaces')
        if (workspaceResponse.ok) {
          const workspaceData = await workspaceResponse.json()
          const workspace = workspaceData.workspaces?.find((w: any) => w.id === activeWorkspaceId)
          if (workspace) {
            isPersonalWorkspace = workspace.type === 'personal'
          } else {
            // Workspace non trouvé, considérer comme personnel par défaut
            isPersonalWorkspace = true
          }
        } else {
          isPersonalWorkspace = true
        }
      } catch (error) {
        console.warn('⚠️ [EXPORT] Erreur lors de la vérification du type de workspace:', error)
        isPersonalWorkspace = true
      }
    } else {
      // Pas de workspace actif = workspace personnel
      isPersonalWorkspace = true
    }

    console.log('🔍 [EXPORT] isPersonalWorkspace:', isPersonalWorkspace)

    // 🔧 FIX : Charger TOUTES les factures de l'utilisateur, puis filtrer côté client (comme dans invoice-table-new.tsx)
    const { data: allInvoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) {
      console.error('❌ [EXPORT] Erreur chargement factures:', error)
      setInvoices([])
      setLoading(false)
      return
    }

    console.log('🔍 [EXPORT] Total factures récupérées:', allInvoices?.length || 0)

    // Filtrer les factures selon le type de workspace (MÊME LOGIQUE QUE invoice-table-new.tsx)
    let filteredInvoices = allInvoices || []
    
    if (isPersonalWorkspace) {
      // Pour un workspace personnel, charger les factures avec workspace_id = null ou 'personal'
      filteredInvoices = (allInvoices || []).filter((invoice: any) => 
        invoice.workspace_id === null || 
        invoice.workspace_id === 'personal' || 
        !invoice.workspace_id
      )
      console.log('🔍 [EXPORT] Filtre workspace personnel appliqué:', filteredInvoices.length, 'factures sur', allInvoices?.length || 0)
    } else if (activeWorkspaceId) {
      // Pour un workspace d'organisation, charger uniquement les factures de ce workspace
      filteredInvoices = (allInvoices || []).filter((invoice: any) => 
        invoice.workspace_id === activeWorkspaceId
      )
      console.log('🔍 [EXPORT] Filtre workspace organisation appliqué:', filteredInvoices.length, 'factures sur', allInvoices?.length || 0)
    } else {
      // Par défaut, charger les factures personnelles
      filteredInvoices = (allInvoices || []).filter((invoice: any) => 
        invoice.workspace_id === null || 
        invoice.workspace_id === 'personal' || 
        !invoice.workspace_id
      )
      console.log('🔍 [EXPORT] Filtre par défaut (personnel) appliqué:', filteredInvoices.length, 'factures sur', allInvoices?.length || 0)
    }

    // Filtre par date (après filtrage workspace)
    if (dateFilter === "this_month") {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      filteredInvoices = filteredInvoices.filter((inv: any) => {
        if (!inv.date) return false
        const invoiceDate = new Date(inv.date)
        return invoiceDate >= startOfMonth
      })
    } else if (dateFilter === "last_3_months") {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      filteredInvoices = filteredInvoices.filter((inv: any) => {
        if (!inv.date) return false
        const invoiceDate = new Date(inv.date)
        return invoiceDate >= threeMonthsAgo
      })
    }

    // Filtre par statut
    if (statusFilter !== "all") {
      filteredInvoices = filteredInvoices.filter((inv: any) => inv.payment_status === statusFilter)
    }

    console.log('🔍 [EXPORT] Factures après tous les filtres:', filteredInvoices.length)
    setInvoices(filteredInvoices)
    setLoading(false)
  }

  function toggleInvoice(id: string) {
    setSelectedInvoices(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  function toggleAll() {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(invoices.map(i => i.id))
    }
  }

  function getTotalAmount() {
    return invoices
      .filter(i => selectedInvoices.includes(i.id))
      .reduce((sum, i) => sum + (i.amount || 0), 0)
  }

  async function handleExport() {
    setExporting(true)
    
    try {
      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined'
        ? localStorage.getItem('active_workspace_id')
        : null
      
      // Pour ZIP, PDF et CSV, utiliser /api/exports
      const apiEndpoint = '/api/exports'
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceIds: selectedInvoices,
          format,
          options: {
            csvFormat,
          },
          destination,
          destinationEmail: email,
          workspaceId: activeWorkspaceId || null,
        }),
      })

      if (destination === 'download') {
        // Pour tous les formats (ZIP, PDF, CSV), l'API retourne une URL publique Supabase
        // On doit télécharger le fichier depuis cette URL
        const data = await response.json()
        console.log(`🔍 [EXPORT] Réponse API ${format.toUpperCase()}:`, { ok: data.ok, url: data.url, error: data.error, status: response.status })
        if (!response.ok || !data.ok) {
          console.error(`❌ [EXPORT] Erreur API ${format.toUpperCase()}:`, data.error || data)
          alert(data.error || `Erreur lors de la génération du fichier ${format.toUpperCase()}`)
          setExporting(false)
          return
        }
        if (data.ok && data.url) {
          try {
            // Télécharger le fichier depuis l'URL
            const fileResponse = await fetch(data.url)
            if (!fileResponse.ok) {
              throw new Error(`Erreur HTTP: ${fileResponse.status}`)
            }
            const blob = await fileResponse.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const extension = format === 'zip' ? 'zip' : format === 'pdf' ? 'pdf' : 'csv'
            const fileName = `export_factures_${new Date().toISOString().split('T')[0]}.${extension}`
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
          } catch (error) {
            console.error(`Erreur téléchargement ${format.toUpperCase()}:`, error)
            alert(`Erreur lors du téléchargement du fichier ${format.toUpperCase()}. Veuillez réessayer.`)
          }
        } else {
          console.error(`Erreur: pas d'URL retournée pour le ${format.toUpperCase()}`, data)
          alert(`Erreur: l'API n'a pas retourné d'URL pour le fichier ${format.toUpperCase()}`)
        }
      } else {
        // Destination email
        const data = await response.json()
        console.log('🔍 [EXPORT] Réponse API email:', data)
        if (!response.ok || (!data.ok && !data.success)) {
          console.error('❌ [EXPORT] Erreur API email:', data.error || data)
          alert(data.error || 'Erreur lors de l\'envoi de l\'email')
          setExporting(false)
          return
        }
        if (data.emailSent === false && data.emailError) {
          alert(`Email non envoyé: ${data.emailError}`)
        } else {
          console.log('✅ [EXPORT] Email envoyé avec succès')
        }
      }

      setExporting(false)
      setStep(8) // Étape de confirmation
    } catch (error) {
      console.error('Erreur export:', error)
      setExporting(false)
      alert('Erreur lors de l\'export')
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return renderStepSelection()
      case 2:
        return renderStepFormat()
      case 3:
        return renderStepOptions()
      case 4:
        return renderStepDestination()
      case 5:
        return renderStepSummary()
      case 8:
        return renderStepConfirmation()
      default:
        return null
    }
  }

  function renderStepSelection() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Sélectionnez vos factures</h2>
          <p className="text-muted-foreground">
            Choisissez les factures que vous souhaitez exporter
          </p>
        </div>

        {/* Filtres */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <Label>Période</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les dates</SelectItem>
                <SelectItem value="this_month">Ce mois</SelectItem>
                <SelectItem value="last_3_months">3 derniers mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="unpaid">Impayé</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Liste des factures */}
        <Card className="mb-6">
          <div className="p-4 border-b flex items-center gap-3">
            <Checkbox
              checked={selectedInvoices.length === invoices.length && invoices.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="font-semibold">Tout sélectionner ({invoices.length})</span>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Chargement...
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Aucune facture trouvée
              </div>
            ) : (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 border-b hover:bg-muted/50 flex items-center gap-4 cursor-pointer"
                  onClick={() => toggleInvoice(invoice.id)}
                >
                  <Checkbox
                    checked={selectedInvoices.includes(invoice.id)}
                    onCheckedChange={() => toggleInvoice(invoice.id)}
                  />
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <div className="font-medium">{invoice.invoice_number || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm">{invoice.vendor || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm">
                        {invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {invoice.amount?.toFixed(2)} {invoice.currency || 'EUR'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Résumé de sélection */}
        {selectedInvoices.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {selectedInvoices.length} facture{selectedInvoices.length > 1 ? 's' : ''} sélectionnée{selectedInvoices.length > 1 ? 's' : ''}
                </div>
                <div className="text-sm text-muted-foreground">
                  Montant total : {getTotalAmount().toFixed(2)} EUR
                </div>
              </div>
              <Button onClick={() => setStep(2)} className="bg-green-600 hover:bg-green-700">
                Suivant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderStepFormat() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Choisissez votre format</h2>
          <p className="text-muted-foreground">
            Sélectionnez le format d'export qui vous convient
          </p>
        </div>

        <RadioGroup value={format} onValueChange={(v: any) => setFormat(v)}>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* PDF */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${format === 'pdf' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setFormat('pdf')}
            >
              <RadioGroupItem value="pdf" id="pdf" className="sr-only" />
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="font-semibold mb-2">PDF</h3>
                <p className="text-sm text-muted-foreground">
                  Pour archiver ou imprimer
                </p>
              </div>
            </Card>

            {/* ZIP */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${format === 'zip' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setFormat('zip')}
            >
              <RadioGroupItem value="zip" id="zip" className="sr-only" />
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <Archive className="w-8 h-8" />
                </div>
                <h3 className="font-semibold mb-2">ZIP</h3>
                <p className="text-sm text-muted-foreground">
                  Fichiers originaux compressés
                </p>
              </div>
            </Card>

            {/* CSV */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${format === 'csv' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setFormat('csv')}
            >
              <RadioGroupItem value="csv" id="csv" className="sr-only" />
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="font-semibold mb-2">CSV</h3>
                <p className="text-sm text-muted-foreground">
                  Pour import dans autre logiciel
                </p>
              </div>
            </Card>
          </div>
        </RadioGroup>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button onClick={() => setStep(3)} className="bg-green-600 hover:bg-green-700">
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  function renderStepOptions() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Options d'export</h2>
          <p className="text-muted-foreground">
            Personnalisez votre export {format.toUpperCase()}
          </p>
        </div>

        {format === 'csv' ? (
          <Card className="p-6 mb-8">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-4">
                Choisissez le format de votre exportation CSV. Vous pouvez exporter les reçus sur une seule ligne ou détailler les lignes de commande.
              </p>
              <RadioGroup value={csvFormat} onValueChange={(v) => setCsvFormat(v as "compact" | "detailed")}>
                <div className="space-y-4">
                  {/* Format compact */}
                  <div className={`border rounded-lg p-4 cursor-pointer transition-all ${csvFormat === 'compact' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-300'}`} onClick={() => setCsvFormat('compact')}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="compact" id="compact" />
                        <label htmlFor="compact" className="font-semibold cursor-pointer">Une seule rangée par reçu</label>
                      </div>
                      <Badge className="bg-green-600">Recommandé</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Chaque reçu est exporté sur une seule ligne, les articles étant regroupés dans le champ « Résumé ». Idéal pour les logiciels de comptabilité et de reporting.
                    </p>
                    <div className="text-xs bg-white border rounded p-2 mb-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-1">NUMÉRO DE REÇU</th>
                            <th className="text-left p-1">MARCHAND</th>
                            <th className="text-left p-1">TOTAL</th>
                            <th className="text-left p-1">RÉSUMÉ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-1">REC001</td>
                            <td className="p-1">Starbucks</td>
                            <td className="p-1">18,70 $</td>
                            <td className="p-1">Café, Sandwich, Impôt</td>
                          </tr>
                          <tr>
                            <td className="p-1">REC002</td>
                            <td className="p-1">Amazon</td>
                            <td className="p-1">49,99 $</td>
                            <td className="p-1">Souris sans fil</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>✓ Format compact</div>
                      <div>✓ Compatible avec la plupart des logiciels comptables</div>
                      <div>✓ Analyse simplifiée des totaux des reçus</div>
                    </div>
                  </div>

                  {/* Format détaillé */}
                  <div className={`border rounded-lg p-4 cursor-pointer transition-all ${csvFormat === 'detailed' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-300'}`} onClick={() => setCsvFormat('detailed')}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="detailed" id="detailed" />
                        <label htmlFor="detailed" className="font-semibold cursor-pointer">Plusieurs lignes par reçu</label>
                      </div>
                      <Badge variant="outline">Détaillé</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Chaque poste de dépense est présenté sur une ligne distincte avec des informations détaillées. Idéal pour une analyse approfondie des dépenses et la création de rapports détaillés par article.
                    </p>
                    <div className="text-xs bg-white border rounded p-2 mb-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-1">IDENTIFIANT</th>
                            <th className="text-left p-1">MARCHAND</th>
                            <th className="text-left p-1">TOTAL</th>
                            <th className="text-left p-1">DESCRIPTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-1">REC001</td>
                            <td className="p-1">Starbucks</td>
                            <td className="p-1">18,70 $</td>
                            <td className="p-1">Café</td>
                          </tr>
                          <tr>
                            <td className="p-1">REC001</td>
                            <td className="p-1">Starbucks</td>
                            <td className="p-1">18,70 $</td>
                            <td className="p-1">Sandwich</td>
                          </tr>
                          <tr>
                            <td className="p-1">REC001</td>
                            <td className="p-1">Starbucks</td>
                            <td className="p-1">18,70 $</td>
                            <td className="p-1">Impôt</td>
                          </tr>
                          <tr>
                            <td className="p-1">REC002</td>
                            <td className="p-1">Amazon</td>
                            <td className="p-1">49,99 $</td>
                            <td className="p-1">Souris sans fil</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>✓ Détails de chaque article</div>
                      <div>✓ Quantité et prix unitaire</div>
                      <div>✓ Taxes par article</div>
                      <div>✓ Idéal pour l'analyse des stocks</div>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </Card>
        ) : null}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(2)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button onClick={() => setStep(4)} className="bg-green-600 hover:bg-green-700">
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  function renderStepDestination() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Où voulez-vous envoyer cet export ?</h2>
          <p className="text-muted-foreground">
            Choisissez la destination de votre fichier
          </p>
        </div>

        <RadioGroup value={destination} onValueChange={(v: any) => setDestination(v)}>
          <div className="space-y-4 mb-8">
            {/* Télécharger */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${destination === 'download' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setDestination('download')}
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600">
                  <Download className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Télécharger</h3>
                  <p className="text-sm text-muted-foreground">
                    Le fichier arrive dans vos téléchargements
                  </p>
                </div>
                <RadioGroupItem value="download" id="download" />
              </div>
            </Card>

            {/* Email */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${destination === 'email' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setDestination('email')}
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Envoyer par email</h3>
                  <p className="text-sm text-muted-foreground">
                    Recevez le fichier par email
                  </p>
                </div>
                <RadioGroupItem value="email" id="email" />
              </div>
              {destination === 'email' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="email-input">Adresse email</Label>
                    <Input
                      id="email-input"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accountant"
                      checked={sendCopyToAccountant}
                      onCheckedChange={(checked) => setSendCopyToAccountant(checked as boolean)}
                    />
                    <label htmlFor="accountant" className="text-sm">
                      Envoyer une copie à mon comptable
                    </label>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </RadioGroup>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(3)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button onClick={() => setStep(5)} className="bg-green-600 hover:bg-green-700">
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  function renderStepSummary() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Récapitulatif</h2>
          <p className="text-muted-foreground">
            Vérifiez les détails avant d'exporter
          </p>
        </div>

        <Card className="p-6 mb-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-muted-foreground">Factures sélectionnées</span>
              <span className="font-semibold">{selectedInvoices.length} facture{selectedInvoices.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-muted-foreground">Montant total</span>
              <span className="font-semibold">{getTotalAmount().toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-muted-foreground">Format</span>
              <Badge>{format.toUpperCase()}</Badge>
            </div>
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-muted-foreground">Options</span>
              <span className="text-sm">
                {format === 'pdf' 
                  ? 'Fichier original' 
                  : format === 'csv'
                  ? `Format ${csvFormat === 'compact' ? 'compact' : 'détaillé'}`
                  : format === 'zip'
                  ? 'Archive ZIP'
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Destination</span>
              <span className="font-semibold">
                {destination === 'download' && 'Téléchargement'}
                {destination === 'email' && `Email à ${email}`}
              </span>
            </div>
          </div>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(4)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button 
            onClick={handleExport} 
            className="bg-green-600 hover:bg-green-700"
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                Exporter maintenant
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  function renderStepConfirmation() {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
          <Check className="w-10 h-10" />
        </div>
        
        <h2 className="text-3xl font-bold mb-2">Export réussi !</h2>
        <p className="text-muted-foreground mb-8">
          {destination === 'download' && 'Votre fichier a été téléchargé'}
          {destination === 'email' && `Votre fichier a été envoyé à ${email}`}
        </p>

        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={onClose}>
            Retour au tableau de bord
          </Button>
          <Button onClick={onComplete} className="bg-green-600 hover:bg-green-700">
            Voir l'historique
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header avec fermeture */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Export de factures</h1>
            <p className="text-muted-foreground">Étape {step > 5 ? 5 : step} sur 5</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Barre de progression */}
        {step <= 5 && (
          <div className="mb-8">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Contenu de l'étape */}
        <Card className="p-8">
          {renderStep()}
        </Card>
      </div>
    </div>
  )
}

