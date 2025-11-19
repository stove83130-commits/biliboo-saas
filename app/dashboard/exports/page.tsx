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
    
    if (!user) {
      setLoading(false)
      return
    }

    // Récupérer le workspace actif
    const activeWorkspaceId = typeof window !== 'undefined' 
      ? localStorage.getItem('active_workspace_id') 
      : null

    console.log('🔍 [EXPORTS PAGE] Comptage factures - Workspace ID:', activeWorkspaceId)

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
        console.warn('⚠️ [EXPORTS PAGE] Erreur lors de la vérification du type de workspace:', error)
        isPersonalWorkspace = true
      }
    } else {
      // Pas de workspace actif = workspace personnel
      isPersonalWorkspace = true
    }

    console.log('🔍 [EXPORTS PAGE] isPersonalWorkspace:', isPersonalWorkspace)

    // 🔧 FIX : Charger TOUTES les factures de l'utilisateur, puis filtrer côté client (comme dans invoice-table-new.tsx)
    const { data: allInvoices, error } = await supabase
      .from('invoices')
      .select('id, workspace_id')
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ [EXPORTS PAGE] Erreur chargement factures:', error)
      setTotalInvoices(0)
      setLoading(false)
      return
    }

    console.log('🔍 [EXPORTS PAGE] Total factures récupérées de la DB:', allInvoices?.length || 0)

    // Filtrer les factures selon le type de workspace (MÊME LOGIQUE QUE invoice-table-new.tsx)
    let filteredInvoices = allInvoices || []
    
    if (isPersonalWorkspace) {
      // Pour un workspace personnel, charger les factures avec workspace_id = null, 'personal', OU l'UUID du workspace personnel
      // (car certaines factures peuvent avoir été créées avec l'UUID du workspace personnel au lieu de null)
      filteredInvoices = (allInvoices || []).filter((invoice: any) => 
        invoice.workspace_id === null || 
        invoice.workspace_id === 'personal' || 
        invoice.workspace_id === activeWorkspaceId || // Accepter aussi l'UUID du workspace personnel
        !invoice.workspace_id
      )
      console.log('🔍 [EXPORTS PAGE] Filtre workspace personnel appliqué:', filteredInvoices.length, 'factures sur', allInvoices?.length || 0)
    } else if (activeWorkspaceId) {
      // Pour un workspace d'organisation, charger uniquement les factures de ce workspace
      filteredInvoices = (allInvoices || []).filter((invoice: any) => 
        invoice.workspace_id === activeWorkspaceId
      )
      console.log('🔍 [EXPORTS PAGE] Filtre workspace organisation appliqué:', filteredInvoices.length, 'factures sur', allInvoices?.length || 0)
    } else {
      // Par défaut, charger les factures personnelles
      filteredInvoices = (allInvoices || []).filter((invoice: any) => 
        invoice.workspace_id === null || 
        invoice.workspace_id === 'personal' || 
        !invoice.workspace_id
      )
      console.log('🔍 [EXPORTS PAGE] Filtre par défaut (personnel) appliqué:', filteredInvoices.length, 'factures sur', allInvoices?.length || 0)
    }

    setTotalInvoices(filteredInvoices.length)
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
