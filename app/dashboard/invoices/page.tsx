"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Download } from "lucide-react"
import { InvoiceTable } from "@/components/dashboard/invoice-table-new"
import { InvoiceFilters, FilterState } from "@/components/dashboard/invoice-filters"
import { InvoiceActions } from "@/components/dashboard/invoice-actions"
import { useState, useEffect } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AuthGuard } from "@/components/auth-guard"
import { createClient } from "@/lib/supabase/client"

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [deleteFunction, setDeleteFunction] = useState<(() => Promise<void>) | null>(null)
  const supabase = createClient()

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  const handleDeleteSelected = async () => {
    if (typeof deleteFunction === 'function') {
      await deleteFunction()
    }
  }

  // ------- EXPORTS -------
  const fetchSelectedInvoices = async () => {
    if (selectedInvoices.length === 0) return []
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .in('id', selectedInvoices)
    return data || []
  }

  const exportJSON = async () => {
    const data = await fetchSelectedInvoices()
    if (!data.length) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices_${data.length}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = async () => {
    const data: any[] = await fetchSelectedInvoices()
    if (!data.length) return
    const headers = [
      'id','supplier_name','invoice_number','invoice_date','amount','currency','email_from','email_subject'
    ]
    const rows = data.map((d) => [
      d.id,
      d.supplier_name ?? '',
      d.invoice_number ?? '',
      d.invoice_date ?? '',
      (d.amount ?? d?.extracted_data?.amounts?.total ?? d?.extracted_data?.total_ttc ?? '').toString(),
      d.currency ?? d?.extracted_data?.amounts?.currency ?? d?.extracted_data?.currency ?? 'EUR',
      d.email_from ?? '',
      (d.email_subject ?? '').replace(/\n/g,' '),
    ])
    const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices_${data.length}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    const data: any[] = await fetchSelectedInvoices()
    if (!data.length) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write('<html><head><title>Export factures</title></head><body>')
    w.document.write('<h1>Export des factures</h1>')
    w.document.write('<table border="1" style="border-collapse:collapse;width:100%">')
    w.document.write('<thead><tr><th>ID</th><th>Fournisseur</th><th>N°</th><th>Date</th><th>Montant</th><th>Devise</th></tr></thead><tbody>')
    data.forEach((d:any)=>{
      const amount = d.amount ?? d?.extracted_data?.amounts?.total ?? d?.extracted_data?.total_ttc ?? ''
      const currency = d.currency ?? d?.extracted_data?.amounts?.currency ?? d?.extracted_data?.currency ?? 'EUR'
      w.document.write(`<tr><td>${d.id}</td><td>${d.supplier_name ?? ''}</td><td>${d.invoice_number ?? ''}</td><td>${d.invoice_date ?? ''}</td><td>${amount}</td><td>${currency}</td></tr>`) 
    })
    w.document.write('</tbody></table>')
    w.document.write('</body></html>')
    w.document.close()
    w.print()
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold text-foreground">Factures</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 text-sm py-1.5">
                <Download className="h-4 w-4" strokeWidth={1.5} />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={exportJSON}>Export JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCSV}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>Export PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search and filters - Version ultra minimaliste */}
        <div className="flex gap-2 justify-end">
          <div className="relative w-40">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.5}
            />
            <Input 
              placeholder="Rechercher..." 
              className="pl-7 text-xs h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <InvoiceFilters 
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
          <InvoiceActions 
            onDeleteSelected={handleDeleteSelected}
            selectedCount={selectedInvoices.length}
          />
        </div>

        {/* Invoice table */}
        <InvoiceTable 
          searchQuery={searchQuery} 
          filters={filters}
          selectedInvoices={selectedInvoices}
          onSelectedInvoicesChange={setSelectedInvoices}
          // Important: stocker une fonction en valeur d'état nécessite un wrapper
          onDeleteFunctionChange={(fn) => setDeleteFunction(() => fn)}
        />
      </div>
    </DashboardLayout>
  )
}








