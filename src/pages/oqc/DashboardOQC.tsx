"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import API from "@/api/axios" // sesuaikan alias jika perlu

// ====== Types matching Prisma ======
type Shift = "S1" | "S2" | "S3"
type Role = "IPQC" | "OQC" | "MASTER" | "ADMIN"

type Product = {
  id: string
  name: string
  computerCode: string
  size?: string | null
  uom?: string | null
  isActive: boolean
}

type DailyEntryDto = {
  id: string
  productId: string
  product?: { name: string; computerCode: string; size?: string | null }
  date: string
  shift: Shift
  plant?: string | null
  line?: string | null

  // IPQC
  beforeIpqc: number
  afterIpqc: number

  // Postcure
  onGoingPostcured: number
  afterPostcured: number

  // OQC
  beforeOqc: number
  afterOqc: number

  onHoldOrReturn: number
  note?: string | null
  createdByUserId: string
  createdByRole: Role
  updatedByUserId?: string | null
  createdAt: string
  updatedAt: string
}

type Summary = {
  totalBeforeOqc: number
  totalAfterOqc: number
  totalHoldOrReturn: number
}

// ====== Small helpers ======
const fmt = (n: number) => Intl.NumberFormat("id-ID").format(n)
const todayStr = () => new Date().toLocaleDateString("en-CA") // YYYY-MM-DD lokal

function getUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null") } catch { return null }
}
function getToken() {
  try { return localStorage.getItem("token") || "" } catch { return "" }
}

// Axios-based helpers (tanpa prefix /api di path!)
async function apiGet<T>(path: string) {
  const res = await API.get(path, { headers: { Authorization: `Bearer ${getToken()}` } })
  return res.data as T
}
async function apiPost<T>(path: string, body: any) {
  const res = await API.post(path, body, { headers: { Authorization: `Bearer ${getToken()}` } })
  return res.data as T
}
async function apiPatch<T>(path: string, body: any) {
  const res = await API.patch(path, body, { headers: { Authorization: `Bearer ${getToken()}` } })
  return res.data as T
}
async function apiDelete<T>(path: string) {
  const res = await API.delete(path, { headers: { Authorization: `Bearer ${getToken()}` } })
  return res.data as T
}

