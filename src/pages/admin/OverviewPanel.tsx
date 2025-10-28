"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import API from "@/api/axios"

type Shift = "S1" | "S2" | "S3"
type Role  = "ADMIN" | "MASTER" | "IPQC" | "OQC"
type TableKind = "IPQC" | "OQC" | "ALL"

type Summary = {
  totalProducts: number
  activeProducts: number
  totalUsers: number
  todayByShift: Record<Shift, number>
  lastEntries: Array<{
    id: string
    date: string
    productName: string
    shift: Shift
    beforeIpqc?: number
    afterIpqc?: number
    onGoingPostcured?: number
    afterPostcured?: number
    beforeOqc?: number
    afterOqc?: number
    author: string
    byRole?: Role
  }>
}

const EMPTY: Summary = {
  totalProducts: 0,
  activeProducts: 0,
  totalUsers: 0,
  todayByShift: { S1: 0, S2: 0, S3: 0 },
  lastEntries: [],
}

const fmt = (n: number | string | undefined) =>
  typeof n === "number" ? Intl.NumberFormat("id-ID").format(n) : (n ?? "")

function getUserRole(): Role | null {
  try { return JSON.parse(localStorage.getItem("user") || "null")?.role ?? null } catch { return null }
}
function getKindFromURL(): TableKind | null {
  try {
    const qs = new URLSearchParams(window.location.search)
    const v = (qs.get("kind") || "").toUpperCase()
    return (v === "IPQC" || v === "OQC" || v === "ALL") ? (v as TableKind) : null
  } catch { return null }
}

