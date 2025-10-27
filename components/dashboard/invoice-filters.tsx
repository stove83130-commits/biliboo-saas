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
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      if (!activeWorkspaceId) return

      // Charger les fournisseurs uniques UNIQUEMENT pour ce workspace
      const { data: invoices } = await supabase
        .from('invoices')
        .select('vendor')
        .eq('user_id', user.id)
        .eq('workspace_id', activeWorkspaceId)
        .not('vendor', 'is', null)
      
      if (invoices) {
        const uniqueVendors = [...new Set(invoices.map(inv => inv.vendor).filter(Boolean))] as string[]
        setVendors(uniqueVendors.sort())
      }

      // Charger les comptes email UNIQUEMENT pour ce workspace
      const { data: accounts } = await supabase
        .from('email_accounts')
        .select('id, email')
        .eq('user_id', user.id)
        .eq('workspace_id', activeWorkspaceId)
      
      if (accounts) {
        setEmailAccounts(accounts)
      }
    }

    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
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
              onValueChange={(value) => updateFilter('accountEmail', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Tous les comptes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                {emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.email}>
                    {account.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fournisseur */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Fournisseur</label>
            <Select 
              value={filters.vendor || 'all'} 
              onValueChange={(value) => updateFilter('vendor', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Tous les fournisseurs" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="all">Tous les fournisseurs</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor} value={vendor}>
                    {vendor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