export default function DashboardOQC() {
  // ====== Filters ======
  const [date, setDate] = useState<string>(todayStr())
  const [shift, setShift] = useState<Shift>("S1")
  const [plant, setPlant] = useState<string>("")
  const [line, setLine] = useState<string>("")

  // ====== Data ======
  const [summary, setSummary] = useState<Summary | null>(null)
  const [entries, setEntries] = useState<DailyEntryDto[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ====== Mini toast ======
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2000)
  }

  // ====== Form state (input cepat) ======
  const [productQuery, setProductQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [beforeOqc, setBeforeOqc] = useState<number>(0)
  const [afterOqc, setAfterOqc] = useState<number>(0)
  const [holdReturn, setHoldReturn] = useState<number>(0)
  const [note, setNote] = useState<string>("")
  const productInputRef = useRef<HTMLInputElement>(null)
  const sourceOqcRef = useRef<number>(0) // sumber total untuk clamp (AO + HR <= S)

  // ====== Query string ======
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("date", date)
    p.set("shift", shift)
    if (plant) p.set("plant", plant)
    if (line) p.set("line", line)
    return p.toString()
  }, [date, shift, plant, line])

  // ====== Load data ======
  async function loadSummary() {
    try {
      setError(null)
      const data = await apiGet<Summary>(`/oqc/summary?${qs}`)
      setSummary(data)
    } catch (e: any) {
      setError(e.message || "Gagal memuat ringkasan")
    }
  }

  async function loadEntries() {
    try {
      setError(null)
      setLoading(true)
      const raw = await apiGet<any>(`/entries?type=OQC&${qs}`)
      const items: DailyEntryDto[] = Array.isArray(raw) ? raw : raw?.items ?? []
      setEntries(items)
    } catch (e: any) {
      setError(e.message || "Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs])

  // ====== Product list/dropdown (debounced + outside click) ======
  const [productOpts, setProductOpts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [showList, setShowList] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!showList) return
    const fetcher = async () => {
      try {
        setLoadingProducts(true)
        const url = productQuery
          ? `/products?query=${encodeURIComponent(productQuery)}&take=50`
          : `/products?take=50`
        const raw = await apiGet<any>(url)
        const items: Product[] = Array.isArray(raw) ? raw : raw.items ?? []
        setProductOpts(items.filter((p) => p.isActive))
      } catch {
        setProductOpts([])
      } finally {
        setLoadingProducts(false)
      }
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(fetcher, 250)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [showList, productQuery])

  useEffect(() => {
    if (!showList) return
    const onDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(e.target as Node)) setShowList(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [showList])

  // ====== Keyboard shortcuts (Enter submit, Esc reset) ======
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (e.key.toLowerCase() === "enter") submitEntry()
      if (e.key.toLowerCase() === "escape") {
        setSelectedProduct(null)
        setProductQuery("")
        setBeforeOqc(0)
        setAfterOqc(0)
        setHoldReturn(0)
        setNote("")
        sourceOqcRef.current = 0
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ====== Hints (UX copy) ======
  const S = Math.max(0, sourceOqcRef.current || 0)
  const sisa = Math.max(0, S - (afterOqc + holdReturn))
  const hintBO = S > 0 ? `Sumber awal: ${fmt(S)} pcs` : "Belum ada sumber (mulai dari 0 pcs)"
  const hintAO = afterOqc > 0 ? `Lulus OQC: ${fmt(afterOqc)} pcs • Sisa sumber: ${fmt(sisa)} pcs` : "Menunggu hasil OQC"
  const hintHR = holdReturn > 0 ? `Ditahan/Diretur: ${fmt(holdReturn)} pcs • Sisa sumber: ${fmt(sisa)} pcs` : "Tidak ada hold/return"

  // ====== Create Entry (OQC) ======
  async function submitEntry() {
    const user = getUser()
    if (!user?.role) {
      setError("Sesi login tidak ditemukan. Silakan login ulang.")
      return
    }
    if (!selectedProduct) {
      productInputRef.current?.focus()
      setError("Pilih produk terlebih dulu.")
      return
    }
    if (beforeOqc < 0 || afterOqc < 0 || holdReturn < 0) {
      setError("Angka tidak boleh negatif.")
      return
    }
    if (afterOqc + holdReturn > (sourceOqcRef.current || 0)) {
      setError("After OQC + Hold/Return tidak boleh melebihi sumber (Before OQC).")
      return
    }

    const payload = {
      productId: selectedProduct.id,
      date,
      shift,
      plant: plant || null,
      line: line || null,
      role: "OQC" as Role,
      beforeIpqc: 0,
      afterIpqc: 0,
      onGoingPostcured: 0,
      afterPostcured: 0,
      beforeOqc,
      afterOqc,
      onHoldOrReturn: holdReturn,
      note: note || null,
    }

    try {
      setSubmitting(true)
      await apiPost("/entries", payload)
      // reset & refresh
      setBeforeOqc(0)
      setAfterOqc(0)
      setHoldReturn(0)
      setNote("")
      setSelectedProduct(null)
      setProductQuery("")
      sourceOqcRef.current = 0
      await Promise.all([loadSummary(), loadEntries()])
      productInputRef.current?.focus()
      showToast("Entri tersimpan")
    } catch (e: any) {
      setError(e.message || "Gagal menyimpan entri")
      showToast(e.message || "Gagal menyimpan entri", "error")
    } finally {
      setSubmitting(false)
    }
  }

  // ====== Update / Delete ======
  async function updateEntry(id: string, patch: Partial<DailyEntryDto>) {
    const old = entries
    setEntries((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...patch } as DailyEntryDto) : e)))
    try {
      await apiPatch(`/entries/${id}`, patch)
      await loadSummary()
      showToast("Perubahan disimpan")
    } catch (e: any) {
      setEntries(old) // rollback
      setError(e.message || "Gagal update entri")
      showToast(e.message || "Gagal update entri", "error")
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Hapus entri ini?")) return
    const old = entries
    setEntries((prev) => prev.filter((e) => e.id !== id))
    try {
      await apiDelete(`/entries/${id}`)
      await loadSummary()
      showToast("Entri dihapus")
    } catch (e: any) {
      setEntries(old)
      setError(e.message || "Gagal hapus entri")
      showToast(e.message || "Gagal hapus entri", "error")
    }
  }

  // ====== Export CSV (client side) ======
  function exportCsv() {
    const headers = [
      "Tanggal","Shift","Plant","Line","Kode","Produk","Before OQC","After OQC","Hold/Return","Note",
    ]
    const rows = entries.map((e) => [
      e.date.slice(0, 10),
      e.shift,
      e.plant ?? "",
      e.line ?? "",
      e.product?.computerCode ?? "",
      e.product?.name ?? "",
      e.beforeOqc,
      e.afterOqc,
      e.onHoldOrReturn,
      (e.note ?? "").replace(/\n/g, " "),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `oqc_${date}_${shift}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Mini toast */}
      {toast && (
        <div
          role="status"
          className={[
            "fixed top-16 right-4 z-50 px-3 py-2 rounded-lg text-sm shadow",
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* Title & Filters */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">OQC</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Input & monitoring inspeksi Outgoing QC berdasarkan tanggal, shift, plant, dan line.
          </p>

          {/* Helper ribbon (aturan & rumus) */}
          <div className="mt-2 text-[12px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1">
              <strong className="font-semibold">Aturan:</strong>
              Semua angka ≥ 0, dan <code className="font-mono">S = AO + HR + Sisa</code> (AO = After OQC, HR = Hold/Return).
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex gap-2">
          <div className="flex flex-col">
            <label className="text-xs text-slate-500">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-500">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as Shift)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="S1">S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-500">Plant</label>
            <input
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              placeholder="HT"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-500">Line</label>
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="LINE-1"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={exportCsv}
            className="h-9 md:h-10 self-end rounded-lg px-3 text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi title="Before OQC" value={fmt(summary?.totalBeforeOqc ?? 0)} />
        <Kpi title="After OQC" value={fmt(summary?.totalAfterOqc ?? 0)} />
        <Kpi title="On Hold / Return" value={fmt(summary?.totalHoldOrReturn ?? 0)} />
      </section>

      {/* Quick Entry */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Input Cepat OQC</h3>
            {error && <span className="text-xs text-rose-600">{error}</span>}
          </div>
          <span className="text-xs text-slate-500">Catatan: <strong>After Postcured (IPQC)</strong> biasanya menjadi <strong>Before OQC</strong>.</span>
        </header>

        <div className="p-4 grid gap-3 md:grid-cols-7">
          {/* Product picker */}
          <div className="md:col-span-3" ref={dropdownRef}>
            <label className="text-xs text-slate-500">Produk</label>
            <div className="relative">
              <input
                ref={productInputRef}
                value={selectedProduct ? `${selectedProduct.computerCode} — ${selectedProduct.name}` : productQuery}
                onChange={(e) => {
                  setSelectedProduct(null)
                  setProductQuery(e.target.value)
                  if (!showList) setShowList(true)
                }}
                onFocus={() => setShowList(true)}
                placeholder="Klik untuk pilih / ketik untuk cari…"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40"
              />
              {showList && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow">
                  {loadingProducts && <div className="px-3 py-2 text-sm text-slate-500">Loading…</div>}
                  {!loadingProducts && productOpts.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">Tidak ada hasil</div>
                  )}
                  {!loadingProducts &&
                    productOpts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p)
                          setProductQuery("")
                          setShowList(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <div className="font-medium">{p.computerCode}</div>
                        <div className="text-slate-500">
                          {p.name} {p.size ? `• ${p.size}` : ""}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Before OQC */}
          <NumberField
            label="Before OQC"
            value={beforeOqc}
            hint={hintBO}
            onChange={(val) => {
              const src = Math.max(0, val)
              sourceOqcRef.current = src
              // clamp AO + HR <= S
              const newAO = Math.min(Math.max(0, afterOqc), Math.max(0, src - holdReturn))
              const newHR = Math.min(Math.max(0, holdReturn), Math.max(0, src - newAO))
              setAfterOqc(newAO)
              setHoldReturn(newHR)
              setBeforeOqc(Math.max(0, src - (newAO + newHR)))
            }}
          />

          {/* After OQC */}
          <NumberField
            label="After OQC"
            value={afterOqc}
            hint={hintAO}
            onChange={(raw) => {
              const src = Math.max(0, sourceOqcRef.current || 0)
              const clampedAO = Math.max(0, Math.min(Math.max(0, raw), Math.max(0, src - holdReturn)))
              setAfterOqc(clampedAO)
              setBeforeOqc(Math.max(0, src - (clampedAO + holdReturn)))
            }}
          />

          {/* Hold / Return */}
          <NumberField
            label="On Hold / Return"
            value={holdReturn}
            hint={hintHR}
            onChange={(raw) => {
              const src = Math.max(0, sourceOqcRef.current || 0)
              const clampedHR = Math.max(0, Math.min(Math.max(0, raw), Math.max(0, src - afterOqc)))
              setHoldReturn(clampedHR)
              setBeforeOqc(Math.max(0, src - (afterOqc + clampedHR)))
            }}
          />

          <div className="md:col-span-7">
            <label className="text-xs text-slate-500">Catatan</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Opsional, catatan tambahan…"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40"
            />
          </div>

          <div className="md:col-span-7 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={submitEntry}
              disabled={submitting}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Menyimpan…" : "Simpan Entri"}
            </button>
            <button
              onClick={() => {
                setSelectedProduct(null)
                setProductQuery("")
                setBeforeOqc(0)
                setAfterOqc(0)
                setHoldReturn(0)
                setNote("")
                sourceOqcRef.current = 0
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Reset
            </button>
            <button
              onClick={() => {
                const src = Math.max(0, sourceOqcRef.current || 0)
                setAfterOqc(src)
                setHoldReturn(0)
                setBeforeOqc(0)
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              Semua Lulus (OQC)
            </button>
          </div>
        </div>
      </section>

      {/* Entries table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Entri Hari Ini</h3>
            <p className="text-xs text-slate-500">
              Tanggal {date}, Shift {shift}
              {plant ? `, Plant ${plant}` : ""}
              {line ? `, Line ${line}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-500">{loading ? "Loading…" : `${entries.length} entri`}</div>
            <a
              href={`/oqc/history?date=${encodeURIComponent(date)}&shift=${shift}${plant ? `&plant=${plant}` : ""}${line ? `&line=${line}` : ""}`}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
              title="Buka Riwayat Penginputan"
            >
              Lihat Riwayat Penginputan
            </a>
          </div>
        </header>

        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch] relative">
          <table className="w-full text-sm table-fixed min-w-[1100px]">
            <colgroup>
              <col style={{ width: 280 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-2">Produk</th>
                <th className="px-4 py-2 text-right">Before OQC</th>
                <th className="px-4 py-2 text-right">After OQC</th>
                <th className="px-4 py-2 text-right">Hold/Return</th>
                <th className="px-4 py-2">Catatan</th>
                <th className="px-4 py-2 sticky right-0 bg-white/95 dark:bg-slate-900/90 backdrop-blur z-20 shadow-[inset_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && entries.map((e) => (
                <Row key={e.id} entry={e} onChange={(patch) => updateEntry(e.id, patch)} onDelete={() => deleteEntry(e.id)} />
              ))}

              {entries.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Belum ada entri OQC untuk kombinasi filter ini. <span className="text-slate-400">Gunakan “Input Cepat OQC” di atas untuk menambah data.</span>
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

// ====== Subcomponents ======
function NumberField({ label, value, onChange, title, hint }: { label: string; value: number; onChange: (v: number) => void; title?: string; hint?: string }) {
  return (
    <div title={title}>
      <label className="text-xs text-slate-500">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 text-right"
        placeholder="0"
      />
      <div className="mt-1 text-[11px] text-slate-400">{hint || (value === 0 ? "Belum mulai" : "")}</div>
    </div>
  )
}

function Row({ entry, onChange, onDelete }: { entry: DailyEntryDto; onChange: (patch: Partial<DailyEntryDto>) => void; onDelete: () => void }) {
  const [bo, setBO] = useState(entry.beforeOqc)
  const [ao, setAO] = useState(entry.afterOqc)
  const [hr, setHR] = useState(entry.onHoldOrReturn)
  const [n, setN] = useState(entry.note ?? "")
  const sourceRef = useRef<number>(entry.beforeOqc)

  useEffect(() => {
    setBO(entry.beforeOqc)
    setAO(entry.afterOqc)
    setHR(entry.onHoldOrReturn)
    setN(entry.note ?? "")
    sourceRef.current = entry.beforeOqc
  }, [entry.id])

  // Clamp invariants: AO + HR <= S, BO = S - (AO + HR)
  const S = Math.max(0, sourceRef.current || 0)
  const sisa = Math.max(0, S - (ao + hr))
  const dirty = bo !== entry.beforeOqc || ao !== entry.afterOqc || hr !== entry.onHoldOrReturn || n !== (entry.note ?? "")

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800 odd:bg-slate-50/60 dark:odd:bg-slate-800/30">
      <td className="px-4 py-2">
        <div className="font-medium">{entry.product?.computerCode ?? ""}</div>
        <div className="text-slate-500">{entry.product?.name ?? ""}{entry.product?.size ? ` • ${entry.product.size}` : ""}</div>
      </td>

      <td className="px-4 py-2 text-right align-top">
        <input
          type="number"
          value={bo}
          onChange={(e) => {
            const src = Math.max(0, Number(e.target.value || 0))
            sourceRef.current = src
            const clampedAO = Math.max(0, Math.min(ao, Math.max(0, src - hr)))
            const clampedHR = Math.max(0, Math.min(hr, Math.max(0, src - clampedAO)))
            setAO(clampedAO)
            setHR(clampedHR)
            setBO(Math.max(0, src - (clampedAO + clampedHR)))
          }}
          className="w-full text-right rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          placeholder="0"
        />
        <div className="mt-1 text-[11px] text-slate-400">{S > 0 ? `Sumber: ${fmt(S)} pcs` : "Belum mulai"}</div>
      </td>

      <td className="px-4 py-2 text-right align-top">
        <input
          type="number"
          value={ao}
          onChange={(e) => {
            const src = Math.max(0, sourceRef.current || 0)
            const raw = Number(e.target.value || 0)
            const clamped = Math.max(0, Math.min(raw, Math.max(0, src - hr)))
            setAO(clamped)
            setBO(Math.max(0, src - (clamped + hr)))
          }}
          className="w-full text-right rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          placeholder="0"
        />
        <div className="mt-1 text-[11px] text-slate-400">{ao > 0 ? `Lulus OQC: ${fmt(ao)} pcs • Sisa sumber: ${fmt(sisa)} pcs` : "Menunggu hasil OQC"}</div>
      </td>

      <td className="px-4 py-2 text-right align-top">
        <input
          type="number"
          value={hr}
          onChange={(e) => {
            const src = Math.max(0, sourceRef.current || 0)
            const raw = Number(e.target.value || 0)
            const clamped = Math.max(0, Math.min(raw, Math.max(0, src - ao)))
            setHR(clamped)
            setBO(Math.max(0, src - (ao + clamped)))
          }}
          className="w-full text-right rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          placeholder="0"
        />
        <div className="mt-1 text-[11px] text-slate-400">{hr > 0 ? `Ditahan/Diretur: ${fmt(hr)} pcs • Sisa sumber: ${fmt(sisa)} pcs` : "Tidak ada hold/return"}</div>
      </td>

      <td className="px-4 py-2 align-top">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          placeholder="Catatan…"
        />
        <div className="mt-1 text-[11px] text-slate-400">{n ? "Catatan terisi" : "Opsional"}</div>
      </td>

      <td className="px-4 py-2 sticky right-0 bg-white dark:bg-slate-900 z-10 shadow-[inset_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ beforeOqc: bo, afterOqc: ao, onHoldOrReturn: hr, note: n })}
            disabled={!dirty}
            className="px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            title={dirty ? "Simpan perubahan" : "Tidak ada perubahan"}
            aria-label="Simpan perubahan entri"
          >
            Save
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            title="Hapus entri"
            aria-label="Hapus entri"
          >
            Del
          </button>
        </div>
      </td>
    </tr>
  )
}

// ====== KPI card ======
function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
