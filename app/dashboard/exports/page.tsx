"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, History, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ExportWizard } from "@/components/dashboard/export-wizard"
import { ExportHistory } from "@/components/dashboard/export-history"

export default function ExportsPage() {
  const [totalInvoices, setTotalInvoices] = useState(0)
  const [showWizard, setShowWizard] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoicesCount()
  }, [])

  async function loadInvoicesCount() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setTotalInvoices(count || 0)
    setLoading(false)
  }

  if (showWizard) {
    return (
      <DashboardLayout>
        <ExportWizard 
          onClose={() => setShowWizard(false)}
          onComplete={() => {
            setShowWizard(false)
            setShowHistory(true)
          }}
        />
      </DashboardLayout>
    )
  }

  if (showHistory) {
    return (
      <DashboardLayout>
        <ExportHistory onBack={() => setShowHistory(false)} />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Exporter vos factures</h1>
            <p className="text-muted-foreground">
              Exportez vos factures au format PDF, Excel ou CSV
            </p>
          </div>

          {/* Étape 1 : Résumé et CTA principal */}
          <Card className="p-8 mb-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <FileDown className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-semibold mb-2">
                {loading ? "Chargement..." : `Vous avez ${totalInvoices} facture${totalInvoices > 1 ? 's' : ''} au total`}
              </h2>
              
              <p className="text-muted-foreground mb-6">
                Sélectionnez les factures que vous souhaitez exporter et choisissez votre format
              </p>

              <Button 
                size="lg" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setShowWizard(true)}
                disabled={loading || totalInvoices === 0}
              >
                Commencer un export
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Historique des exports */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Historique des exports</h3>
                  <p className="text-sm text-muted-foreground">
                    Consultez vos exports précédents
                  </p>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={() => setShowHistory(true)}
              >
                Voir l'historique
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
