"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions"

type Member = { user_id: string; email: string; role: string; status: string }

type Tab = "info" | "members" | "danger"

const translateRole = (role: string): string => {
  const roleMap: Record<string, string> = {
    'owner': 'Propriétaire',
    'admin': 'Administrateur',
    'manager': 'Gérant',
    'member': 'Membre'
  }
  return roleMap[role.toLowerCase()] || role
}

export default function OrgDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const orgId = params.id as string
  const permissions = useWorkspacePermissions(orgId)
  const [tab, setTab] = useState<Tab>("info")
  const [orgName, setOrgName] = useState<string>("")
  const [members, setMembers] = useState<Member[]>([])
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string; role: string; created_at: string; expires_at: string }>>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [loading, setLoading] = useState(true)
  const [canRemoveMap, setCanRemoveMap] = useState<Record<string, boolean>>({})
  const [isRevokeOpen, setIsRevokeOpen] = useState(false)
  const [inviteToRevoke, setInviteToRevoke] = useState<{ id: string; email: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', orgId)
        .single()
      setOrgName(ws?.name || "Organisation")

      // Utiliser l'API pour récupérer les membres avec leurs emails
      const res = await fetch(`/api/workspaces/members?workspaceId=${orgId}`)
      if (!res.ok) throw new Error('Erreur lors de la récupération des membres')
      const { members } = await res.json()
      setMembers(members || [])

      // Récupérer les invitations en attente
      const invitesRes = await fetch(`/api/workspaces/invites?workspaceId=${orgId}`)
      if (invitesRes.ok) {
        const { invites } = await invitesRes.json()
        // Filtrer uniquement les invitations en attente (pending)
        const pending = (invites || []).filter((inv: any) => inv.status === 'pending')
        setPendingInvites(pending)
      }

      // Pré-calculer les permissions de suppression pour chaque membre
      if (!permissions.isLoading) {
        const removePermissions: Record<string, boolean> = {}
        for (const member of (members || [])) {
          removePermissions[member.user_id] = await permissions.canRemoveMember(member.user_id)
        }
        setCanRemoveMap(removePermissions)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  const reloadInvites = async () => {
    try {
      const invitesRes = await fetch(`/api/workspaces/invites?workspaceId=${orgId}`)
      if (invitesRes.ok) {
        const { invites } = await invitesRes.json()
        const pending = (invites || []).filter((inv: any) => inv.status === 'pending')
        setPendingInvites(pending)
      }
    } catch (e) {
      // silencieux pour une mise à jour discrète
    }
  }

  useEffect(() => {
    if (!permissions.isLoading && orgId) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, permissions.isLoading])

  // Rafraîchir automatiquement toutes les 2 secondes pour voir les nouveaux membres qui acceptent
  useEffect(() => {
    if (!orgId || loading || permissions.isLoading) return
    
    const refresh = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // Recharger les membres
        const res = await fetch(`/api/workspaces/members?workspaceId=${orgId}`)
        if (res.ok) {
          const { members } = await res.json()
          setMembers(members || [])
        }
        
        // Recharger les invitations en attente
        const invitesRes = await fetch(`/api/workspaces/invites?workspaceId=${orgId}`)
        if (invitesRes.ok) {
          const { invites } = await invitesRes.json()
          const pending = (invites || []).filter((inv: any) => inv.status === 'pending')
          setPendingInvites(pending)
        }
      } catch (error) {
        console.error('Erreur rafraîchissement:', error)
      }
    }
    
    // Rafraîchir immédiatement
    refresh()
    
    // Puis rafraîchir toutes les 2 secondes
    const interval = setInterval(refresh, 2000)
    
    return () => clearInterval(interval)
  }, [orgId, loading, permissions.isLoading, supabase])

  const invite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    
    // Vérifier d'abord les permissions côté client
    if (!permissions.canInviteMembers) {
      alert('❌ Vous n\'avez pas la permission d\'inviter des membres')
      return
    }
    
    try {
      // Toujours utiliser la route d'invitation qui envoie un email
      const res = await fetch('/api/workspaces/invites', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ workspaceId: orgId, email, role: inviteRole }) 
      })
      const body = await res.json()
      
      if (!res.ok) throw new Error(body.error || 'Erreur')
      
      setInviteEmail('')
      setInviteRole('member')
      
      if (body.emailSent) {
        alert('✅ Invitation envoyée par email à ' + email)
      } else {
        let message = '⚠️ L\'invitation a été créée mais l\'email n\'a pas pu être envoyé.\n\n'
        
        if (body.reason) {
          message += 'Raison : ' + body.reason + '\n\n'
        }
        
        if (!body.hasResendConfig && !body.hasSMTPConfig) {
          message += 'Vérifiez que RESEND_API_KEY est configurée dans Vercel.\n\n'
        } else if (body.hasResendConfig && !body.emailSent) {
          message += 'Vérifiez les logs Vercel pour voir l\'erreur Resend.\n\n'
        }
        
        if (body.directLink) {
          message += `Partagez ce lien manuellement :\n${body.directLink}`
        }
        
        alert(message)
      }
      
      // Forcer le rechargement immédiat pour mettre à jour les invitations en attente
      await load()
    } catch (e: any) {
      console.error('Erreur invitation:', e)
      alert('❌ Erreur : ' + (e.message || 'Invitation impossible'))
    }
  }

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch('/api/workspaces/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: orgId, userId }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur')
      await load()
    } catch (e) {
      console.error(e)
      alert('❌ Suppression impossible')
    }
  }

  const deleteWorkspace = async () => {
    if (!confirm("⚠️ ATTENTION ⚠️\n\nSupprimer cet espace supprimera définitivement :\n• Toutes les factures de l'organisation\n• Tous les membres\n• Tous les paramètres\n\nCette action est IRRÉVERSIBLE.\n\nÊtes-vous absolument certain de vouloir continuer ?")) return
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', orgId)
      if (error) throw error
      router.push('/settings/organizations')
    } catch (e) {
      console.error(e)
      alert('❌ Suppression impossible')
    }
  }

  const openRevokeInvite = (invite: { id: string; email: string }) => {
    if (!permissions.canInviteMembers) {
      alert('❌ Vous n\'avez pas la permission de révoquer des invitations')
      return
    }
    setInviteToRevoke({ id: invite.id, email: invite.email })
    setIsRevokeOpen(true)
  }

  const confirmRevokeInvite = async () => {
    if (!inviteToRevoke) return
    try {
      // Mise à jour optimiste
      const prev = pendingInvites
      setPendingInvites(prev.filter(i => i.id !== inviteToRevoke.id))

      const res = await fetch('/api/workspaces/invites', { 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ inviteId: inviteToRevoke.id, workspaceId: orgId })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur')
      setIsRevokeOpen(false)
      setInviteToRevoke(null)
      // Rafraîchissement ciblé, sans toggle du loading global
      await reloadInvites()
    } catch (e: any) {
      console.error('Erreur révocation:', e)
      alert('❌ Révocation impossible : ' + (e.message || 'Erreur inconnue'))
      // rollback si erreur
      await reloadInvites()
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Paramètres de l'organisation</h1>
        <div className="text-xs text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/settings/organizations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Retour aux organisations
        </Link>
        <h1 className="text-xl font-semibold mb-1">{orgName}</h1>
        <p className="text-sm text-muted-foreground">Gérez les paramètres de cette organisation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        <button
          onClick={() => setTab('info')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'info'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Informations
        </button>
        <button
          onClick={() => setTab('members')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Membres
        </button>
        <button
          onClick={() => setTab('danger')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'danger'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Zone de danger
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {tab === 'info' && (
          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="text-base font-medium mb-4">À propos de l'organisation</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nom de l'organisation</label>
                <p className="text-sm mt-1">{orgName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type d'espace</label>
                <p className="text-sm mt-1">Organisation</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm mt-1 text-muted-foreground">
                  Cet espace est partagé avec votre équipe. Tous les membres peuvent consulter et traiter les factures selon leurs rôles.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <>
            {permissions.canInviteMembers && (
              <div className="rounded-md border border-border bg-background p-4">
                <h2 className="text-base font-medium mb-4">Inviter un membre</h2>
                <div className="flex gap-2">
                  <Input 
                    placeholder="email@exemple.com" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    className="flex-1"
                  />
                  <select 
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    {permissions.isOwner && <option value="owner">Propriétaire</option>}
                    <option value="admin">Administrateur</option>
                    <option value="member">Membre</option>
                  </select>
                  <Button onClick={invite}>Inviter</Button>
                </div>
              </div>
            )}

            <div className="rounded-md border border-border bg-background overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="text-base font-medium">Membres de l'organisation</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-foreground">
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Rôle</th>
                      <th className="px-4 py-3 text-left font-medium">Statut</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                          Aucun membre n'est encore ajouté.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr key={m.user_id} className="border-t border-border hover:bg-muted/50">
                          <td className="px-4 py-3">{m.email}</td>
                          <td className="px-4 py-3">{translateRole(m.role)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              m.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canRemoveMap[m.user_id] && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => removeMember(m.user_id)}
                              >
                                Retirer
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tableau des invitations en attente */}
            {pendingInvites.length > 0 && (
              <div className="rounded-md border border-border bg-background overflow-hidden mt-6">
                <div className="p-4 border-b border-border">
                  <h2 className="text-base font-medium">Invitations en attente</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ces personnes ont été invitées mais n'ont pas encore rejoint l'organisation.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-foreground">
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        <th className="px-4 py-3 text-left font-medium">Rôle</th>
                        <th className="px-4 py-3 text-left font-medium">Invité le</th>
                        <th className="px-4 py-3 text-left font-medium">Expire le</th>
                        <th className="px-4 py-3 text-right font-medium">Statut</th>
                        {permissions.canInviteMembers && (
                          <th className="px-4 py-3 text-right font-medium">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvites.map((invite) => {
                        const createdDate = new Date(invite.created_at)
                        const expiresDate = new Date(invite.expires_at)
                        const isExpired = expiresDate.getTime() < Date.now()
                        
                        return (
                          <tr key={invite.id} className="border-t border-border hover:bg-muted/50">
                            <td className="px-4 py-3">{invite.email}</td>
                            <td className="px-4 py-3">{translateRole(invite.role)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {createdDate.toLocaleDateString('fr-FR', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {expiresDate.toLocaleDateString('fr-FR', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                isExpired
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {isExpired ? 'Expirée' : 'En attente'}
                              </span>
                            </td>
                            {permissions.canInviteMembers && (
                              <td className="px-4 py-3 text-right">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openRevokeInvite({ id: invite.id, email: invite.email })}
                                >
                                  Révoquer
                                </Button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modale de confirmation de révocation */}
            <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Révoquer l'invitation</DialogTitle>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">
                  {inviteToRevoke?.email
                    ? `Voulez-vous vraiment révoquer l'invitation envoyée à ${inviteToRevoke.email} ?`
                    : `Voulez-vous vraiment révoquer cette invitation ?`}
                  <div className="mt-2">
                    Cette action empêchera la personne d'utiliser le lien pour rejoindre l'organisation.
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setIsRevokeOpen(false); setInviteToRevoke(null) }}>Annuler</Button>
                  <Button variant="destructive" onClick={confirmRevokeInvite}>Révoquer</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {tab === 'danger' && permissions.canDeleteOrganization && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <h2 className="text-base font-medium text-red-800 mb-4">Supprimer l'organisation</h2>
            <div className="space-y-4">
              <p className="text-sm text-red-700">
                Supprimer cet espace supprimera définitivement toutes les données associées à cette organisation :
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                <li>Toutes les factures de l'organisation</li>
                <li>Tous les membres et invitations</li>
                <li>Tous les paramètres et configurations</li>
                <li>L'historique complet</li>
              </ul>
              <p className="text-sm text-red-700 font-medium">
                Cette action est IRRÉVERSIBLE.
              </p>
              <Button 
                variant="destructive" 
                onClick={deleteWorkspace}
                className="mt-2"
              >
                Supprimer définitivement l'organisation
              </Button>
            </div>
          </div>
        )}
        {tab === 'danger' && !permissions.canDeleteOrganization && (
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">
              Seul le propriétaire peut supprimer l'organisation.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

