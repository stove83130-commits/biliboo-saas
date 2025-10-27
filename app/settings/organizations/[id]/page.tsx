"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

type Member = { user_id: string; email: string; role: string; status: string }

type Tab = "info" | "members" | "danger"

export default function OrgDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const orgId = params.id as string
  const [tab, setTab] = useState<Tab>("info")
  const [orgName, setOrgName] = useState<string>("")
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [orgId])

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

      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, role, status, profiles:profiles!inner(email)')
        .eq('workspace_id', orgId)
      const rows: Member[] = (data || []).map((r: any) => ({ user_id: r.user_id, email: r.profiles?.email || '-', role: r.role, status: r.status }))
      setMembers(rows)
    } finally {
      setLoading(false)
    }
  }

  const invite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    try {
      const res = await fetch('/api/workspaces/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: orgId, email, role: inviteRole }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur')
      setInviteEmail('')
      setInviteRole('member')
      await load()
    } catch (e) {
      console.error(e)
      alert('❌ Invitation impossible')
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
                  <option value="manager">Gérant</option>
                  <option value="admin">Administrateur</option>
                  <option value="member">Membre</option>
                </select>
                <Button onClick={invite}>Inviter</Button>
              </div>
            </div>

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
                          <td className="px-4 py-3 capitalize">{m.role}</td>
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
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => removeMember(m.user_id)}
                            >
                              Retirer
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'danger' && (
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
      </div>
    </div>
  )
}

