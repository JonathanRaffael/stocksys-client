"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type Shift = "S1"|"S2"|"S3"
type AggRow = {
  productId: string
  productCode: string
  productName: string
  productSize?: string | null
  isActive: boolean
  beforeIpqc: number
  afterIpqc: number
  onGoingPostcured: number
  afterPostcured: number
  beforeOqc: number
  afterOqc: number
  hold: number
  totalOk: number
  totalBelumOk: number
}
type AggResp = {
  items: AggRow[]
  totalProducts: number
  grand: {
    totalOk: number
    totalBelumOk: number
    afterIpqc: number
    afterPostcured: number
    beforeOqc: number
    afterOqc: number
    hold: number
  }
}

const nf = (n: number) => Intl.NumberFormat("id-ID").format(n)
const tok = () => { try { return localStorage.getItem("token") || "" } catch { return "" } }

export default function AdminProductTotals() {
  // filters ringan
  const today = new Date().toISOString().slice(0,10)
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [plant, setPlant] = useState<string>("")
  const [line, setLine] = useState<string>("")
  const [q, setQ] = useState<string>("")
  const [order, setOrder] = useState<"desc"|"asc">("desc") // sort by totalOk
  const [take, setTake] = useState<number>(20)

  // data
  const [data, setData] = useState<AggResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const queryString = useMemo(()=>{
    const p = new URLSearchParams()
    if (dateFrom) p.set("dateFrom", dateFrom)
    if (dateTo)   p.set("dateTo", dateTo)
    if (plant)    p.set("plant", plant)
    if (line)     p.set("line", line)
    if (q)        p.set("q", q)
    p.set("order", order)
    p.set("take", String(take))
    return p.toString()
  },[dateFrom,dateTo,plant,line,q,order,take])

  const load = useCallback(async()=>{
    try{
      setErr(null); setLoading(true)
      const res = await fetch(`/api/admin/aggregate-by-product?${queryString}`, {
        headers: { Authorization: `Bearer ${tok()}` }
      })
      if(!res.ok) throw new Error(await res.text().catch(()=>`Request failed ${res.status}`))
      const json: AggResp = await res.json()
      setData(json)
    }catch(e:any){
      console.error(e); setErr(e?.message || "Gagal memuat data")
      setData(null)
    }finally{ setLoading(false) }
  },[queryString])

  useEffect(()=>{ load() },[load])

  const exportCSV = () => {
    const headers = ["Produk","Nama","Size","After OQC (OK)","Belum OK","Hold/Return","After Postcured","After IPQC","Active?"]
    const rows = (data?.items ?? []).map(r=>[
      r.productCode, r.productName, r.productSize ?? "",
      r.afterOqc, r.totalBelumOk, r.hold, r.afterPostcured, r.afterIpqc, r.isActive ? "yes":"no"
    ])
    const csv = [headers, ...rows]
      .map(r=>r.map(v=> {
        const s = String(v ?? "")
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
      }).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `total-produk_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1">
          <h1 className="heading">Total Produk (Akumulasi)</h1>
          <p className="text-muted">
            Rekap lintas hari/shift. Atur filter di bawah untuk menyempitkan rentang data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-outline">Refresh</button>
          <button onClick={exportCSV} className="btn-ghost">Export CSV</button>
        </div>
      </header>

      {/* Filters */}
      <section className="card grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="text-xs text-slate-500">Dari</label>
          <input type="date" className="input" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Sampai</label>
          <input type="date" className="input" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Plant</label>
          <input className="input" value={plant} onChange={(e)=>setPlant(e.target.value)} placeholder="HT" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Line</label>
          <input className="input" value={line} onChange={(e)=>setLine(e.target.value)} placeholder="LINE-1" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Cari produk</label>
          <input className="input" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="kode / nama..." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500">Urut Total OK</label>
            <select className="select" value={order} onChange={(e)=>setOrder(e.target.value as any)}>
              <option value="desc">Terbesar → kecil</option>
              <option value="asc">Terkecil → besar</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Top</label>
            <select className="select" value={take} onChange={(e)=>setTake(Number(e.target.value))}>
              {[10,20,50,100].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Produk Terhitung" value={nf(data?.totalProducts ?? 0)} />
        <Kpi title="Total OK (After OQC)" value={nf(data?.grand.totalOk ?? 0)} />
        <Kpi title="Belum OK" value={nf(data?.grand.totalBelumOk ?? 0)} />
        <Kpi title="Hold / Return" value={nf(data?.grand.hold ?? 0)} />
        <Kpi title="After Postcured" value={nf(data?.grand.afterPostcured ?? 0)} />
      </section>

      {/* Table */}
      <section className="card p-0 overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Daftar Produk (Top {take})</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Diurutkan berdasar Total OK.</p>
          </div>
          <div className="text-sm text-slate-500">{loading ? "Loading…" : `${data?.items.length ?? 0} produk`}</div>
        </header>

        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="table">
            <thead className="sticky top-0 bg-white/85 dark:bg-slate-900/70 backdrop-blur">
              <tr>
                <th className="px-4 py-2">Produk</th>
                <th className="px-4 py-2 text-right">After OQC (OK)</th>
                <th className="px-4 py-2 text-right">Belum OK</th>
                <th className="px-4 py-2 text-right">Hold/Return</th>
                <th className="px-4 py-2 text-right">After Postcured</th>
                <th className="px-4 py-2 text-right">After IPQC</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map(r=>(
                <tr key={r.productId} className="align-top">
                  <td className="px-4 py-2 min-w-64">
                    <div className="font-medium">{r.productCode}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm">
                      {r.productName}{r.productSize ? ` • ${r.productSize}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.afterOqc)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.totalBelumOk)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.hold)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.afterPostcured)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.afterIpqc)}</td>
                  <td className="px-4 py-2">
                    <span className={
                      "badge " + (r.isActive ? "badge-success" : "badge-danger")
                    }>
                      {r.isActive ? "Active" : "Non-active"}
                    </span>
                  </td>
                </tr>
              ))}
              {(!loading && (data?.items?.length ?? 0) === 0) && (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Tidak ada data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
