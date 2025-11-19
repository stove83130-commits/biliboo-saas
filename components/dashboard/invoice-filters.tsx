"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Filter, X, ChevronUp, Calendar as CalendarIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ModernCalendar } from "@/components/ui/modern-calendar"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

export interface FilterState {
  category?: string
  vendor?: string
  dateFrom?: Date
  dateTo?: Date
  paymentStatus?: string
  accountEmail?: string
}

interface InvoiceFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClearFilters: () => void
}

export function InvoiceFilters({ filters, onFiltersChange, onClearFilters }: InvoiceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [vendors, setVendors] = useState<string[]>([])
  const [emailAccounts, setEmailAccounts] = useState<{id: string, email: string}[]>([])
  const supabase = createClient()

  // Charger les fournisseurs et comptes email uniques - FILTRÉ PAR WORKSPACE
    const loadData = async () => {
    try {
      console.log('🔍 [FILTRES] Début du chargement des données...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('❌ [FILTRES] Erreur authentification:', userError)
        return
      }
      
      if (!user) {
        console.warn('⚠️ [FILTRES] Pas d\'utilisateur connecté')
        return
      }

      console.log('🔍 [FILTRES] Utilisateur connecté:', user.id)

      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      console.log('🔍 [FILTRES] Workspace ID actif:', activeWorkspaceId)

      // 🔧 FIX : Charger TOUTES les factures de l'utilisateur, puis filtrer côté client (comme dans invoice-table-new.tsx)
      const { data: allInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('vendor, account_email, workspace_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (invoicesError) {
        console.error('❌ [FILTRES] Erreur chargement factures:', invoicesError)
        setVendors([])
        setEmailAccounts([])
        return
      }

      console.log('🔍 [FILTRES] Total factures récupérées de la DB:', allInvoices?.length || 0)
      console.log('🔍 [FILTRES] Exemple de facture:', allInvoices?.[0])

      // Déterminer le type de workspace (comme dans invoice-table-new.tsx)
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
              isPersonalWorkspace = true
            }
          } else {
            isPersonalWorkspace = true
          }
        } catch (error) {
          console.warn('⚠️ [FILTRES] Erreur lors de la vérification du type de workspace:', error)
          isPersonalWorkspace = true
        }
      } else {
        isPersonalWorkspace = true
      }

      // Filtrer les factures selon le workspace (côté client) - MÊME LOGIQUE QUE invoice-table-new.tsx
      let filteredInvoices = allInvoices || []
      
      if (isPersonalWorkspace) {
        // Workspace personnel : workspace_id est null, 'personal', OU l'UUID du workspace personnel
        filteredInvoices = filteredInvoices.filter((inv: any) => 
          inv.workspace_id === null || 
          inv.workspace_id === 'personal' || 
          inv.workspace_id === activeWorkspaceId || // Accepter aussi l'UUID du workspace personnel
          !inv.workspace_id
        )
        console.log('🔍 [FILTRES] Filtrage workspace personnel:', filteredInvoices.length, 'factures')
      } else if (activeWorkspaceId) {
        // Workspace d'organisation : filtrer par workspace_id
        filteredInvoices = filteredInvoices.filter((inv: any) => inv.workspace_id === activeWorkspaceId)
        console.log('🔍 [FILTRES] Filtrage workspace organisation:', filteredInvoices.length, 'factures')
      } else {
        // Par défaut, workspace personnel
        filteredInvoices = filteredInvoices.filter((inv: any) => 
          inv.workspace_id === null || 
          inv.workspace_id === 'personal' || 
          !inv.workspace_id
        )
        console.log('🔍 [FILTRES] Filtrage workspace personnel (par défaut):', filteredInvoices.length, 'factures')
      }

      console.log('🔍 [FILTRES] Factures après filtrage workspace:', filteredInvoices.length)

      // Extraire les fournisseurs uniques (même si null, on les filtre après)
      const allVendors = filteredInvoices.map((inv: any) => inv.vendor).filter(Boolean)
      const uniqueVendors = [...new Set(allVendors)] as string[]
      const sortedVendors = uniqueVendors.sort()
      setVendors(sortedVendors)
      console.log('🔍 [FILTRES] Fournisseurs trouvés:', sortedVendors.length)
      if (sortedVendors.length > 0) {
        console.log('🔍 [FILTRES] Exemples de fournisseurs:', sortedVendors.slice(0, 5))
      }

      // Extraire les comptes email uniques depuis account_email des factures
      const allEmails = filteredInvoices.map((inv: any) => inv.account_email).filter(Boolean)
      const uniqueEmails = [...new Set(allEmails)] as string[]
      const emailAccountsList = uniqueEmails.map(email => ({ id: email, email }))
      setEmailAccounts(emailAccountsList)
      console.log('🔍 [FILTRES] Comptes email trouvés:', emailAccountsList.length)
      if (emailAccountsList.length > 0) {
        console.log('🔍 [FILTRES] Exemples de comptes email:', emailAccountsList.slice(0, 5).map(a => a.email))
      }
      
      if (sortedVendors.length === 0 && emailAccountsList.length === 0) {
        console.warn('⚠️ [FILTRES] Aucun fournisseur ni compte email trouvé!')
        console.log('🔍 [FILTRES] Factures filtrées:', filteredInvoices.slice(0, 3))
      }
    } catch (error) {
      console.error('❌ [FILTRES] Erreur lors du chargement des données:', error)
      setVendors([])
      setEmailAccounts([])
      }
    }

  useEffect(() => {
    // Charger les données quand le popover s'ouvre
    if (isOpen) {
      console.log('🔍 [FILTRES] Popover ouvert, chargement des données...')
      loadData()
    }
    
    // Écouter les changements de workspace
    const handleWorkspaceChange = () => {
      console.log('🔍 [FILTRES] Workspace changé, rechargement des données...')
      loadData() // Recharger même si le popover n'est pas ouvert
    }
    
    // 🔧 FIX : Écouter les mises à jour de factures pour recharger les filtres
    const handleInvoicesUpdate = () => {
      console.log('🔍 [FILTRES] Factures mises à jour, rechargement des données...')
      loadData()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('workspace:changed', handleWorkspaceChange)
      window.addEventListener('invoices:updated', handleInvoicesUpdate)
      return () => {
        window.removeEventListener('workspace:changed', handleWorkspaceChange)
        window.removeEventListener('invoices:updated', handleInvoicesUpdate)
      }
    }
  }, [isOpen])
  
  // 🔧 FIX : Charger les données au montage du composant pour avoir les données prêtes
  useEffect(() => {
    console.log('🔍 [FILTRES] Composant monté, chargement initial des données...')
    loadData()
  }, [])

  const updateFilter = (key: keyof FilterState, value: any) => {
    console.log('🔍 [FILTRES] updateFilter appelé:', key, '=', value)
    const newFilters = { ...filters, [key]: value }
    console.log('🔍 [FILTRES] Nouveaux filtres:', newFilters)
    onFiltersChange(newFilters)
  }

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== null && value !== ''
  )

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined && v !== null && v !== '').length

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
          <Filter className="h-3.5 w-3.5" />
          Filtres
          {hasActiveFilters && (
            <span className="ml-1 bg-green-600 text-white rounded-full px-1.5 py-0.5 text-xs font-medium">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between bg-gray-50">
          <h3 className="font-semibold text-sm">Filtrer les factures</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0 hover:bg-gray-200"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {/* Compteur de filtres */}
          {hasActiveFilters ? (
            <div className="text-xs text-gray-600 pb-1">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} appliqué{activeFiltersCount > 1 ? 's' : ''}
            </div>
          ) : (
            <div className="text-xs text-gray-500 pb-1">
              Aucun filtre appliqué
            </div>
          )}

          {/* Période */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Période</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-9 justify-start text-left font-normal text-sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom && filters.dateTo ? (
                    <span>
                      {format(filters.dateFrom, "dd MMM", { locale: fr })} - {format(filters.dateTo, "dd MMM yyyy", { locale: fr })}
                    </span>
                  ) : filters.dateFrom ? (
                    <span>Depuis {format(filters.dateFrom, "dd MMM yyyy", { locale: fr })}</span>
                  ) : (
                    <span className="text-gray-500">Sélectionner une période</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <ModernCalendar
                  mode="range"
                  selectedRange={{ from: filters.dateFrom, to: filters.dateTo }}
                  onRangeSelect={(range) => {
                    updateFilter('dateFrom', range.from)
                    updateFilter('dateTo', range.to)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Catégorie comptable</label>
            <Select 
              value={filters.category || 'all'} 
              onValueChange={(value) => updateFilter('category', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Toutes les catégories</SelectItem>
                <SelectItem value="Salaires et charges sociales">Salaires et charges sociales</SelectItem>
                <SelectItem value="Loyer et charges locales">Loyer et charges locales</SelectItem>
                <SelectItem value="Matières premières">Matières premières</SelectItem>
                <SelectItem value="Services externes (comptable, avocat, consultant)">Services externes</SelectItem>
                <SelectItem value="Matériel informatique et logiciels">Matériel informatique et logiciels</SelectItem>
                <SelectItem value="Fournitures de bureau">Fournitures de bureau</SelectItem>
                <SelectItem value="Télécommunications (internet, téléphone)">Télécommunications</SelectItem>
                <SelectItem value="Électricité, gaz, eau">Électricité, gaz, eau</SelectItem>
                <SelectItem value="Assurances professionnelles">Assurances professionnelles</SelectItem>
                <SelectItem value="Transport et déplacements">Transport et déplacements</SelectItem>
                <SelectItem value="Publicité et marketing">Publicité et marketing</SelectItem>
                <SelectItem value="Frais bancaires et financiers">Frais bancaires</SelectItem>
                <SelectItem value="Entretien et réparations">Entretien et réparations</SelectItem>
                <SelectItem value="Formation professionnelle">Formation professionnelle</SelectItem>
                <SelectItem value="Impôts et taxes">Impôts et taxes</SelectItem>
                <SelectItem value="Repas et réceptions">Repas et réceptions</SelectItem>
                <SelectItem value="Abonnements professionnels">Abonnements professionnels</SelectItem>
                <SelectItem value="Charges exceptionnelles">Charges exceptionnelles</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Statut de paiement */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Statut de paiement</label>
            <Select 
              value={filters.paymentStatus || 'all'} 
              onValueChange={(value) => updateFilter('paymentStatus', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="unpaid">Impayé</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="overdue">En retard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Compte email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Compte email</label>
            <Select 
              value={filters.accountEmail || 'all'} 
              onValueChange={(value) => {
                console.log('🔍 [FILTRES] Compte email sélectionné:', value)
                updateFilter('accountEmail', value === 'all' ? undefined : value)
              }}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Tous les comptes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                {emailAccounts.length > 0 ? (
                  emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.email}>
                    {account.email}
                  </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-data" disabled>Aucun compte disponible</SelectItem>
                )}
              </SelectContent>
            </Select>
            {emailAccounts.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Chargement des comptes...</p>
            )}
          </div>

          {/* Fournisseur */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Fournisseur</label>
            <Select 
              value={filters.vendor || 'all'} 
              onValueChange={(value) => {
                console.log('🔍 [FILTRES] Fournisseur sélectionné:', value)
                updateFilter('vendor', value === 'all' ? undefined : value)
              }}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Tous les fournisseurs" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="all">Tous les fournisseurs</SelectItem>
                {vendors.length > 0 ? (
                  vendors.map((vendor) => (
                  <SelectItem key={vendor} value={vendor}>
                    {vendor}
                  </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-data" disabled>Aucun fournisseur disponible</SelectItem>
                )}
              </SelectContent>
            </Select>
            {vendors.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Chargement des fournisseurs...</p>
            )}
          </div>

          {/* Bouton effacer */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                onClearFilters()
                setIsOpen(false)
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <X className="h-4 w-4 mr-2" />
              Effacer tous les filtres
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
