"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import API from "@/api/axios"

/* ================== Types ================== */
type Shift = "S1" | "S2" | "S3"
type Role = "IPQC" | "OQC" | "MASTER" | "ADMIN"
type HistoryAction = "CREATE" | "UPDATE" | "DELETE"

type EntryHistoryDto = {
  id: string
  dailyEntryId?: string | null
  productId?: string | null
  productCode: string
  productName: string
  productSize?: string | null
  date: string
  shift: Shift
  action: HistoryAction
  byUserId: string
  byRole: Role
  note?: string | null
  changes?: Record<string, { old: any; new: any }> | null
  snapshot?: any
  createdAt: string
}

/* ================== Helpers ================== */
const todayStr = () => new Date().toLocaleDateString("en-CA")
const fmt = (n: number) => Intl.NumberFormat("id-ID").format(n)

function getToken() {
  try {
    return localStorage.getItem("token") || ""
  } catch {
    return ""
  }
}

type FinalKeys = "beforeIpqc" | "afterIpqc" | "afterPostcured" | "note"
function pickFinal(h: EntryHistoryDto, key: FinalKeys) {
  const fromChanges = (h.changes as any)?.[key]?.new
  if (fromChanges !== undefined && fromChanges !== null) return fromChanges
  const snap = (h.snapshot || {}) as any
  if (snap && snap[key] !== undefined && snap[key] !== null) return snap[key]
  return key === "note" ? "" : 0
}

const validShift = (s: string | null | undefined): Shift => (s === "S1" || s === "S2" || s === "S3" ? s : "S1")

const getProductSize = (h: EntryHistoryDto): string | null => {
  return (h as any).productSize ?? h.snapshot?.product?.size ?? h.snapshot?.size ?? null
}

function dayRangeLocalISO(dateYYYYMMDD: string) {
  const start = new Date(`${dateYYYYMMDD}T00:00:00`)
  const end = new Date(`${dateYYYYMMDD}T23:59:59.999`)
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}