export default function OverviewPanel() {
  // Tentukan MODE tabel
  const role = getUserRole()
  const urlKind = getKindFromURL()
  const [kind, setKind] = useState<TableKind>(
    urlKind ?? (role === "IPQC" ? "IPQC" : role === "OQC" ? "OQC" : "ALL")
  )

  const [data, setData] = useState<Summary>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0) // manual refresh
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    try { return localStorage.getItem("overview_auto") === "1" } catch { return false }
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const retryRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalToday =
    (data.todayByShift.S1 ?? 0) +
    (data.todayByShift.S2 ?? 0) +
    (data.todayByShift.S3 ?? 0)

  const normalize = (json: any): Summary => ({
    totalProducts: json?.kpi?.totalProducts ?? 0,
    activeProducts: json?.kpi?.activeProducts ?? 0,
    totalUsers: json?.kpi?.totalUsers ?? 0,
    todayByShift: json?.kpi?.todayByShift ?? { S1: 0, S2: 0, S3: 0 },
    lastEntries: Array.isArray(json?.lastEntries)
      ? json.lastEntries.map((r: any) => ({
          id: String(r.id),
          date: r.date,
          productName: r.productName ?? "-",
          shift: (r.shift ?? "S1") as Shift,
          beforeIpqc: r.beforeIpqc ?? 0,
          afterIpqc: r.afterIpqc ?? 0,
          onGoingPostcured: r.onGoingPostcured ?? 0,
          afterPostcured: r.afterPostcured ?? 0,
          beforeOqc: r.beforeOqc ?? 0,
          afterOqc: r.afterOqc ?? 0,
          author: r.author ?? "-",
          byRole: r.byRole as Role | undefined,
        }))
      : [],
  })

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null)
      setLoading(true)

      // ✅ Pakai axios instance (baseURL dari VITE_API_URL)
      const { data: json } = await API.get("/summary", {
        params: { take: 10 },
        signal,
      })

      const normalized = normalize(json)
      setData(normalized)
      setLastUpdated(new Date())
      retryRef.current = 0
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.name === "AbortError") return
      console.error(e)
      setError(e?.message || "Gagal memuat ringkasan")
      setData(EMPTY)
      if (autoRefresh) retryRef.current = Math.min(retryRef.current + 1, 5)
    } finally {
      setLoading(false)
    }
  }, [autoRefresh])

  // Initial + manual refresh
  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load, nonce])

  // Auto refresh (30s + backoff ringan)
  useEffect(() => {
    try { localStorage.setItem("overview_auto", autoRefresh ? "1" : "0") } catch {}
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    const schedule = () => {
      const base = 30000
      const delay = base * (retryRef.current ? Math.pow(1.5, retryRef.current) : 1)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => load(), delay)
    }
    load().then(schedule)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [autoRefresh, load])

  // Data yang ditampilkan → filter sesuai mode bila ada byRole
  const rows = useMemo(() => {
    if (kind === "ALL") return data.lastEntries
    return data.lastEntries.filter(r => !r.byRole || r.byRole === kind)
  }, [data.lastEntries, kind])

  // Export CSV: kolom menyesuaikan mode
  const exportCSV = () => {
    let headers: string[] = []
    let mapRow: (r: Summary["lastEntries"][number]) => (string | number)[]

    if (kind === "IPQC") {
      headers = [
        "Tanggal", "Produk", "Shift",
        "Before IPQC", "After IPQC",
        "Before Postcured", "After Postcured",
        "Author"
      ]
      mapRow = (r) => [
        new Date(r.date).toLocaleString("id-ID"),
        r.productName, r.shift,
        r.beforeIpqc ?? 0, r.afterIpqc ?? 0,
        r.onGoingPostcured ?? 0, r.afterPostcured ?? 0,
        r.author,
      ]
    } else if (kind === "OQC") {
      headers = ["Tanggal", "Produk", "Shift", "Before OQC", "After OQC", "Author"]
      mapRow = (r) => [
        new Date(r.date).toLocaleString("id-ID"),
        r.productName, r.shift,
        r.beforeOqc ?? 0, r.afterOqc ?? 0,
        r.author,
      ]
    } else {
      headers = [
        "Tanggal","Produk","Shift",
        "Before IPQC","After IPQC","Before Postcured","After Postcured",
        "Before OQC","After OQC","Author"
      ]
      mapRow = (r) => [
        new Date(r.date).toLocaleString("id-ID"),
        r.productName, r.shift,
        r.beforeIpqc ?? 0, r.afterIpqc ?? 0,
        r.onGoingPostcured ?? 0, r.afterPostcured ?? 0,
        r.beforeOqc ?? 0, r.afterOqc ?? 0,
        r.author,
      ]
    }

    const rowsOut = [headers, ...rows.map(mapRow)]
    const csv = rowsOut
      .map(r =>
        r.map(v => {
          const s = String(v ?? "")
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }).join(","),
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `overview-${kind.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Top bar actions */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          {kind === "IPQC" ? "Overview — IPQC"
           : kind === "OQC" ? "Overview — OQC"
           : "Overview — All Activities"}
        </h2>
        {lastUpdated && (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            Last updated: {lastUpdated.toLocaleTimeString("id-ID")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select
            className="btn-ghost"
            value={kind}
            onChange={(e)=>setKind(e.target.value as TableKind)}
            title="Pilih tampilan tabel"
          >
            <option value="IPQC">IPQC only</option>
            <option value="OQC">OQC only</option>
            <option value="ALL">All</option>
          </select>

          <button
            onClick={() => setNonce(n => n + 1)}
            className="btn-outline"
            aria-label="Refresh data"
            title="Refresh"
          >
            Refresh
          </button>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-[--color-brand]"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto refresh
          </label>
          <button onClick={exportCSV} className="btn-ghost" title="Export CSV">
            Export CSV
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200 px-3 py-2 text-sm"
        >
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="mt-3 h-7 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="mt-4 h-3 w-28 rounded bg-gray-200/80 dark:bg-gray-800/80" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Total Products" value={fmt(data.totalProducts)} />
            <Card title="Active Products" value={fmt(data.activeProducts)} />
            <Card title="Total Users" value={fmt(data.totalUsers)} />
            <Card
              title="Today's Entries"
              value={fmt((data.todayByShift.S1 ?? 0) + (data.todayByShift.S2 ?? 0) + (data.todayByShift.S3 ?? 0))}
              footer={<ShiftMiniChart todayByShift={data.todayByShift} />}
            />
          </div>

          {/* Quick actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <a href="/admin?tab=products" className="btn">Kelola Produk</a>
            <a href="/admin?tab=users" className="btn-outline">Kelola Pengguna</a>
            <a href="/ipqc" className="btn-ghost">Input IPQC</a>
            <a href="/oqc" className="btn-ghost">Input OQC</a>
          </div>

          {/* Recent Activity (mode-aware) */}
          <section className="card p-0 overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold">
                {kind === "IPQC" ? "Aktivitas IPQC Terbaru"
                 : kind === "OQC" ? "Aktivitas OQC Terbaru"
                 : "Aktivitas Terbaru"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                10 entri DailyEntry terakhir {kind !== "ALL" ? `(${kind})` : ""}.
              </p>
            </header>

            <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="table">
                <thead className="sticky top-0 bg-white/80 dark:bg-gray-900/70 backdrop-blur">
                  {kind === "IPQC" && (
                    <tr>
                      <th className="px-4 py-2">Tanggal</th>
                      <th className="px-4 py-2">Produk</th>
                      <th className="px-4 py-2">Shift</th>
                      <th className="px-4 py-2 text-right">Before IPQC</th>
                      <th className="px-4 py-2 text-right">After IPQC</th>
                      <th className="px-4 py-2 text-right">Before Postcured</th>
                      <th className="px-4 py-2 text-right">After Postcured</th>
                      <th className="px-4 py-2">Author</th>
                    </tr>
                  )}
                  {kind === "OQC" && (
                    <tr>
                      <th className="px-4 py-2">Tanggal</th>
                      <th className="px-4 py-2">Produk</th>
                      <th className="px-4 py-2">Shift</th>
                      <th className="px-4 py-2 text-right">Before OQC</th>
                      <th className="px-4 py-2 text-right">After OQC</th>
                      <th className="px-4 py-2">Author</th>
                    </tr>
                  )}
                  {kind === "ALL" && (
                    <tr>
                      <th className="px-4 py-2">Tanggal</th>
                      <th className="px-4 py-2">Produk</th>
                      <th className="px-4 py-2">Shift</th>
                      <th className="px-4 py-2 text-right">Before → After IPQC</th>
                      <th className="px-4 py-2 text-right">Before Postcured</th>
                      <th className="px-4 py-2 text-right">After Postcured</th>
                      <th className="px-4 py-2 text-right">Before OQC</th>
                      <th className="px-4 py-2 text-right">After OQC</th>
                      <th className="px-4 py-2">Author</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-2 min-w-40">{r.productName}</td>
                      <td className="px-4 py-2">{r.shift}</td>

                      {kind === "IPQC" && (
                        <>
                          <td className="px-4 py-2 text-right">{fmt(r.beforeIpqc)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.afterIpqc)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.onGoingPostcured)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.afterPostcured)}</td>
                        </>
                      )}

                      {kind === "OQC" && (
                        <>
                          <td className="px-4 py-2 text-right">{fmt(r.beforeOqc)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.afterOqc)}</td>
                        </>
                      )}

                      {kind === "ALL" && (
                        <>
                          <td className="px-4 py-2 text-right">
                            {fmt(r.beforeIpqc)} → {fmt(r.afterIpqc)}
                          </td>
                          <td className="px-4 py-2 text-right">{fmt(r.onGoingPostcured)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.afterPostcured)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.beforeOqc)}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.afterOqc)}</td>
                        </>
                      )}

                      <td className="px-4 py-2 min-w-32">{r.author}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={kind === "ALL" ? 9 : kind === "IPQC" ? 8 : 6}>
                        Belum ada aktivitas untuk mode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/* ====== UI bits ====== */

function Card({ title, value, footer }: { title: string; value: number | string; footer?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  )
}

function ShiftMiniChart({ todayByShift }: { todayByShift: Record<Shift, number> }) {
  const items = [
    { k: "S1" as Shift, v: todayByShift.S1 },
    { k: "S2" as Shift, v: todayByShift.S2 },
    { k: "S3" as Shift, v: todayByShift.S3 },
  ]
  const max = Math.max(1, ...items.map(i => i.v))
  return (
    <div className="flex items-end gap-2" aria-label="Distribusi entri per shift hari ini">
      {items.map(({ k, v }) => {
        const h = Math.round((v / max) * 36)
        return (
          <div key={k} className="grid justify-items-center gap-1">
            <div
              className="w-6 rounded-md bg-[--color-brand]/20 border border-[--color-brand]/30"
              style={{ height: `${h || 2}px` }}
              aria-label={`${k}: ${v}`}
              title={`${k}: ${v}`}
            />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{k}</span>
          </div>
        )
      })}
      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">S1/S2/S3</span>
    </div>
  )
}
