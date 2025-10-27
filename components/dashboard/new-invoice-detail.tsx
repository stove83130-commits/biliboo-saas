"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Adapted = any

export function NewInvoiceDetail({ id }: { id: string }) {
  const [loading, setLoading] = useState(true)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [data, setData] = useState<Adapted | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<any>({})
  const [preview, setPreview] = useState<any>(null)
  const [lines, setLines] = useState<Array<{ desc: string; qty: number; unit_price: number; tax_rate: number }>>([])
  const [totals, setTotals] = useState<{ subtotal: number; tax_total: number; grand_total: number }>({ subtotal: 0, tax_total: 0, grand_total: 0 })
  const [notes, setNotes] = useState<string>("")
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [pdfZoom, setPdfZoom] = useState<number>(100)
  const [pdfPage, setPdfPage] = useState<number>(1)
  const [history, setHistory] = useState<any[]>([])
  const [future, setFuture] = useState<any[]>([])
  const [duplicates, setDuplicates] = useState<any[] | null>(null)
  const [dupeMarks, setDupeMarks] = useState<Record<string, 'marked'|'ignored'>>({})
  const [draftStatus, setDraftStatus] = useState<'idle'|'editing'|'saved'>('idle')
  const [fieldStates, setFieldStates] = useState<Record<string, 'idle'|'editing'|'saved'>>({})
  const [pdfSearch, setPdfSearch] = useState<string>("")

  useEffect(() => {
    let abort = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/invoices/${id}/adapted`)
        const json = await res.json()
        if (!abort && json.ok) {
          setData(json.adapted)
          setFileUrl(json.filePublicUrl || null)
        }
      } finally {
        if (!abort) setLoading(false)
      }
    }
    load()
    return () => { abort = true }
  }, [id])

  // Init local editable data when API loads
  useEffect(() => {
    if (!data) return
    const srcLines = Array.isArray(data?.lines) ? data.lines : []
    setLines(srcLines.map((l: any) => ({ desc: l.desc || "", qty: Number(l.qty)||0, unit_price: Number(l.unit_price)||0, tax_rate: Number(l.tax_rate)||0 })))
    setTotals({
      subtotal: Number(data?.totals?.subtotal)||0,
      tax_total: Number(data?.totals?.tax_total)||0,
      grand_total: Number(data?.totals?.grand_total)||0,
    })
  }, [data])

  // Recompute totals when lines change
  useEffect(() => {
    if (!lines.length) return
    const subtotal = lines.reduce((s, l) => s + (l.qty * l.unit_price), 0)
    const tax_total = lines.reduce((s, l) => s + (l.qty * l.unit_price) * (l.tax_rate/100), 0)
    const grand_total = subtotal + tax_total
    setTotals({ subtotal: round2(subtotal), tax_total: round2(tax_total), grand_total: round2(grand_total) })
    setDraft((d:any) => ({ ...d, lines, totals: { subtotal: round2(subtotal), tax_total: round2(tax_total), grand_total: round2(grand_total) } }))
    setDraftStatus('editing')
  }, [lines])

  // Autosave local: passe à "saved" après un court délai d'inactivité
  useEffect(() => {
    if (draftStatus !== 'editing') return
    const t = setTimeout(() => setDraftStatus('saved'), 600)
    return () => clearTimeout(t)
  }, [draftStatus, draft])

  // Debounce par champ
  useEffect(() => {
    const timers: any[] = []
    Object.entries(fieldStates).forEach(([k, v]) => {
      if (v === 'editing') {
        const tt = setTimeout(() => setFieldStates(fs => ({ ...fs, [k]: 'saved' })), 800)
        timers.push(tt)
      }
    })
    return () => { timers.forEach(clearTimeout) }
  }, [fieldStates])

  const markEditing = (key: string) => setFieldStates(fs => ({ ...fs, [key]: 'editing' }))
  const Icon = ({ state }: { state?: 'idle'|'editing'|'saved' }) => (
    <span className={state==='saved' ? 'text-green-600' : state==='editing' ? 'text-amber-600' : 'text-muted-foreground'}>
      {state==='saved' ? '●' : state==='editing' ? '●' : '○'}
    </span>
  )

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement…</div>
  }
  if (!data) {
    return <div className="text-sm text-red-600">Erreur de chargement</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Vue experimentale - adaptation sans ecriture</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={saving} onClick={async()=>{
            setSaving(true)
            try { await fetch(`/api/invoices/${id}/extract`, { method: 'POST' }); const r=await fetch(`/api/invoices/${id}/adapted`); const j=await r.json(); if (j.ok){ setData(j.adapted); setFileUrl(j.filePublicUrl||null) } } finally { setSaving(false) }
          }}>Relancer extraction</Button>
          <Button variant="outline" disabled={saving} onClick={async()=>{
            setSaving(true)
            try { const r=await fetch(`/api/invoices/${id}/adapted`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(draft||{}) }); const j=await r.json(); setPreview(j) } finally { setSaving(false) }
          }}>Previsualiser ecriture</Button>
          <Button variant="outline" onClick={()=>{
            if (!data) return
            setHistory(h=>[...h,{ lines: JSON.parse(JSON.stringify(lines)), totals: {...totals} }])
            if (history.length>100) setHistory(h=>h.slice(-100))
          }}>Snapshot</Button>
          <Button variant="outline" onClick={()=>{
            const prev = history.pop()
            if (!prev) return
            setFuture(f=>[...f,{ lines: JSON.parse(JSON.stringify(lines)), totals: {...totals} }])
            setLines(prev.lines||[])
            setTotals(prev.totals||{subtotal:0,tax_total:0,grand_total:0})
            setHistory([...history])
          }}>Undo</Button>
          <Button variant="outline" onClick={()=>{
            const nxt = future.pop()
            if (!nxt) return
            setHistory(h=>[...h,{ lines: JSON.parse(JSON.stringify(lines)), totals: {...totals} }])
            setLines(nxt.lines||[])
            setTotals(nxt.totals||{subtotal:0,tax_total:0,grand_total:0})
            setFuture([...future])
          }}>Redo</Button>
          <Button variant="outline" onClick={async()=>{
            const r=await fetch(`/api/invoices/${id}/duplicates`); const j=await r.json();
            setDuplicates(j.ok? j.items : [])
          }}>Déduplication</Button>
        </div>
      </div>
      {draftStatus !== 'idle' && (
        <div className="lg:col-span-2 text-xs">
          {draftStatus === 'editing' ? <span className="text-amber-600">En cours…</span> : <span className="text-green-600">Brouillon enregistré</span>}
        </div>
      )}
      <div>
        <Card className="p-4 text-sm">
          <details open>
            <summary className="mb-2 font-medium">En-tête</summary>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-muted-foreground flex items-center gap-2" onMouseEnter={()=>setHoverKey('header.invoice_no')} onMouseLeave={()=>setHoverKey(null)}>Numéro <Icon state={fieldStates['header.invoice_no']} /></label>
              <input className="border rounded px-2 py-1" defaultValue={data?.header?.invoice_no||''} onChange={(e)=>{ markEditing('header.invoice_no'); setDraft((d:any)=>({...d, header:{...(d?.header||{}), invoice_no:e.target.value}})) }} />
              <label className="text-muted-foreground flex items-center gap-2" onMouseEnter={()=>setHoverKey('header.supplier.name')} onMouseLeave={()=>setHoverKey(null)}>Émetteur <Icon state={fieldStates['header.supplier.name']} /></label>
              <input className="border rounded px-2 py-1" defaultValue={data?.header?.supplier?.name||''} onChange={(e)=>{ markEditing('header.supplier.name'); setDraft((d:any)=>({...d, header:{...(d?.header||{}), supplier:{...((d?.header&&d.header.supplier)||{}), name:e.target.value}}})) }} />
              <label className="text-muted-foreground flex items-center gap-2" onMouseEnter={()=>setHoverKey('header.issue_date')} onMouseLeave={()=>setHoverKey(null)}>Date <Icon state={fieldStates['header.issue_date']} /></label>
              <input type="date" className="border rounded px-2 py-1" defaultValue={data?.header?.issue_date||''} onChange={(e)=>{ markEditing('header.issue_date'); setDraft((d:any)=>({...d, header:{...(d?.header||{}), issue_date:e.target.value}})) }} />
              <label className="text-muted-foreground flex items-center gap-2" onMouseEnter={()=>setHoverKey('header.due_date')} onMouseLeave={()=>setHoverKey(null)}>Échéance <Icon state={fieldStates['header.due_date']} /></label>
              <input type="date" className="border rounded px-2 py-1" defaultValue={data?.header?.due_date||''} onChange={(e)=>{ markEditing('header.due_date'); setDraft((d:any)=>({...d, header:{...(d?.header||{}), due_date:e.target.value}})) }} />
              <label className="text-muted-foreground flex items-center gap-2" onMouseEnter={()=>setHoverKey('header.currency')} onMouseLeave={()=>setHoverKey(null)}>Devise <Icon state={fieldStates['header.currency']} /></label>
              <select className="border rounded px-2 py-1" defaultValue={data?.header?.currency||'EUR'} onChange={(e)=>{ markEditing('header.currency'); setDraft((d:any)=>({...d, header:{...(d?.header||{}), currency:e.target.value}})) }}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
              <label className="text-muted-foreground flex items-center gap-2" onMouseEnter={()=>setHoverKey('totals.grand_total')} onMouseLeave={()=>setHoverKey(null)}>Total TTC <Icon state={fieldStates['totals.grand_total']} /></label>
              <input className="border rounded px-2 py-1" defaultValue={data?.header?.total_ttc??''} onChange={(e)=>{ markEditing('totals.grand_total'); setDraft((d:any)=>({...d, header:{...(d?.header||{}), total_ttc:Number(e.target.value)||0}})) }} />
            </div>
          </details>
          <details className="mt-4" open>
            <summary className="mb-2 font-medium">Lignes</summary>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <input className="col-span-3 border rounded px-2 py-1" value={l.desc} onChange={(e)=>{
                    const arr=[...lines]; arr[i]={...arr[i], desc:e.target.value}; setLines(arr)
                  }} />
                  <input type="number" className="border rounded px-2 py-1" value={l.qty} onChange={(e)=>{
                    const v=Number(e.target.value)||0; const arr=[...lines]; arr[i]={...arr[i], qty:v}; setLines(arr)
                  }} />
                  <input type="number" className="border rounded px-2 py-1" value={l.unit_price} onChange={(e)=>{
                    const v=Number(e.target.value)||0; const arr=[...lines]; arr[i]={...arr[i], unit_price:v}; setLines(arr)
                  }} />
                  <input type="number" className="border rounded px-2 py-1" value={l.tax_rate} onChange={(e)=>{
                    const v=Number(e.target.value)||0; const arr=[...lines]; arr[i]={...arr[i], tax_rate:v}; setLines(arr)
                  }} />
                </div>
              ))}
              <div>
                <Button variant="outline" onClick={()=> setLines(prev => [...prev, { desc: "", qty: 1, unit_price: 0, tax_rate: 20 }])}>+ Ajouter une ligne</Button>
              </div>
            </div>
          </details>
          <details className="mt-4" open>
            <summary className="mb-2 font-medium">Totaux</summary>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-muted-foreground">Total HT</label>
              <input className="border rounded px-2 py-1" value={totals.subtotal} onChange={(e)=>{
                const v=Number(e.target.value)||0; setTotals(t=>({ ...t, subtotal: v })); setDraft((d:any)=> ({...d, totals:{...((d?.totals)||{}), subtotal:v}}))
              }} />
              <label className="text-muted-foreground">Total TVA</label>
              <input className="border rounded px-2 py-1" value={totals.tax_total} onChange={(e)=>{
                const v=Number(e.target.value)||0; setTotals(t=>({ ...t, tax_total: v })); setDraft((d:any)=> ({...d, totals:{...((d?.totals)||{}), tax_total:v}}))
              }} />
              <label className="text-muted-foreground">Total TTC</label>
              <input className="border rounded px-2 py-1" value={totals.grand_total} onChange={(e)=>{
                const v=Number(e.target.value)||0; setTotals(t=>({ ...t, grand_total: v })); setDraft((d:any)=> ({...d, totals:{...((d?.totals)||{}), grand_total:v}}))
              }} />
            </div>
          </details>
          <details className="mt-4">
            <summary className="mb-2 font-medium">Notes</summary>
            <textarea className="w-full border rounded p-2 text-sm" rows={4} value={notes} onChange={(e)=> setNotes(e.target.value)} />
          </details>
          {preview ? (
            <div className="mt-3">
              <div className="text-xs font-medium mb-1">Diff (prévisualisation)</div>
              <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(preview, null, 2)}</pre>
            </div>
          ) : null}
        </Card>
      </div>
      <div>
        <Card className="p-1">
          <div className="p-2 flex items-center gap-2 text-xs">
            <Button variant="outline" size="sm" onClick={()=> setPdfPage(p=> Math.max(1, p-1))}>{'<'}</Button>
            <span>Page</span>
            <input className="w-14 border rounded px-1 py-0.5" value={pdfPage} onChange={(e)=> setPdfPage(Math.max(1, Number(e.target.value)||1))} />
            <Button variant="outline" size="sm" onClick={()=> setPdfPage(p=> p+1)}>{'>'}</Button>
            <div className="ml-4" />
            <Button variant="outline" size="sm" onClick={()=> setPdfZoom(z=> Math.max(25, z-25))}>-</Button>
            <span>{pdfZoom}%</span>
            <Button variant="outline" size="sm" onClick={()=> setPdfZoom(z=> Math.min(400, z+25))}>+</Button>
            <div className="ml-4" />
            <input className="border rounded px-2 py-0.5" placeholder="Rechercher…" value={pdfSearch} onChange={(e)=> setPdfSearch(e.target.value)} />
            <Button variant="outline" size="sm" onClick={()=> setPdfSearch("")}>Effacer</Button>
          </div>
          <div className="relative w-full h-[74vh]">
            {fileUrl ? (
              <iframe src={`${fileUrl}#page=${pdfPage}&zoom=${pdfZoom}${pdfSearch? `&search=${encodeURIComponent(pdfSearch)}`:''}`} className="w-full h-full" />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">PDF non disponible</div>
            )}
            {/* Surlignage (best-effort): utilise des bboxes si présentes dans extracted_data */}
            {hoverKey && data?.raw?.extracted_data?.bboxes && Array.isArray(data.raw.extracted_data.bboxes[hoverKey]) && (
              (data.raw.extracted_data.bboxes[hoverKey] as any[]).map((b: any, i: number) => (
                <div key={i} className="absolute border-2 border-yellow-400/80 bg-yellow-200/20 pointer-events-none"
                  style={{ display: (b.page && b.page !== pdfPage) ? 'none':'block', left: (b.x||0), top: (b.y||0), width: (b.w||0), height: (b.h||0) }} />
              ))
            )}
          </div>
        </Card>
      </div>
      {duplicates && (
        <div className="lg:col-span-2">
          <Card className="p-4 text-sm">
            <div className="mb-2 font-medium">Doublons potentiels</div>
            {duplicates.length === 0 ? (
              <div className="text-xs text-muted-foreground">Aucun candidat</div>
            ) : (
              <div className="space-y-1 text-xs">
                {duplicates.map((d:any, i:number)=> {
                  const key = `${id}::${d.id}`
                  const stored = typeof window !== 'undefined' ? (localStorage.getItem(`dupe:${key}`) as any) : null
                  const state = dupeMarks[key] || stored || null
                  return (
                    <div key={i} className="grid grid-cols-6 gap-2 border-b py-1 items-center">
                      <div className="truncate" title={d.supplier_name}>{d.supplier_name}</div>
                      <div>{d.invoice_date || '-'}</div>
                      <div>{d.currency || '-'}</div>
                      <div>{d.amount ?? '-'}</div>
                      <div>{state ? (state==='marked' ? 'Marqué' : 'Ignoré') : '—'}</div>
                      <div className="text-right flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={()=>{ if (typeof window !== 'undefined') localStorage.setItem(`dupe:${key}`, 'marked'); setDupeMarks(m=> ({...m,[key]:'marked'})) }}>Marquer doublon</Button>
                        <Button variant="outline" size="sm" onClick={()=>{ if (typeof window !== 'undefined') localStorage.setItem(`dupe:${key}`, 'ignored'); setDupeMarks(m=> ({...m,[key]:'ignored'})) }}>Ignorer</Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}



