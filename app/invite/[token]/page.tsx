"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/sections/header"
import { FooterSection } from "@/components/sections/footer-section"

export default function InviteAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const token = params.token as string
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<{
    email: string
    workspace_id: string
    role: string
    workspace_name?: string
  } | null>(null)

  useEffect(() => {
    const loadInvite = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError("Vous devez être connecté pour accepter l'invitation")
          setLoading(false)
          return
        }

        // Récupérer les détails de l'invitation
        const { data: inviteData, error: inviteError } = await supabase
          .from("workspace_invites")
          .select("id, email, workspace_id, role, status, expires_at")
          .eq("token", token)
          .single()
        
        // Récupérer le nom du workspace séparément
        let workspaceName = ""
        if (inviteData) {
          const { data: workspace } = await supabase
            .from("workspaces")
            .select("name")
            .eq("id", inviteData.workspace_id)
            .single()
          workspaceName = workspace?.name || ""
        }

        if (inviteError || !inviteData) {
          setError("Invitation introuvable ou invalide")
          setLoading(false)
          return
        }

        if (inviteData.status !== "pending") {
          setError("Cette invitation a déjà été acceptée ou annulée")
          setLoading(false)
          return
        }

        if (new Date(inviteData.expires_at).getTime() < Date.now()) {
          setError("Cette invitation a expiré")
          setLoading(false)
          return
        }

        if (inviteData.email !== user.email) {
          setError(`Cette invitation est destinée à ${inviteData.email}, mais vous êtes connecté avec ${user.email}`)
          setLoading(false)
          return
        }

        setInvite({
          email: inviteData.email,
          workspace_id: inviteData.workspace_id,
          role: inviteData.role,
          workspace_name: workspaceName
        })
        setLoading(false)
      } catch (err: any) {
        console.error("Erreur chargement invitation:", err)
        setError("Erreur lors du chargement de l'invitation")
        setLoading(false)
      }
    }

    if (token) {
      loadInvite()
    }
  }, [token, supabase])

  const acceptInvite = async () => {
    if (!invite) return
    
    setAccepting(true)
    setError(null)

    try {
      const res = await fetch(`/api/workspaces/invites/${token}/accept`, {
        method: 'POST'
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body.error || "Erreur lors de l'acceptation")
      }

      // Rediriger vers le dashboard avec le workspace
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_workspace_id', invite.workspace_id)
      }
      
      router.push(`/dashboard`)
      window.location.reload()
    } catch (err: any) {
      console.error("Erreur acceptation:", err)
      setError(err.message || "Erreur lors de l'acceptation de l'invitation")
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Chargement de l'invitation...</div>
          </div>
        </div>
        <FooterSection />
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold mb-4 text-foreground">Erreur</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => router.push('/')}>Retour à l'accueil</Button>
          </div>
        </div>
        <FooterSection />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center min-h-[60vh] py-12">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg border border-border p-8 shadow-sm">
            <h1 className="text-2xl font-semibold mb-4 text-foreground">Invitation à rejoindre une organisation</h1>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="space-y-4 mb-6">
              <p className="text-sm text-muted-foreground">
                {invite?.workspace_name 
                  ? `Vous avez été invité à rejoindre l'organisation "${invite.workspace_name}" sur Bilibou.`
                  : "Vous avez été invité à rejoindre une organisation sur Bilibou."
                }
              </p>
              {invite && (
                <div className="bg-muted/50 rounded-md p-4">
                  <div className="text-sm space-y-2">
                    {invite.workspace_name && (
                      <div>
                        <span className="font-medium text-foreground">Organisation :</span> {invite.workspace_name}
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-foreground">Rôle :</span> {invite.role === 'owner' ? 'Propriétaire' : invite.role === 'admin' ? 'Administrateur' : 'Membre'}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={acceptInvite}
                disabled={accepting}
                className="flex-1"
              >
                {accepting ? 'Acceptation...' : 'Accepter l\'invitation'}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={accepting}
              >
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      </div>
      <FooterSection />
    </div>
  )
}

