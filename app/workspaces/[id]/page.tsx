"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"

type Member = { user_id: string; email: string; role: string; status: string }
type Tab = "org" | "members" | "general"

const translateRole = (role: string): string => {
  const roleMap: Record<string, string> = {
    'owner': 'Propriétaire',
    'admin': 'Administrateur',
    'manager': 'Gérant',
    'member': 'Membre'
  }
  return roleMap[role.toLowerCase()] || role
}

export default function WorkspaceDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const orgId = params.id as string
  const [tab, setTab] = useState<Tab>("org")
  const [orgName, setOrgName] = useState<string>("")
  const [logoUrl, setLogoUrl] = useState<string>("")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [preferredCurrency, setPreferredCurrency] = useState<string>("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)
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
      const { data: ws } = await supabase.from('workspaces').select('name').eq('id', orgId).single()
      // Pré-remplir strictement avec le nom enregistré
      setOrgName(ws?.name || (orgId === 'personal' ? 'Espace personnel' : ''))
      // Si un champ de logo existe plus tard côté BDD, on le liera. Pour l'instant on garde local.
      setLogoUrl(logoUrl || "")
      // Si un champ existe plus tard côté BDD, on le liera. Pour l'instant on garde local.
      setPreferredCurrency(prev => prev || 'EUR')

      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, role, status, profiles:profiles!inner(email)')
        .eq('workspace_id', orgId)
      const rows: Member[] = (data || []).map((r: any) => ({ user_id: r.user_id, email: r.profiles?.email || '-', role: r.role, status: r.status }))
      setMembers(rows)
    } finally { setLoading(false) }
  }

  const invite = async () => {
    const email = inviteEmail.trim(); if (!email) return
    try {
      const res = await fetch('/api/workspaces/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: orgId, email, role: inviteRole }) })
      const body = await res.json(); if (!res.ok) throw new Error(body.error || 'Erreur')
      setInviteEmail(''); setInviteRole('member'); await load(); alert('Invitation envoyée')
    } catch (e:any) { console.error(e); alert('❌ Invitation impossible') }
  }

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch('/api/workspaces/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: orgId, userId }) })
      const body = await res.json(); if (!res.ok) throw new Error(body.error || 'Erreur')
      await load()
    } catch { alert('❌ Suppression impossible') }
  }

  const deleteWorkspace = async () => {
    try {
      setDeleting(true)
      const res = await fetch(`/api/workspaces/${orgId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Erreur')
      setConfirmOpen(false)
      router.push('/dashboard')
    } catch (e) { 
      console.error(e)
      alert('❌ Suppression impossible')
    } finally {
      setDeleting(false)
    }
  }

  const onUploadLogo = async (file: File) => {
    if (!file) return
    try {
      setUploadingLogo(true)
      
      // Utiliser l'API route pour l'upload
      const formData = new FormData()
      formData.append('logo', file)
      
      const res = await fetch(`/api/workspaces/${orgId}/logo`, {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur upload')
      
      setLogoUrl(data.url)
    } catch (e: any) {
      console.error(e)
      alert(`❌ Échec de l'upload du logo: ${e?.message || 'erreur inconnue'}`)
    } finally {
      setUploadingLogo(false)
    }
  }

  const saveGeneral = async () => {
    try {
      setSavingGeneral(true)
      
      console.log('Début sauvegarde pour workspace:', orgId)
      console.log('Données à sauvegarder:', { orgName, logoUrl, preferredCurrency })
      
      // Préparer les données à sauvegarder
      const updateData: any = {
        name: orgName.trim() || null
      }
      
      // Ajouter le logo s'il existe
      if (logoUrl) {
        updateData.logo_url = logoUrl
      }
      
      // Ajouter la devise préférée s'il existe (pour plus tard)
      if (preferredCurrency) {
        updateData.preferred_currency = preferredCurrency
      }
      
      console.log('Update data:', updateData)
      
      // Sauvegarder toutes les modifications en une seule requête
      const { data, error: updateError } = await supabase
        .from('workspaces')
        .update(updateData)
        .eq('id', orgId)
        .select()
      
      console.log('Résultat update:', { data, error: updateError })
      
      if (updateError) {
        console.error('Erreur détaillée:', updateError)
        throw new Error(`Erreur Supabase: ${updateError.message} (${updateError.code})`)
      }
      
      alert('✅ Modifications enregistrées')
      
      // Rafraîchir les données pour s'assurer que tout est synchronisé
      await load()
      
    } catch (e: any) {
      console.error('Erreur complète:', e)
      alert(`❌ Enregistrement impossible: ${e.message || 'erreur inconnue'}`)
    } finally {
      setSavingGeneral(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar dédiée aux espaces de travail */}
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 text-sm">
              <ArrowLeft className="h-4 w-4" /> Retourner au tableau de bord
            </Button>
          </Link>
          <div className="text-sm text-muted-foreground">{orgName || (orgId === 'personal' ? 'Espace personnel' : '')}</div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        <div className="flex gap-6">
          {/* Sidebar dédiée */}
          <aside className="w-64 shrink-0">
            <div className="rounded-md border border-border bg-background p-3 text-sm">
              <button className={`w-full rounded-sm px-2 py-1.5 text-left ${tab==='org'?'bg-muted font-medium':''}`} onClick={()=>setTab('org')}>Espace Organisation</button>
              <button className={`mt-1 w-full rounded-sm px-2 py-1.5 text-left ${tab==='members'?'bg-muted font-medium':''}`} onClick={()=>setTab('members')}>Membres</button>
              <button className={`mt-1 w-full rounded-sm px-2 py-1.5 text-left ${tab==='general'?'bg-muted font-medium':''}`} onClick={()=>setTab('general')}>Général</button>
            </div>
          </aside>

          {/* Contenu */}
          <section className="flex-1">
            {tab === 'org' && (
              <div>
                <h1 className="mb-2 text-xl font-semibold text-foreground">Réglages de l’organisation</h1>
                <div className="rounded-md border border-border bg-background p-4 text-sm text-foreground">
                  Cet espace est partagé avec votre équipe. Tous les membres peuvent consulter et traiter les factures selon leurs rôles.
                </div>
              </div>
            )}
            {tab === 'members' && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-foreground">Membres</h2>
                <div className="mb-4 flex gap-2">
                  <Input placeholder="email@exemple.com" value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} className="w-64" />
                  <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={inviteRole} onChange={(e)=>setInviteRole(e.target.value)}>
                    <option value="manager">Gérant</option>
                    <option value="admin">Administrateur</option>
                    <option value="member">Membre</option>
                  </select>
                  <Button onClick={invite}>Inviter</Button>
                </div>
                <div className="rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-foreground">
                        <th className="px-3 py-2 text-left">Nom</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Rôle</th>
                        <th className="px-3 py-2 text-left">Statut</th>
                        <th className="px-3 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr><td className="px-3 py-3 text-muted-foreground" colSpan={5}>Aucun membre n’est encore ajouté.</td></tr>
                      ) : members.map((m)=> (
                        <tr key={m.user_id} className="border-t border-border">
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">{m.email}</td>
                          <td className="px-3 py-2">{translateRole(m.role)}</td>
                          <td className="px-3 py-2">{m.status}</td>
                          <td className="px-3 py-2 text-right">
                            <Button variant="outline" onClick={()=>removeMember(m.user_id)}>Retirer</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {tab === 'general' && (
              <div>
                <h2 className="mb-1 text-xl font-semibold text-foreground">Paramètres généraux</h2>
                <p className="mb-4 text-sm text-muted-foreground">Mettez à jour le nom et l'avatar de votre organisation.</p>
                {/* Carte principale */}
                <div className="rounded-md border border-border bg-background p-5 text-sm">
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Avatar */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Avatar de l'organisation</label>
                      <div className="flex items-center gap-4">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded border border-border object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">512×512</div>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">
                            {uploadingLogo ? 'Téléversement…' : 'Télécharger l\'avatar'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) onUploadLogo(f) }} />
                          </label>
                          <Button variant="destructive" className="text-xs" onClick={()=>setLogoUrl("")}>Retirer</Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">JPG, PNG ou GIF. Taille maximale : 10 Mo. Format recommandé : 512 × 512 px.</p>
                    </div>

                    {/* Nom + Devise */}
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Nom de l'organisation</label>
                        <Input key={orgId} value={orgName} onChange={(e)=>setOrgName(e.target.value)} placeholder="Nom de l’organisation" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Devise préférée</label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={preferredCurrency} onChange={(e)=>setPreferredCurrency(e.target.value)}>
                          <option value="" disabled>Sélectionnez la devise préférée</option>
                          <option value="EUR">EUR — Euro</option>
                          <option value="USD">USD — Dollar</option>
                          <option value="GBP">GBP — Livre</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <Button onClick={saveGeneral} disabled={savingGeneral}>{savingGeneral ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>
                  </div>
                </div>

                {/* Carte suppression (accentuée) */}
                <div className="mt-6 rounded-md border border-red-300 bg-background p-5 text-sm shadow-sm ring-1 ring-red-200">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-red-700">Supprimer l'organisation</h3>
                      <p className="mt-1 max-w-3xl text-[13px] leading-5 text-red-700/90">
                        Supprimez définitivement <span className="font-semibold">{orgName || 'cette organisation'}</span> et toutes ses données, y compris les reçus, les intégrations et les paramètres.
                        Cette action est irréversible et affectera tous les membres de l'organisation.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Button
                        variant="destructive"
                        onClick={() => { setConfirmName(""); setConfirmOpen(true) }}
                        className="h-10 rounded-full bg-red-600 px-5 text-white shadow-sm ring-1 ring-red-500/30 hover:bg-red-700"
                      >
                        Supprimer l'organisation
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Modale de confirmation suppression */}
                <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmer la suppression</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <p>Cette action supprimera définitivement <span className="font-semibold">{orgName || 'cette organisation'}</span> et toutes ses données associées.</p>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Tapez le nom de l’organisation pour confirmer</label>
                        <Input value={confirmName} onChange={(e)=>setConfirmName(e.target.value)} placeholder={orgName || 'Nom de l’organisation'} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
                      <Button 
                        variant="destructive" 
                        onClick={deleteWorkspace} 
                        disabled={deleting || !orgName || confirmName.trim() !== orgName.trim()}
                      >
                        {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}









