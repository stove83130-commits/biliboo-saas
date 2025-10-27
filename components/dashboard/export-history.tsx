"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  Table2, 
  FileSpreadsheet,
  Download,
  Mail,
  Cloud,
  Trash2,
  Calendar,
  DollarSign,
  FileIcon
} from "lucide-react"

interface ExportRecord {
  id: string
  format: string
  invoice_count: number
  total_amount: number
  destination: string
  destination_email: string | null
  file_name: string
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
    switch (format) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-600" />
      case 'excel':
        return <Table2 className="h-5 w-5 text-green-600" />
      case 'csv':
        return <FileSpreadsheet className="h-5 w-5 text-blue-600" />
      default:
        return <FileIcon className="h-5 w-5" />
    }
  }

  function getDestinationIcon(destination: string) {
    switch (destination) {
      case 'download':
        return <Download className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'cloud':
        return <Cloud className="h-4 w-4" />
      default:
        return null
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

        {loading ? (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">Chargement...</p>
          </Card>
        ) : exports.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun export pour le moment</p>
              <p className="text-sm text-muted-foreground mt-2">
                Vos exports apparaîtront ici après création
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {exports.map((exportRecord) => (
              <Card key={exportRecord.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icône du format */}
                    <div className="mt-1">
                      {getFormatIcon(exportRecord.format)}
                    </div>

                    {/* Informations principales */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{exportRecord.file_name}</h3>
                        <Badge variant="secondary">
                          {exportRecord.format.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(exportRecord.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4" />
                          <span>{exportRecord.invoice_count} facture{exportRecord.invoice_count > 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          <span>{exportRecord.total_amount?.toFixed(2)} EUR</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {getDestinationIcon(exportRecord.destination)}
                          <span>
                            {exportRecord.destination === 'download' && 'Téléchargé'}
                            {exportRecord.destination === 'email' && exportRecord.destination_email}
                            {exportRecord.destination === 'cloud' && 'Cloud'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        Taille: {formatFileSize(exportRecord.file_size || 0)} • 
                        Expire le {new Date(exportRecord.expires_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteExport(exportRecord.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

