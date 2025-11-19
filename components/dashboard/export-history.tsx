"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  FileText, 
  FileSpreadsheet,
  Archive,
  Download,
  Trash2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  MoreVertical
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ExportRecord {
  id: string
  format: string
  invoice_count: number
  total_amount: number
  destination: string
  destination_email: string | null
  file_name: string
  file_url: string | null
  file_size: number
  created_at: string
  expires_at: string
}

interface ExportHistoryProps {
  onBack: () => void
}

export function ExportHistory({ onBack }: ExportHistoryProps) {
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    try {
      const response = await fetch('/api/exports/history')
      const data = await response.json()
      setExports(data.exports || [])
    } catch (error) {
      console.error('Erreur chargement historique:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteExport(id: string) {
    if (!confirm('Supprimer cet export ?')) return

    try {
      await fetch(`/api/exports/history?id=${id}`, {
        method: 'DELETE',
      })
      setExports(prev => prev.filter(e => e.id !== id))
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  function getFormatIcon(format: string) {
    switch (format.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-600" />
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4 text-blue-600" />
      case 'zip':
        return <Archive className="h-4 w-4 text-purple-600" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  function getFormatLabel(format: string) {
    switch (format.toLowerCase()) {
      case 'pdf':
        return 'PDF'
      case 'csv':
        return 'CSV'
      case 'zip':
        return 'ZIP'
      default:
        return format.toUpperCase()
    }
  }

  function formatDateTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function sortExports(exports: ExportRecord[], column: string | null, direction: 'asc' | 'desc') {
    if (!column) return exports

    const sorted = [...exports].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (column) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case 'format':
          aValue = a.format.toLowerCase()
          bValue = b.format.toLowerCase()
          break
        case 'invoice_count':
          aValue = a.invoice_count
          bValue = b.invoice_count
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

  const sortedExports = sortExports(exports, sortColumn, sortDirection)

  if (loading) {
    return (
      <div className="p-8">
        <Card className="border-border bg-card">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Card>
      </div>
    )
  }

  if (exports.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Historique des exports</h1>
              <p className="text-muted-foreground">
                Consultez et téléchargez vos exports précédents
              </p>
            </div>
            <Button variant="outline" onClick={onBack}>
              Retour
            </Button>
          </div>
          <Card className="border-border bg-card">
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-2">
                Aucun export trouvé
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Vos exports apparaîtront ici après création
              </p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Historique des exports</h1>
            <p className="text-muted-foreground">
              Consultez et téléchargez vos exports précédents
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            Retour
          </Button>
        </div>

        <Card className="border-border bg-card">
          <div className="border-b border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-foreground">
                {sortedExports.length} export{sortedExports.length > 1 ? 's' : ''} trouvé{sortedExports.length > 1 ? 's' : ''}
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={loadHistory}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead 
                    className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Date et heure
                      {sortColumn === 'created_at' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('format')}
                  >
                    <div className="flex items-center gap-1">
                      Type d'exportation
                      {sortColumn === 'format' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('invoice_count')}
                  >
                    <div className="flex items-center gap-1">
                      Nombre de factures
                      {sortColumn === 'invoice_count' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">Statut</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExports.map((exportRecord) => (
                  <TableRow 
                    key={exportRecord.id} 
                    className="border-border hover:bg-muted/50"
                  >
                    <TableCell className="text-sm text-foreground">
                      {formatDateTime(exportRecord.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFormatIcon(exportRecord.format)}
                        <span className="text-sm font-medium text-foreground">
                          {getFormatLabel(exportRecord.format)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exportRecord.invoice_count} facture{exportRecord.invoice_count > 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                        Complété
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {exportRecord.file_url && (
                            <DropdownMenuItem onClick={() => window.open(exportRecord.file_url!, '_blank')}>
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => deleteExport(exportRecord.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-border p-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Affichage des résultats 1 à {sortedExports.length} sur {sortedExports.length}
            </span>
            <div className="flex items-center gap-2">
              {/* Pagination pourrait être ajoutée ici si nécessaire */}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