/* ================== Component ================== */
export default function IPQCHistory() {
  const initialURL = typeof window !== "undefined" ? new URL(window.location.href) : null
  const qDate = initialURL?.searchParams.get("date") ?? todayStr()
  const qShift = validShift(initialURL?.searchParams.get("shift"))
  const qPlant = initialURL?.searchParams.get("plant") ?? ""
  const qLine = initialURL?.searchParams.get("line") ?? ""

  const [date, setDate] = useState<string>(qDate)
  const [shift, setShift] = useState<Shift>(qShift)
  const [plant, setPlant] = useState<string>(qPlant)
  const [line, setLine] = useState<string>(qLine)
  const [histQuery, setHistQuery] = useState("")
  const [histOnlyMine, setHistOnlyMine] = useState(false)

  const [debouncedQuery, setDebouncedQuery] = useState(histQuery)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(histQuery), 300)
    return () => clearTimeout(t)
  }, [histQuery])

  const [items, setItems] = useState<EntryHistoryDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const take = 20

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("type", "IPQC")
    p.set("date", date)
    const { dateFrom, dateTo } = dayRangeLocalISO(date)
    p.set("dateFrom", dateFrom)
    p.set("dateTo", dateTo)
    p.set("shift", shift)
    if (plant) p.set("plant", plant)
    if (line) p.set("line", line)
    if (debouncedQuery) p.set("q", debouncedQuery)
    if (histOnlyMine) p.set("by", "me")
    p.set("page", String(page))
    p.set("take", String(take))
    return p.toString()
  }, [date, shift, plant, line, debouncedQuery, histOnlyMine, page])

  const abortRef = useRef<AbortController | null>(null)

  async function loadHistory() {
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac

    try {
      setError(null)
      setLoading(true)
      const res = await API.get(`/history?${qs}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        signal: ac.signal,
      })
      const raw = res.data
      const nextItems: EntryHistoryDto[] = Array.isArray(raw) ? raw : (raw?.items ?? [])
      const nextTotal: number = Array.isArray(raw) ? nextItems.length : (raw?.total ?? nextItems.length)
      setItems(nextItems)
      setTotal(nextTotal)
    } catch (e: any) {
      if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
        setError(e?.message || "Gagal memuat riwayat")
        setItems([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [date, shift, plant, line])
  useEffect(() => {
    loadHistory()
  }, [qs])
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const p = new URLSearchParams()
    p.set("date", date)
    p.set("shift", shift)
    if (plant) p.set("plant", plant)
    if (line) p.set("line", line)
    if (histOnlyMine) p.set("by", "me")
    if (debouncedQuery) p.set("q", debouncedQuery)
    if (page > 1) p.set("page", String(page))
    const next = `${window.location.pathname}?${p.toString()}`
    window.history.replaceState(null, "", next)
  }, [date, shift, plant, line, debouncedQuery, histOnlyMine, page])

  function exportCSV() {
    const header = [
      "Waktu",
      "Aksi",
      "Produk",
      "Tanggal",
      "Shift",
      "Before IPQC",
      "After IPQC / Before Postcured",
      "After Postcured",
      "Catatan",
      "User",
      "Role",
    ]
    const rows = items.map((h) => {
      const b = Number(pickFinal(h, "beforeIpqc") || 0)
      const a = Number(pickFinal(h, "afterIpqc") || 0)
      const ap = Number(pickFinal(h, "afterPostcured") || 0)
      const n = String(pickFinal(h, "note") || "")
      const size = getProductSize(h)
      return [
        new Date(h.createdAt).toLocaleString("id-ID"),
        h.action,
        `${h.productCode} — ${h.productName}${size ? ` • ${size}` : ""}`,
        h.date.slice(0, 10),
        h.shift,
        b,
        a,
        ap,
        n.replace(/[\r\n]+/g, " "),
        h.byUserId,
        h.byRole,
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ipqc_history_${date}_${shift}${plant ? `_${plant}` : ""}${line ? `_${line}` : ""}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const counts = useMemo(() => {
    const c = { CREATE: 0, UPDATE: 0, DELETE: 0 }
    for (const it of items) c[it.action]++
    return c
  }, [items])

  const startIdx = (page - 1) * take + 1
  const endIdx = Math.min(page * take, total || page * take)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            IPQC – Riwayat Penginputan
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
            Telusuri semua aktivitas input/update/hapus berdasarkan tanggal, shift, plant, dan line
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3">
          <div className="flex-1 grid grid-cols-2 sm:flex gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="date-filter"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide"
              >
                Tanggal
              </label>
              <input
                id="date-filter"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="shift-filter"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide"
              >
                Shift
              </label>
              <select
                id="shift-filter"
                value={shift}
                onChange={(e) => setShift(e.target.value as Shift)}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-transparent transition-all"
              >
                <option value="S1">S1</option>
                <option value="S2">S2</option>
                <option value="S3">S3</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="plant-filter"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide"
              >
                Plant
              </label>
              <input
                id="plant-filter"
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                placeholder="HT"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="line-filter"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide"
              >
                Line
              </label>
              <input
                id="line-filter"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="LINE-1"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <input
              value={histQuery}
              onChange={(e) => {
                setHistQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Cari kode/nama produk…"
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-transparent transition-all"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 select-none">🔎</span>
            {histQuery && (
              <button
                onClick={() => {
                  setHistQuery("")
                  setPage(1)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Clear"
              >
                ×
              </button>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={histOnlyMine}
              onChange={(e) => {
                setHistOnlyMine(e.target.checked)
                setPage(1)
              }}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
            />
            Hanya riwayat saya
          </label>

          <div className="hidden sm:flex items-center gap-1 ml-2">
            <button
              onClick={() => {
                setDate(todayStr())
                setPage(1)
              }}
              className="px-2 py-1 rounded-md text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Hari ini
            </button>
            <button
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 1)
                setDate(d.toLocaleDateString("en-CA"))
                setPage(1)
              }}
              className="px-2 py-1 rounded-md text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Kemarin
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            Export CSV
          </button>
          <div className="text-sm text-slate-500" aria-live="polite">
            {loading ? "Loading…" : total > 0 ? `Total ${total} log` : "Tidak ada data"}
          </div>
        </div>
      </div>

      {/* Mobile: Card list */}
      <section className="md:hidden space-y-3">
        {loading && items.length === 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-slate-500 text-sm">Belum ada log untuk kombinasi filter ini.</div>
        )}
        {items.map((h) => {
          const b = Number(pickFinal(h, "beforeIpqc") || 0)
          const a = Number(pickFinal(h, "afterIpqc") || 0)
          const ap = Number(pickFinal(h, "afterPostcured") || 0)
          const n = String(pickFinal(h, "note") || "")
          const size = getProductSize(h)
          return (
            <div
              key={h.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString("id-ID")}</div>
                <span
                  className={
                    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 " +
                    (h.action === "CREATE"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800"
                      : h.action === "UPDATE"
                        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800"
                        : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800")
                  }
                >
                  {h.action}
                </span>
              </div>
              <div className="mt-2">
                <div className="font-medium text-slate-900 dark:text-white">{h.productCode}</div>
                <div className="text-slate-500 text-sm">
                  {h.productName}
                  {size ? ` • ${size}` : ""}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {h.date.slice(0, 10)} • {h.shift}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs">Before IPQC</span>
                  <span className="tabular-nums font-medium mt-1">{fmt(b)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs">After IPQC</span>
                  <span className="tabular-nums font-medium mt-1">{fmt(a)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs">After PC</span>
                  <span className="tabular-nums font-medium mt-1">{fmt(ap)}</span>
                </div>
              </div>
              <div className="mt-3 text-sm">
                <div className="text-slate-500 text-xs">Catatan</div>
                <div className="truncate text-slate-900 dark:text-white" title={n}>
                  {n || "-"}
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Oleh: <span className="font-medium">{h.byUserId.slice(0, 8)}</span> • {h.byRole}
              </div>
              {h.changes && Object.keys(h.changes).length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                    {Object.keys(h.changes).length} field berubah
                  </summary>
                  <div className="mt-1 space-y-1 p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {Object.entries(h.changes).map(([k, v]: any) => (
                      <div key={k} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-baseline">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-400">→</span>
                        <span />
                        <span className="text-rose-600 font-mono text-right line-through">{String(v?.old ?? "")}</span>
                        <span />
                        <span className="text-emerald-600 font-mono font-semibold">{String(v?.new ?? "")}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </section>

      {/* Desktop / Tablet: Table */}
      <section className="hidden md:block rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {error && (
          <div className="px-6 py-3 text-rose-600 text-sm border-b border-slate-200 dark:border-slate-800">{error}</div>
        )}

        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch] relative rounded-lg">
          <table className="w-full text-sm table-fixed md:min-w-[1200px]">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-left text-slate-700 dark:text-slate-300 font-semibold">
                <th className="px-4 py-3" style={{ width: 180 }}>
                  Waktu
                </th>
                <th className="px-4 py-3" style={{ width: 90 }}>
                  Aksi
                </th>
                <th className="px-4 py-3" style={{ width: 260 }}>
                  Produk
                </th>
                <th className="px-4 py-3" style={{ width: 140 }}>
                  Tanggal/Shift
                </th>
                <th className="px-4 py-3 text-right" style={{ width: 120 }}>
                  Before IPQC
                </th>
                <th className="px-4 py-3 text-right" style={{ width: 140 }}>
                  After IPQC / Before Postcured
                </th>
                <th className="px-4 py-3 text-right" style={{ width: 120 }}>
                  After Postcured
                </th>
                <th className="px-4 py-3" style={{ width: 260 }}>
                  Catatan
                </th>
                <th className="px-4 py-3" style={{ width: 130 }}>
                  Oleh (Role)
                </th>
                <th className="px-4 py-3" style={{ width: 90 }}>
                  Δ
                </th>
              </tr>
            </thead>

            <tbody>
              {loading &&
                items.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {items.map((h) => {
                const b = Number(pickFinal(h, "beforeIpqc") || 0)
                const a = Number(pickFinal(h, "afterIpqc") || 0)
                const ap = Number(pickFinal(h, "afterPostcured") || 0)
                const n = String(pickFinal(h, "note") || "")
                const size = getProductSize(h)

                return (
                  <tr
                    key={h.id}
                    className="border-t border-slate-100 dark:border-slate-800 align-top odd:bg-slate-50/60 dark:odd:bg-slate-800/30 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-slate-900 shadow-[inset_-1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]">
                      {new Date(h.createdAt).toLocaleString("id-ID")}
                    </td>

                    <td className="px-4 py-2">
                      <span
                        className={
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 " +
                          (h.action === "CREATE"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800"
                            : h.action === "UPDATE"
                              ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800"
                              : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800")
                        }
                      >
                        {h.action}
                      </span>
                    </td>

                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{h.productCode}</div>
                      <div className="text-slate-500 text-xs">
                        {h.productName}
                        {size ? ` • ${size}` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {h.date.slice(0, 10)} • {h.shift}
                    </td>

                    <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(b)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(a)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(ap)}</td>

                    <td className="px-4 py-2 text-sm">
                      <div className="max-w-[320px] truncate text-slate-900 dark:text-white" title={n}>
                        {n || "-"}
                      </div>
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div className="font-medium text-slate-900 dark:text-white">{h.byUserId.slice(0, 8)}</div>
                      <div className="text-slate-500 text-xs">{h.byRole}</div>
                    </td>

                    <td className="px-4 py-2 sticky right-0 z-10 bg-white dark:bg-slate-900 shadow-[inset_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]">
                      {h.changes && Object.keys(h.changes).length > 0 ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                            {Object.keys(h.changes).length} field
                          </summary>
                          <div className="mt-1 space-y-1 p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                            {Object.entries(h.changes).map(([k, v]: any) => (
                              <div key={k} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-baseline">
                                <span className="text-slate-500">{k}</span>
                                <span className="text-slate-400 text-[11px]">→</span>
                                <span />
                                <span className="text-rose-600 font-mono text-right line-through">
                                  {String(v?.old ?? "")}
                                </span>
                                <span />
                                <span className="text-emerald-600 font-mono font-semibold">{String(v?.new ?? "")}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {items.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={10}>
                    Belum ada log untuk kombinasi filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Prev
          </button>
          <div className="text-sm text-slate-500" aria-live="polite">
            {loading
              ? "Loading…"
              : total > 0
                ? `Halaman ${page} • ${startIdx}–${endIdx} dari ${total}`
                : `Halaman ${page}`}
          </div>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page * take >= total}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  )
}
