"use client"

import { Button } from "@/components/ui/button"
import { Trash2, Download } from "lucide-react"

interface InvoiceActionsProps {
  selectedCount: number
  onDeleteSelected: () => void
}

export function InvoiceActions({ selectedCount, onDeleteSelected }: InvoiceActionsProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">
        {selectedCount} facture{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onDeleteSelected}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Supprimer
      </Button>
    </div>
  )
}