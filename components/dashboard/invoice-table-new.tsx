"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, RefreshCw, Building2, ChevronRight, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { FilterState } from "./invoice-filters"
// Pas d'extraction de logo - économie de coûts

interface Invoice {
  id: string
  user_id: string
  connection_id: string | null
  email_id: string | null
  amount: number | null
  currency: string | null
  vendor: string | null
  vendor_email?: string | null
  vendor_website?: string | null
  date: string | null
  invoice_number: string | null
  category: string | null
  description: string | null
  payment_method: string | null
  payment_status: string | null
  source: string | null
  created_at: string
  updated_at: string | null
  // Anciennes colonnes pour compatibilité
  email_subject?: string
  email_from?: string
  email_date?: string
  file_name?: string
  status?: string
  supplier_name?: string | null
  brand_logo_url?: string | null
  invoice_date?: string | null
  account_email?: string | null
  email_account_id?: string | null
  total_ht?: number | string | null
  total_ttc?: number | string | null
  tax_amount?: number | string | null
  extracted_data?: any
  isDuplicate?: boolean
}

// Configuration des statuts de PAIEMENT (pas de traitement)
const paymentStatusConfig = {
  paid: { label: "Payé", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  unpaid: { label: "Impayé", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  pending: { label: "En attente", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  overdue: { label: "En retard", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
}

export function InvoiceTable({ 
  searchQuery = "", 
  filters = {},
  selectedInvoices = [],
  onSelectedInvoicesChange,
  onDeleteFunctionChange
}: { 
  searchQuery?: string
  filters?: FilterState
  selectedInvoices?: string[]
  onSelectedInvoicesChange?: (invoices: string[]) => void
  onDeleteFunctionChange?: (fn: () => Promise<void>) => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const fetchInvoices = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('❌ Erreur authentification:', authError)
        setInvoices([])
        setLoading(false)
        return
      }

      // Scope par espace de travail
      const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
      
      // Déterminer le type de workspace
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
          console.warn('⚠️ Erreur lors de la vérification du type de workspace:', error)
          isPersonalWorkspace = true
        }
      } else {
        // Pas de workspace actif = workspace personnel
        isPersonalWorkspace = true
      }

      // STRATÉGIE: Charger TOUTES les factures de l'utilisateur, puis filtrer côté client
      // Cela évite les problèmes de syntaxe Supabase avec .or() et garantit la récupération des factures
      const { data: allInvoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      console.log('🔍 [DEBUG] Récupération factures - activeWorkspaceId:', activeWorkspaceId)
      console.log('🔍 [DEBUG] isPersonalWorkspace:', isPersonalWorkspace)
      console.log('🔍 [DEBUG] Total factures récupérées:', allInvoices?.length || 0)
      
      // Filtrer les factures selon le type de workspace (côté client)
      let data = allInvoices || []
      
      if (isPersonalWorkspace) {
        // Pour un workspace personnel, charger les factures avec workspace_id = null, 'personal', OU l'UUID du workspace personnel
        // (car certaines factures peuvent avoir été créées avec l'UUID du workspace personnel au lieu de null)
        data = (allInvoices || []).filter((invoice: any) => 
          invoice.workspace_id === null || 
          invoice.workspace_id === 'personal' || 
          invoice.workspace_id === activeWorkspaceId || // Accepter aussi l'UUID du workspace personnel
          !invoice.workspace_id
        )
        console.log('🔍 [DEBUG] Filtre workspace personnel appliqué:', data.length, 'factures sur', allInvoices?.length || 0)
      } else if (activeWorkspaceId) {
        // Pour un workspace d'organisation, charger uniquement les factures de ce workspace
        data = (allInvoices || []).filter((invoice: any) => 
          invoice.workspace_id === activeWorkspaceId
        )
        console.log('🔍 [DEBUG] Filtre workspace organisation appliqué:', data.length, 'factures sur', allInvoices?.length || 0)
      } else {
        // Par défaut, charger les factures personnelles
        data = (allInvoices || []).filter((invoice: any) => 
          invoice.workspace_id === null || 
          invoice.workspace_id === 'personal' || 
          !invoice.workspace_id
        )
        console.log('🔍 [DEBUG] Filtre par défaut (personnel) appliqué:', data.length, 'factures sur', allInvoices?.length || 0)
      }

      if (error) {
        console.error('❌ Erreur récupération factures:', error)
        setInvoices([])
        setLoading(false)
        return
      }

      console.log('🔍 [DEBUG] Factures récupérées:', data?.length || 0)
      console.log('🔍 [DEBUG] Première facture:', data?.[0])
      console.log('🔍 [DEBUG] Toutes les factures:', data)
      console.log('🔍 [DEBUG] User ID:', user.id)
      console.log('🔍 [DEBUG] Query executed successfully')
      
      // Récupère les comptes email pour mapper l'email du compte
      let accQuery = supabase
        .from('email_accounts')
        .select('id, email')
        .eq('user_id', user.id)

      const { data: accounts, error: accountsError } = await accQuery

      if (accountsError) {
        console.error('❌ Erreur récupération comptes:', accountsError)
        // Continuer sans les comptes email
      }

      const idToEmail = new Map<string, string>()
      ;(accounts || []).forEach((acc: any) => {
        if (acc?.id && acc?.email) idToEmail.set(acc.id, acc.email)
      })

      const normalizedRaw = (data || []).map((row: any) => ({
        ...row,
        connection_email: idToEmail.get(row.connection_id) || null,
      }))

      // Détection des doublons
      const keyCounts = new Map<string, number>()
      const buildKey = (row: any) => {
        const supplier = (row.vendor || row?.extracted_data?.vendor || '').toString().trim().toLowerCase()
        const invNo = (row.invoice_number || row?.extracted_data?.invoice_number || '').toString().trim().toLowerCase()
        if (supplier && invNo) return `SUPINV|${supplier}|${invNo}`
        const emailId = (row.email_id || '').toString()
        const fileName = (row.original_file_name || '').toString().trim().toLowerCase()
        if (emailId && fileName) return `EMAILFILE|${emailId}|${fileName}`
        // fallback sur date+montant arrondis (moins fiable)
        const date = (row.date || '').toString().slice(0,10)
        const amt = (row.amount || row?.extracted_data?.amount || '').toString()
        return `FALLBACK|${supplier}|${date}|${amt}`
      }
      normalizedRaw.forEach(r => {
        const k = buildKey(r)
        keyCounts.set(k, (keyCounts.get(k) || 0) + 1)
      })
      // Marquer uniquement les occurrences après la première comme doublons
      const seenIndex = new Map<string, number>()
      const normalized = normalizedRaw.map(r => {
        const k = buildKey(r)
        const idx = seenIndex.get(k) ?? 0
        seenIndex.set(k, idx + 1)
        // Première occurrence: idx === 0 → pas doublon; suivantes: doublon
        const isDup = (keyCounts.get(k) || 0) > 1 && idx >= 1
        return { ...r, isDuplicate: isDup }
      })
      setInvoices(normalized as any)
      
      // 🔧 FIX : Notifier les filtres que les factures ont été mises à jour
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('invoices:updated'))
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (invoiceId: string, e: React.MouseEvent) => {
    // Ne pas naviguer si on clique sur la checkbox
    const target = e.target as HTMLElement
    if (target.closest('button[role="checkbox"]')) {
      return
    }
    
    // Vérifier que l'ID est un UUID valide
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(invoiceId)) {
      console.error('❌ ID de facture invalide:', invoiceId);
      alert(`Erreur: ID de facture invalide (${invoiceId}). Cette facture doit être supprimée de la base de données.`);
      return;
    }
    
    router.push(`/dashboard/invoices/${invoiceId}`)
  }

  const toggleSelectAll = () => {
    console.log('🔍 toggleSelectAll appelé - selectedInvoices:', selectedInvoices.length, 'sortedInvoices:', sortedInvoices.length)
    if (selectedInvoices.length === sortedInvoices.length) {
      onSelectedInvoicesChange?.([])
    } else {
      onSelectedInvoicesChange?.(sortedInvoices.map(inv => inv.id))
    }
  }

  const toggleSelectInvoice = (invoiceId: string) => {
    const newSelection = selectedInvoices.includes(invoiceId)
      ? selectedInvoices.filter(id => id !== invoiceId)
      : [...selectedInvoices, invoiceId]
    onSelectedInvoicesChange?.(newSelection)
  }

  const handleDeleteSelected = useCallback(async () => {
    console.log('🚨 handleDeleteSelected appelé - selectedInvoices:', selectedInvoices.length)
    if (selectedInvoices.length === 0) return

    // Suppression sans popup; la décision de supprimer est prise depuis le menu Actions
    setDeleting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      // Récupérer les file_urls des factures à supprimer
      const { data: invoicesToDelete } = await supabase
        .from('invoices')
        .select('file_url')
        .in('id', selectedInvoices)
        .eq('user_id', user.id)

      // Supprimer les fichiers du storage
      if (invoicesToDelete && invoicesToDelete.length > 0) {
        const filePaths = invoicesToDelete
          .map(inv => inv.file_url)
          .filter(Boolean) as string[]
        
        if (filePaths.length > 0) {
          await supabase.storage
            .from('invoices')
            .remove(filePaths)
        }
      }

      // Supprimer les factures de la base de données
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', selectedInvoices)
        .eq('user_id', user.id)

      if (error) throw error

      onSelectedInvoicesChange?.([])
      fetchInvoices()
      
    } catch (error) {
      console.error('Error deleting invoices:', error)
    } finally {
      setDeleting(false)
    }
  }, [selectedInvoices, onSelectedInvoicesChange, supabase])

  const pickNumeric = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,\s]/g, '.'))
    return Number.isFinite(n) ? n : null
  }

  const computeAmountDisplay = (inv: Invoice): string => {
    const candidates: Array<number | null> = [
      pickNumeric(inv.amount),
      pickNumeric(inv.total_ttc),
      pickNumeric(inv?.extracted_data?.amounts?.total),
      pickNumeric(inv?.extracted_data?.total_ttc),
      pickNumeric(inv?.extracted_data?.amount),
    ]
    const found = candidates.find((v) => v !== null)
    if (found === null || found === undefined) return ''
    const currency = inv.currency || inv?.extracted_data?.amounts?.currency || inv?.extracted_data?.currency || '€'
    return `${found.toFixed(2)} ${currency}`
  }

  const getVendorName = (inv: Invoice): string => {
    return inv.vendor || inv.supplier_name || inv?.extracted_data?.supplier?.name || 'N/A'
  }

  const getInvoiceDate = (inv: Invoice): string => {
    return inv.date || inv.invoice_date || inv?.extracted_data?.invoice_date || inv?.extracted_data?.date || 'N/A'
  }

  const getInvoiceNumber = (inv: Invoice): string => {
    return inv.invoice_number || inv?.extracted_data?.invoice_number || inv?.extracted_data?.number || 'N/A'
  }

  // Fonction de filtrage des factures basée sur la recherche et les filtres avancés
  const filterInvoices = (invoices: Invoice[], query: string, filters: FilterState): Invoice[] => {
    let filtered = invoices

    // Filtrage par recherche textuelle
    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim()
      filtered = filtered.filter(invoice => {
        // Recherche dans le nom du fournisseur (nouvelles colonnes)
        if (getVendorName(invoice).toLowerCase().includes(searchTerm)) return true
        
        // Recherche dans le numéro de facture (nouvelles colonnes)
        if (getInvoiceNumber(invoice).toLowerCase().includes(searchTerm)) return true
        
        // Recherche dans la catégorie
        if (invoice.category?.toLowerCase().includes(searchTerm)) return true
        
        // Recherche dans la description
        if (invoice.description?.toLowerCase().includes(searchTerm)) return true
        
        // Recherche dans le montant (format numérique)
        const amount = computeAmountDisplay(invoice)
        if (amount.toLowerCase().includes(searchTerm)) return true
        
        // Recherche dans les anciennes colonnes pour compatibilité
        if (invoice.supplier_name?.toLowerCase().includes(searchTerm)) return true
        if (invoice.file_name?.toLowerCase().includes(searchTerm)) return true
        if (invoice.account_email?.toLowerCase().includes(searchTerm)) return true
        
        // Recherche dans les données extraites (fournisseur, montant, etc.)
        if (invoice.extracted_data) {
          const extracted = invoice.extracted_data
          if (extracted.supplier?.name?.toLowerCase().includes(searchTerm)) return true
          if (extracted.invoice_number?.toLowerCase().includes(searchTerm)) return true
          if (extracted.amounts?.total?.toString().includes(searchTerm)) return true
          if (extracted.total_ttc?.toString().includes(searchTerm)) return true
          if (extracted.amount?.toString().includes(searchTerm)) return true
        }
        
        // Recherche dans l'objet de l'email
        if (invoice.email_subject?.toLowerCase().includes(searchTerm)) return true
        
        return false
      })
    }

    // Filtrage par date de facture
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(invoice => {
        // Utiliser la colonne 'date' (nouvelle structure) ou 'invoice_date' (ancienne)
        const invoiceDate = invoice.date ? new Date(invoice.date) : 
                           invoice.invoice_date ? new Date(invoice.invoice_date) : null
        if (!invoiceDate || isNaN(invoiceDate.getTime())) return false

        // 🔧 FIX : Comparer uniquement les dates (sans heures) pour éviter les problèmes de timezone
        const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate())
        
        if (filters.dateFrom) {
          const dateFromOnly = new Date(filters.dateFrom.getFullYear(), filters.dateFrom.getMonth(), filters.dateFrom.getDate())
          if (invoiceDateOnly < dateFromOnly) return false
        }
        
        if (filters.dateTo) {
          const dateToOnly = new Date(filters.dateTo.getFullYear(), filters.dateTo.getMonth(), filters.dateTo.getDate())
          if (invoiceDateOnly > dateToOnly) return false
        }
        
        return true
      })
    }

    // Filtrage par catégorie
    if (filters.category) {
      filtered = filtered.filter(invoice => 
        invoice.category === filters.category
      )
    }

    // Filtrage par statut de paiement
    if (filters.paymentStatus) {
      filtered = filtered.filter(invoice => 
        invoice.payment_status === filters.paymentStatus
      )
    }

    // Filtrage par compte email
    if (filters.accountEmail) {
      console.log('🔍 [FILTRES] Filtrage par compte email:', filters.accountEmail)
      filtered = filtered.filter(invoice => {
        // 🔧 FIX : Comparaison insensible à la casse et gestion des valeurs null/undefined
        const invoiceEmail = (invoice.account_email || '').toString().toLowerCase().trim()
        const filterEmail = (filters.accountEmail || '').toString().toLowerCase().trim()
        const matches = invoiceEmail === filterEmail && invoiceEmail !== ''
        if (!matches) {
          console.log('🔍 [FILTRES] Email ne correspond pas:', invoiceEmail, 'vs', filterEmail)
        }
        return matches
      })
      console.log('🔍 [FILTRES] Factures après filtrage email:', filtered.length)
    }

    // Filtrage par fournisseur
    if (filters.vendor) {
      console.log('🔍 [FILTRES] Filtrage par fournisseur:', filters.vendor)
      filtered = filtered.filter(invoice => {
        const vendorName = getVendorName(invoice)
        const matches = vendorName === filters.vendor || 
        invoice.vendor === filters.vendor ||
        invoice.supplier_name === filters.vendor ||
        invoice.extracted_data?.supplier?.name === filters.vendor
        if (!matches) {
          console.log('🔍 [FILTRES] Fournisseur ne correspond pas:', vendorName, invoice.vendor, 'vs', filters.vendor)
        }
        return matches
      })
      console.log('🔍 [FILTRES] Factures après filtrage fournisseur:', filtered.length)
    }

    return filtered
  }

  // Fonction de tri
  const sortInvoices = (invoices: Invoice[], column: string, direction: 'asc' | 'desc'): Invoice[] => {
    const sorted = [...invoices].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (column) {
        case 'vendor':
          aValue = getVendorName(a).toLowerCase()
          bValue = getVendorName(b).toLowerCase()
          break
        case 'source':
          aValue = (a.account_email || '').toLowerCase()
          bValue = (b.account_email || '').toLowerCase()
          break
        case 'date':
          aValue = getInvoiceDate(a) !== 'N/A' ? new Date(getInvoiceDate(a)).getTime() : 0
          bValue = getInvoiceDate(b) !== 'N/A' ? new Date(getInvoiceDate(b)).getTime() : 0
          break
        case 'amount':
          aValue = pickNumeric(a.amount) || pickNumeric(a.total_ttc) || pickNumeric(a?.extracted_data?.amount) || 0
          bValue = pickNumeric(b.amount) || pickNumeric(b.total_ttc) || pickNumeric(b?.extracted_data?.amount) || 0
          break
        case 'category':
          aValue = (a.category || '').toLowerCase()
          bValue = (b.category || '').toLowerCase()
          break
        case 'status':
          aValue = (a.payment_status || '').toLowerCase()
          bValue = (b.payment_status || '').toLowerCase()
          break
        default:
          return 0
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }

  // Gestionnaire de clic sur les en-têtes de colonnes
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Si on clique sur la même colonne, inverser l'ordre
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Nouvelle colonne, tri croissant par défaut
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Factures filtrées
  const filteredInvoices = filterInvoices(invoices, searchQuery, filters)
  
  // 🔧 DEBUG : Log pour vérifier le filtrage
  useEffect(() => {
    if (Object.keys(filters).some(key => filters[key as keyof FilterState] !== undefined && filters[key as keyof FilterState] !== null && filters[key as keyof FilterState] !== '')) {
      console.log('🔍 [FILTRES] Filtres actifs:', JSON.stringify(filters, null, 2))
      console.log('🔍 [FILTRES] Factures avant filtrage:', invoices.length)
      console.log('🔍 [FILTRES] Factures après filtrage:', filteredInvoices.length)
      if (filteredInvoices.length === 0 && invoices.length > 0) {
        console.warn('⚠️ [FILTRES] Aucune facture ne correspond aux filtres!')
        console.log('🔍 [FILTRES] Exemple de facture:', invoices[0])
      }
    }
  }, [filters, invoices.length, filteredInvoices.length])
  
  // Factures triées
  const sortedInvoices = sortColumn 
    ? sortInvoices(filteredInvoices, sortColumn, sortDirection)
    : filteredInvoices

  useEffect(() => {
    fetchInvoices()
    // rafraîchir en temps réel quand l'espace change
    const handler = () => fetchInvoices()
    if (typeof window !== 'undefined') window.addEventListener('workspace:changed', handler as any)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('workspace:changed', handler as any) }
  }, [])

  // Exposer la fonction de suppression au composant parent
  useEffect(() => {
    if (onDeleteFunctionChange) {
      // Expose UNIQUEMENT la référence, ne pas exécuter ici pour éviter les boucles
      onDeleteFunctionChange(handleDeleteSelected)
    }
  }, [onDeleteFunctionChange, handleDeleteSelected])

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    )
  }

  if (invoices.length === 0) {
    return (
      <Card className="border-border bg-card">
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-2">
            Aucune facture trouvée
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            Connectez vos comptes email et lancez une extraction pour voir vos factures ici
          </p>
          <Button onClick={() => window.location.href = '/dashboard/extraction'}>
            Aller à l'extraction
          </Button>
        </div>
      </Card>
    )
  }

  // Si on a des factures mais aucune ne correspond à la recherche/filtres
  if (invoices.length > 0 && sortedInvoices.length === 0) {
    const hasFilters = Object.keys(filters).some(key => filters[key as keyof FilterState] !== undefined && filters[key as keyof FilterState] !== null && filters[key as keyof FilterState] !== '')
    return (
      <Card className="border-border bg-card">
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-2">
            Aucune facture trouvée
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            {hasFilters 
              ? "Aucune facture ne correspond aux filtres appliqués. Essayez de modifier ou d'effacer les filtres."
              : searchQuery 
                ? `Aucune facture ne correspond à votre recherche "${searchQuery}"`
                : "Aucune facture ne correspond aux critères de recherche"}
          </p>
          <Button variant="outline" onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload()
            }
          }}>
            {hasFilters ? "Effacer les filtres" : "Effacer la recherche"}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            {sortedInvoices.length} facture{sortedInvoices.length > 1 ? 's' : ''} trouvée{sortedInvoices.length > 1 ? 's' : ''}
            {searchQuery && (
              <span className="text-muted-foreground font-normal">
                {" "}sur {invoices.length} au total
              </span>
            )}
          </h2>
          {selectedInvoices.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedInvoices.length} sélectionnée{selectedInvoices.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchInvoices}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedInvoices.length === sortedInvoices.length && sortedInvoices.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <TableHead 
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('vendor')}
              >
                <div className="flex items-center gap-1">
                  Marque
                  {sortColumn === 'vendor' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center gap-1">
                  Source
                  {sortColumn === 'source' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  {sortColumn === 'date' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center gap-1">
                  Montant
                  {sortColumn === 'amount' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-1">
                  Catégorie
                  {sortColumn === 'category' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Statut
                  {sortColumn === 'status' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvoices.map((invoice) => (
              <TableRow 
                key={invoice.id} 
                className={`border-border cursor-pointer transition-colors ${invoice.isDuplicate ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-muted/50'}`}
                onClick={(e) => handleRowClick(invoice.id, e)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedInvoices.includes(invoice.id)}
                    onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                    aria-label={`Sélectionner ${invoice.file_name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {/* Logo retiré - pas d'extraction de logo */}
                    <span className="text-sm font-medium text-foreground">
                      {getVendorName(invoice)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {invoice.account_email || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {getInvoiceDate(invoice) !== 'N/A' ? new Date(getInvoiceDate(invoice)).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }) : '-'}
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {computeAmountDisplay(invoice)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span>{invoice.category || '-'}</span>
                    {invoice.isDuplicate && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/20">Doublon</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={paymentStatusConfig[invoice.payment_status as keyof typeof paymentStatusConfig]?.className || paymentStatusConfig.unpaid.className}
                  >
                    {paymentStatusConfig[invoice.payment_status as keyof typeof paymentStatusConfig]?.label || 'Impayé'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
