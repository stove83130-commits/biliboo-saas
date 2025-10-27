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
  Cloud,
  Check,
  Loader2,
  X
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
  const [format, setFormat] = useState<"pdf" | "excel" | "csv">("pdf")
  
  // Options PDF
  const [pdfOptions, setPdfOptions] = useState({
    includePaymentTerms: true,
    includeNotes: false,
    template: "classic"
  })
  
  // Options Excel/CSV
  const [columns, setColumns] = useState([
    "invoice_number",
    "vendor",
    "date",
    "amount",
    "payment_status",
    "category"
  ])
  
  // Destination
  const [destination, setDestination] = useState<"download" | "email" | "cloud">("download")
  const [email, setEmail] = useState("")
  const [sendCopyToAccountant, setSendCopyToAccountant] = useState(false)

  useEffect(() => {
    loadInvoices()
  }, [dateFilter, statusFilter])

  async function loadInvoices() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Récupérer le workspace actif - ISOLATION STRICTE
    const activeWorkspaceId = typeof window !== 'undefined' 
      ? localStorage.getItem('active_workspace_id') 
      : null

    if (!activeWorkspaceId) return

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', activeWorkspaceId)
      .order('date', { ascending: false })

    // Filtre par date
    if (dateFilter === "this_month") {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      query = query.gte('date', startOfMonth.toISOString())
    } else if (dateFilter === "last_3_months") {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      query = query.gte('date', threeMonthsAgo.toISOString())
    }

    // Filtre par statut
    if (statusFilter !== "all") {
      query = query.eq('payment_status', statusFilter)
    }

    const { data } = await query
    setInvoices(data || [])
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
      const response = await fetch('/api/exports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceIds: selectedInvoices,
          format,
          options: {
            pdfOptions,
            columns,
          },
          destination,
          destinationEmail: email,
        }),
      })

      if (destination === 'download') {
        // Télécharger le fichier
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `export_factures_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'html' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const data = await response.json()
        console.log('Export réussi:', data)
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

            {/* Excel */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${format === 'excel' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setFormat('excel')}
            >
              <RadioGroupItem value="excel" id="excel" className="sr-only" />
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <Table2 className="w-8 h-8" />
                </div>
                <h3 className="font-semibold mb-2">Excel</h3>
                <p className="text-sm text-muted-foreground">
                  Pour analyser les données
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

        {format === 'pdf' ? (
          <Card className="p-6 mb-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="payment-terms"
                  checked={pdfOptions.includePaymentTerms}
                  onCheckedChange={(checked) => 
                    setPdfOptions(prev => ({ ...prev, includePaymentTerms: checked as boolean }))
                  }
                />
                <label htmlFor="payment-terms" className="text-sm font-medium">
                  Inclure les conditions de paiement
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notes"
                  checked={pdfOptions.includeNotes}
                  onCheckedChange={(checked) => 
                    setPdfOptions(prev => ({ ...prev, includeNotes: checked as boolean }))
                  }
                />
                <label htmlFor="notes" className="text-sm font-medium">
                  Inclure les notes internes
                </label>
              </div>
              
              <div className="pt-4">
                <Label>Modèle de présentation</Label>
                <RadioGroup value={pdfOptions.template} onValueChange={(v) => setPdfOptions(prev => ({ ...prev, template: v }))}>
                  <div className="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="classic" id="classic" />
                    <label htmlFor="classic">Classique</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="compact" id="compact" />
                    <label htmlFor="compact">Compact</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="detailed" id="detailed" />
                    <label htmlFor="detailed">Détaillé</label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 mb-8">
            <Label className="mb-3 block">Colonnes à inclure</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'invoice_number', label: 'Numéro de facture' },
                { id: 'vendor', label: 'Fournisseur' },
                { id: 'date', label: 'Date' },
                { id: 'amount', label: 'Montant' },
                { id: 'currency', label: 'Devise' },
                { id: 'payment_status', label: 'Statut de paiement' },
                { id: 'category', label: 'Catégorie' },
                { id: 'description', label: 'Description' },
              ].map((col) => (
                <div key={col.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={col.id}
                    checked={columns.includes(col.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setColumns(prev => [...prev, col.id])
                      } else {
                        setColumns(prev => prev.filter(c => c !== col.id))
                      }
                    }}
                  />
                  <label htmlFor={col.id} className="text-sm">
                    {col.label}
                  </label>
                </div>
              ))}
            </div>
          </Card>
        )}

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

            {/* Cloud */}
            <Card 
              className={`p-6 cursor-pointer transition-all ${destination === 'cloud' ? 'border-green-600 border-2 bg-green-50' : 'hover:border-gray-400'}`}
              onClick={() => setDestination('cloud')}
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-600">
                  <Cloud className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Sauvegarder dans le cloud</h3>
                  <p className="text-sm text-muted-foreground">
                    Google Drive / Dropbox (à configurer)
                  </p>
                </div>
                <RadioGroupItem value="cloud" id="cloud" />
              </div>
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
                  ? `Modèle ${pdfOptions.template}` 
                  : `${columns.length} colonnes`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Destination</span>
              <span className="font-semibold">
                {destination === 'download' && 'Téléchargement'}
                {destination === 'email' && `Email à ${email}`}
                {destination === 'cloud' && 'Cloud'}
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
          {destination === 'cloud' && 'Votre fichier a été sauvegardé dans le cloud'}
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

