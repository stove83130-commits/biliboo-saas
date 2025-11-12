"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { AuthGuard } from "@/components/auth-guard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, ArrowLeft, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePlanPermissions } from "@/hooks/use-plan-permissions"

export default function NewOrganizationPage() {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const supabase = createClient()
  const router = useRouter()
  const { canCreateOrg, isLoading: isLoadingPermissions } = usePlanPermissions()

  useEffect(() => {
    if (!isLoadingPermissions && !canCreateOrg) {
      setError('Vous devez avoir un plan actif pour créer des organisations. Veuillez choisir un plan dans les paramètres de facturation.')
    }
  }, [canCreateOrg, isLoadingPermissions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError("Le nom de l'organisation est requis")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Vous devez être connecté")
        return
      }

      // Créer l'organisation via l'API
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          type: 'organization',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de la création')
      }

      const data = await response.json()
      
      // Rediriger vers le dashboard et sélectionner le nouveau workspace
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_workspace_id', data.workspace.id)
      }
      
      router.push('/dashboard')
      window.location.reload()
    } catch (err: any) {
      console.error('Erreur création organisation:', err)
      setError(err.message || 'Erreur lors de la création de l\'organisation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Créer une organisation</h1>
                <p className="text-sm text-gray-600">
                  Créez un espace de travail pour votre équipe
                </p>
              </div>
            </div>
          </div>

          <Card className="p-6 border-0 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-900">
                  Nom de l'organisation *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mon Entreprise"
                  className={`mt-2 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  disabled={loading || (!canCreateOrg && !isLoadingPermissions)}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  Ce nom sera visible par tous les membres de l'organisation
                </p>
                {error && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-600 mb-2">{error}</p>
                    {error.includes('plan') && (
                      <Button
                        type="button"
                        onClick={() => window.location.href = '/plans'}
                        size="sm"
                        className="mt-2 text-white hover:opacity-90 transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                        }}
                      >
                        Voir les plans
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading || !name.trim() || !canCreateOrg || isLoadingPermissions}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 mr-2" />
                      Créer l'organisation
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-4 mt-6 border-0 bg-blue-50">
            <div className="flex gap-3">
              <div className="h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  À propos des organisations
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Les organisations permettent de collaborer en équipe</li>
                  <li>• Vous pouvez inviter des membres et gérer leurs accès</li>
                  <li>• Les factures sont séparées entre vos espaces personnels et organisations</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

