"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Line = { description: string; quantity: number; unitPrice: number; vatRate: number }

export interface InvoiceEditorProps {
  invoice: any
  onSaved?: (updated: any) => void
}

export function InvoiceEditor({ invoice, onSaved }: InvoiceEditorProps) {
  const supabase = createClient()

  // Etats du formulaire (initialisés et synchronisés via useEffect)
  const [vendor, setVendor] = useState({ name: "", address: "", siren: "", vat: "", website: "" })
  const [customer, setCustomer] = useState({ name: "", address: "", vat: "" })
  const [info, setInfo] = useState({ number: "", issueDate: "", serviceDate: "", poRef: "", currency: "EUR" })
  const [lines, setLines] = useState<Line[]>([])
  const [totals, setTotals] = useState({ totalHT: 0, totalTVA: 0, totalTTC: 0, discount: 0 })
  const [payment, setPayment] = useState({ terms: "", dueDate: "", lateFeeRate: "", collectionFee: false })

  const [warnings, setWarnings] = useState<string[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Synchroniser l'état lorsque la facture (props) arrive/évolue
  useEffect(() => {
    if (!invoice) return
    const ex = (invoice.extracted_data || {}) as any
    setVendor({
      name: invoice.supplier_name || ex.vendor_name || "",
      address: ex.vendor_address || "",
      siren: ex.vendor_siren || "",
      vat: invoice.supplier_vat || ex.vendor_vat || "",
      website: ex.vendor_website || "",
    })
    setCustomer({
      name: ex.customer_name || "",
      address: ex.customer_address || "",
      vat: ex.customer_vat || "",
    })
    setInfo({
      number: invoice.invoice_number || ex.invoice_number || "",
      issueDate: invoice.invoice_date || ex.issue_date || "",
      serviceDate: ex.service_date || "",
      poRef: ex.po_ref || "",
      currency: invoice.currency || ex.currency || "EUR",
    })
    const exLines = Array.isArray(ex.lines) ? ex.lines : []
    setLines(exLines.map((l: any) => ({
      description: l.description || "",
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unit_price_ht) || 0,
      vatRate: Number(l.vat_rate) || 0,
    })))
    const initialHT = Number(ex.total_ht ?? 0)
    const initialTVA = Number(ex.total_tva ?? 0)
    const initialTTC = Number(ex.total_ttc ?? (initialHT + initialTVA))
    setTotals({ totalHT: initialHT, totalTVA: initialTVA, totalTTC: initialTTC, discount: Number(ex.discount || 0) })
    setPayment({
      terms: ex.payment_terms || "",
      dueDate: invoice.due_date || ex.due_date || "",
      lateFeeRate: ex.late_fee_rate || "",
      collectionFee: !!ex.collection_fee,
    })
  }, [invoice])

  const calc = useMemo(() => {
    const sumHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const sumTVA = lines.reduce((s, l) => s + (l.quantity * l.unitPrice) * (l.vatRate / 100), 0)
    const sumTTC = sumHT + sumTVA
    return { sumHT, sumTVA, sumTTC }
  }, [lines])

  useEffect(() => {
    const ws: string[] = []
    if (Math.abs(calc.sumHT - totals.totalHT) > 0.01) ws.push("La somme des lignes HT diffère du Total HT")
    if (Math.abs(calc.sumTVA - totals.totalTVA) > 0.01) ws.push("La somme des TVA diffère du Total TVA")
    if (Math.abs(calc.sumTTC - totals.totalTTC) > 0.01) ws.push("HT + TVA ≠ TTC")
    if (info.issueDate && new Date(info.issueDate) > new Date()) ws.push("Date d’émission future")
    if (payment.dueDate && info.issueDate && new Date(payment.dueDate) < new Date(info.issueDate)) ws.push("Échéance antérieure à la date d’émission")
    setWarnings(ws)

    const miss: string[] = []
    if (!vendor.name) miss.push("Vendeur - Raison sociale")
    if (!info.number) miss.push("Facture - Numéro")
    setMissing(miss)
  }, [calc, totals, info, payment, vendor])

  const addLine = () => setLines(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, vatRate: 20 }])
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  const exportJSON = () => {
    const data = {
      vendor, customer, info, lines, totals, payment,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice_${info.number || invoice?.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const headers = ["Description","Quantité","PU HT","TVA %","TVA €","Total HT","Total TTC"]
    const rows = lines.map(l => {
      const ht = l.quantity * l.unitPrice
      const tva = ht * (l.vatRate/100)
      return [l.description, l.quantity, l.unitPrice.toFixed(2), l.vatRate, tva.toFixed(2), ht.toFixed(2), (ht+tva).toFixed(2)]
    })
    const csv = [headers.join(";"), ...rows.map(r=>r.join(";"))].join("\n")
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice_${info.number || invoice?.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Invoice ${info.number}</title></head><body>`)
    w.document.write(`<h1>Facture ${info.number}</h1>`)
    w.document.write(`<p>Vendeur: ${vendor.name}</p>`)
    w.document.write(`<table border="1" style="border-collapse:collapse;width:100%"><thead><tr><th>Description</th><th>Qté</th><th>PU HT</th><th>TVA %</th><th>TVA €</th><th>Total HT</th><th>Total TTC</th></tr></thead><tbody>`)
    lines.forEach(l => {
      const ht = l.quantity * l.unitPrice
      const tva = ht * (l.vatRate/100)
      const ttc = ht + tva
      w.document.write(`<tr><td>${l.description}</td><td>${l.quantity}</td><td>${l.unitPrice.toFixed(2)}</td><td>${l.vatRate}</td><td>${tva.toFixed(2)}</td><td>${ht.toFixed(2)}</td><td>${ttc.toFixed(2)}</td></tr>`)
    })
    w.document.write(`</tbody></table>`)
    w.document.write(`<p>Total HT: ${totals.totalHT.toFixed(2)} — Total TVA: ${totals.totalTVA.toFixed(2)} — Total TTC: ${totals.totalTTC.toFixed(2)}</p>`)
    w.document.write(`</body></html>`) 
    w.document.close()
    w.print()
  }

  const save = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('active_workspace_id') : null
      const updatePayload: any = {
        supplier_name: vendor.name || null,
        supplier_vat: vendor.vat || null,
        invoice_number: info.number || null,
        invoice_date: info.issueDate || null,
        due_date: payment.dueDate || null,
        currency: info.currency,
        amount: totals.totalTTC || null,
        extracted_data: {
          vendor_address: vendor.address,
          vendor_siren: vendor.siren,
          vendor_website: vendor.website,
          customer_name: customer.name,
          customer_address: customer.address,
          customer_vat: customer.vat,
          service_date: info.serviceDate,
          po_ref: info.poRef,
          lines,
          total_ht: totals.totalHT,
          total_tva: totals.totalTVA,
          total_ttc: totals.totalTTC,
          discount: totals.discount,
          payment_terms: payment.terms,
          late_fee_rate: payment.lateFeeRate,
          collection_fee: payment.collectionFee,
        },
        status: 'processed',
        workspace_id: (activeWorkspaceId && activeWorkspaceId !== 'personal') ? activeWorkspaceId : null,
      }

      // audit diff basique
      const changes: any[] = []
      const keysToTrack: Array<[string, any]> = [
        ['supplier_name', vendor.name],
        ['supplier_vat', vendor.vat],
        ['invoice_number', info.number],
        ['invoice_date', info.issueDate],
        ['due_date', payment.dueDate],
        ['amount', totals.totalTTC],
      ]
      keysToTrack.forEach(([field, newValue]) => {
        const oldValue = (invoice || {})[field as keyof typeof invoice]
        if (String(oldValue ?? '') !== String(newValue ?? '')) {
          changes.push({ invoice_id: invoice.id, user_id: user.id, field, old_value: String(oldValue ?? ''), new_value: String(newValue ?? '') })
        }
      })

      const upd = await supabase.from('invoices').update(updatePayload).eq('id', invoice.id)
      if (upd.error) throw upd.error
      if (changes.length) await supabase.from('invoice_audit_log').insert(changes)
      onSaved?.({ ...invoice, ...updatePayload })
      alert('✅ Facture mise à jour')
    } catch (e) {
      console.error(e)
      alert('❌ Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {warnings.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="mb-1 font-semibold">Incohérences détectées</div>
          <ul className="list-disc pl-5">
            {warnings.map((w,i)=>(<li key={i}>{w}</li>))}
          </ul>
        </Card>
      )}

      {missing.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 p-4 text-xs text-yellow-800">
          <div className="mb-1 font-semibold">Champs manquants</div>
          <ul className="list-disc pl-5">
            {missing.map((m,i)=>(<li key={i}>{m}</li>))}
          </ul>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Vendeur</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <Input placeholder="Raison sociale" value={vendor.name} onChange={e=>setVendor(v=>({...v,name:e.target.value}))} />
          <Input placeholder="Adresse complète" value={vendor.address} onChange={e=>setVendor(v=>({...v,address:e.target.value}))} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="SIREN/SIRET" value={vendor.siren} onChange={e=>setVendor(v=>({...v,siren:e.target.value}))} />
            <Input placeholder="N° TVA intracommunautaire" value={vendor.vat} onChange={e=>setVendor(v=>({...v,vat:e.target.value}))} />
          </div>
          <Input placeholder="Site web" value={vendor.website} onChange={e=>setVendor(v=>({...v,website:e.target.value}))} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Client</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <Input placeholder="Raison sociale / Nom" value={customer.name} onChange={e=>setCustomer(c=>({...c,name:e.target.value}))} />
          <Input placeholder="Adresse" value={customer.address} onChange={e=>setCustomer(c=>({...c,address:e.target.value}))} />
          <Input placeholder="N° TVA (si assujetti)" value={customer.vat} onChange={e=>setCustomer(c=>({...c,vat:e.target.value}))} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Facture</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <Input placeholder="Numéro de facture" value={info.number} onChange={e=>setInfo(i=>({...i,number:e.target.value}))} />
          <div className="grid grid-cols-3 gap-3">
            <Input type="date" placeholder="Date d’émission" value={info.issueDate} onChange={e=>setInfo(i=>({...i,issueDate:e.target.value}))} />
            <Input type="date" placeholder="Date de vente/prestation" value={info.serviceDate} onChange={e=>setInfo(i=>({...i,serviceDate:e.target.value}))} />
            <Input placeholder="Référence devis/bon de commande" value={info.poRef} onChange={e=>setInfo(i=>({...i,poRef:e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={info.currency} onChange={e=>setInfo(i=>({...i,currency:e.target.value}))}>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Lignes et montants</h2>
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted text-foreground">
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantité</th>
                <th className="px-2 py-2 text-right">PU HT</th>
                <th className="px-2 py-2 text-right">TVA %</th>
                <th className="px-2 py-2 text-right">TVA €</th>
                <th className="px-2 py-2 text-right">Total HT</th>
                <th className="px-2 py-2 text-right">Total TTC</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const ht = l.quantity * l.unitPrice
                const tva = ht * (l.vatRate/100)
                const ttc = ht + tva
                return (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-2 py-1"><Input value={l.description} onChange={e=>setLines(arr=>arr.map((x,i)=> i===idx?{...x,description:e.target.value}:x))} className="h-8 text-xs" /></td>
                    <td className="px-2 py-1 text-right"><Input type="number" step="0.01" value={l.quantity} onChange={e=>setLines(arr=>arr.map((x,i)=> i===idx?{...x,quantity:Number(e.target.value)}:x))} className="h-8 text-right text-xs" /></td>
                    <td className="px-2 py-1 text-right"><Input type="number" step="0.01" value={l.unitPrice} onChange={e=>setLines(arr=>arr.map((x,i)=> i===idx?{...x,unitPrice:Number(e.target.value)}:x))} className="h-8 text-right text-xs" /></td>
                    <td className="px-2 py-1 text-right"><Input type="number" step="0.01" value={l.vatRate} onChange={e=>setLines(arr=>arr.map((x,i)=> i===idx?{...x,vatRate:Number(e.target.value)}:x))} className="h-8 text-right text-xs" /></td>
                    <td className="px-2 py-1 text-right">{tva.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{ht.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{ttc.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right"><Button variant="outline" size="sm" onClick={()=>removeLine(idx)}>Suppr.</Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={addLine}>+ Ajouter une ligne</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-muted-foreground">Remise globale</div>
          <Input type="number" step="0.01" value={totals.discount} onChange={e=>setTotals(t=>({...t,discount:Number(e.target.value)}))} />
          <div className="text-muted-foreground">Total HT</div>
          <Input type="number" step="0.01" value={totals.totalHT} onChange={e=>setTotals(t=>({...t,totalHT:Number(e.target.value)}))} />
          <div className="text-muted-foreground">Total TVA</div>
          <Input type="number" step="0.01" value={totals.totalTVA} onChange={e=>setTotals(t=>({...t,totalTVA:Number(e.target.value)}))} />
          <div className="text-muted-foreground">Total TTC</div>
          <Input type="number" step="0.01" value={totals.totalTTC} onChange={e=>setTotals(t=>({...t,totalTTC:Number(e.target.value)}))} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Paiement & mentions</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <Input placeholder="Conditions de paiement" value={payment.terms} onChange={e=>setPayment(p=>({...p,terms:e.target.value}))} />
          <div className="grid grid-cols-3 gap-3">
            <Input type="date" placeholder="Échéance" value={payment.dueDate} onChange={e=>setPayment(p=>({...p,dueDate:e.target.value}))} />
            <Input placeholder="Pénalités de retard (%/mois)" value={payment.lateFeeRate} onChange={e=>setPayment(p=>({...p,lateFeeRate:e.target.value}))} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={payment.collectionFee} onChange={e=>setPayment(p=>({...p,collectionFee:e.target.checked}))} /> Indemnité de recouvrement (40 € B2B)
            </label>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
          <Button variant="outline" onClick={exportPDF}>Export PDF</Button>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
      </div>
    </div>
  )
}


