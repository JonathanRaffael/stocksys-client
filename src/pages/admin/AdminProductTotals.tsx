"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import API from "@/api/axios" // ⬅️ pakai axios instance

type Shift = "S1" | "S2" | "S3"
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

const EMPTY: AggResp = {
  items: [],
  totalProducts: 0,
  grand: {
    totalOk: 0,
    totalBelumOk: 0,
    afterIpqc: 0,
    afterPostcured: 0,
    beforeOqc: 0,
    afterOqc: 0,
    hold: 0,
  },
}

export default function AdminProductTotals() {
  // filters
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [plant, setPlant] = useState<string>("")
  const [line, setLine] = useState<string>("")
  const [q, setQ] = useState<string>("")
  const [order, setOrder] = useState<"desc" | "asc">("desc")
  const [take, setTake] = useState<number>(20)

  // data
  const [data, setData] = useState<AggResp>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // bentuk object params biar rapi (memoized)
  const params = useMemo(() => {
    const p: Record<string, string | number> = { order, take }
    if (dateFrom) p.dateFrom = dateFrom
    if (dateTo) p.dateTo = dateTo
    if (plant) p.plant = plant
    if (line) p.line = line
    if (q) p.q = q
    return p
  }, [dateFrom, dateTo, plant, line, q, order, take])

  const load = useCallback(async () => {
    try {
      setErr(null)
      setLoading(true)

      const res = await API.get("/admin/aggregate-by-product", {
        params,
        headers: { Authorization: `Bearer ${tok()}` },
      })

      // validasi content-type biar gak ketipu HTML
      const ct = String(res.headers["content-type"] || "")
      if (!ct.includes("application/json")) {
        throw new Error(`Expected JSON but got ${ct} (${res.config.url})`)
      }

      const json = (res.data ?? EMPTY) as AggResp
      setData({
        items: json.items ?? [],
        totalProducts: json.totalProducts ?? 0,
        grand: { ...EMPTY.grand, ...(json.grand ?? {}) },
      })
    } catch (e: any) {
      console.error("loadTotals error:", e?.message || e)
      setErr(e?.response?.data?.error || e?.message || "Gagal memuat data")
      setData(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  const exportCSV = () => {
    const headers = [
      "Produk",
      "Nama",
      "Size",
      "After OQC (OK)",
      "Belum OK",
      "Hold/Return",
      "After Postcured",
      "After IPQC",
      "Active?",
    ]
    const rows = (data.items ?? []).map((r) => [
      r.productCode,
      r.productName,
      r.productSize ?? "",
      r.afterOqc,
      r.totalBelumOk,
      r.hold,
      r.afterPostcured,
      r.afterIpqc,
      r.isActive ? "yes" : "no",
    ])
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? "")
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `total-produk_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          <button onClick={load} className="btn-outline" disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button onClick={exportCSV} className="btn-ghost">
            Export CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="card grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="text-xs text-slate-500">Dari</label>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Sampai</label>
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Plant</label>
          <input
            className="input"
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            placeholder="HT"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Line</label>
          <input
            className="input"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="LINE-1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Cari produk</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="kode / nama..."
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500">Urut Total OK</label>
            <select
              className="select"
              value={order}
              onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
            >
              <option value="desc">Terbesar → kecil</option>
              <option value="asc">Terkecil → besar</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Top</label>
            <select
              className="select"
              value={take}
              onChange={(e) => setTake(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Error */}
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
          {err}
        </div>
      )}

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Produk Terhitung" value={nf(data.totalProducts)} />
        <Kpi title="Total OK (After OQC)" value={nf(data.grand.totalOk)} />
        <Kpi title="Belum OK" value={nf(data.grand.totalBelumOk)} />
        <Kpi title="Hold / Return" value={nf(data.grand.hold)} />
        <Kpi title="After Postcured" value={nf(data.grand.afterPostcured)} />
      </section>

      {/* Table */}
      <section className="card p-0 overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="font-semibold">Daftar Produk (Top {take})</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Diurutkan berdasar Total OK.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {loading ? "Loading…" : `${data.items.length} produk`}
          </div>
        </header>

        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="table">
            <thead className="sticky top-0 bg-white/85 backdrop-blur dark:bg-slate-900/70">
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
              {data.items.map((r) => (
                <tr key={r.productId} className="align-top">
                  <td className="min-w-64 px-4 py-2">
                    <div className="font-medium">{r.productCode}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {r.productName}
                      {r.productSize ? ` • ${r.productSize}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.afterOqc)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.totalBelumOk)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.hold)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.afterPostcured)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(r.afterIpqc)}</td>
                  <td className="px-4 py-2">
                    <span className={"badge " + (r.isActive ? "badge-success" : "badge-danger")}>
                      {r.isActive ? "Active" : "Non-active"}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Tidak ada data.
                  </td>
                </tr>
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
