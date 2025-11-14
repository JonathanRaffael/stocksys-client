"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import API from "@/api/axios"
import { AlertCircle, CheckCircle2, Loader2, Plus, RotateCcw, Zap } from 'lucide-react'

/* ================== Types (matching Prisma) ================== */
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
  beforeIpqc: number
  afterIpqc: number
  onGoingPostcured: number
  afterPostcured: number
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
  totalBeforeIpqc: number
  totalAfterIpqc: number
  totalOnGoingPostcured: number
  totalAfterPostcured: number
  totalBeforeOqc: number
  totalAfterOqc: number
  totalHoldOrReturn: number
  netAvailable: number
  passRateIpqc: number
  passRatePostcure: number
}

type PreviousQty = {
  found: boolean
  beforeIpqc: number
  afterIpqc: number
  onGoingPostcured: number
  afterPostcured: number
  previousDate?: string
  previousShift?: string
  totalInputs?: number
}

/* ================== Helpers ================== */
const fmt = (n: number) => Intl.NumberFormat("id-ID").format(n)
const todayStr = () => new Date().toISOString().slice(0, 10)

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")
  } catch {
    return null
  }
}
function getToken() {
  try {
    return localStorage.getItem("token") || ""
  } catch {
    return ""
  }
}

/* ---- Axios-based API helpers ---- */
async function apiGet<T>(path: string) {
  try {
    const res = await API.get(path, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    return res.data as T
  } catch (error: any) {
    console.error("[IPQC] API GET error:", error?.response?.data || error?.message || error)
    throw error
  }
}
async function apiPost<T>(path: string, body: any) {
  const res = await API.post(path, body, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  return res.data as T
}
async function apiPatch<T>(path: string, body: any) {
  const res = await API.patch(path, body, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  return res.data as T
}
async function apiDelete<T>(path: string) {
  const res = await API.delete(path, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  return res.data as T
}

/* ================== Component ================== */
export default function DashboardIPQC() {
  /* -------- Filters -------- */
  const [date, setDate] = useState<string>(todayStr())
  const [shift, setShift] = useState<Shift>("S1")
  const [plant, setPlant] = useState<string>("")
  const [line, setLine] = useState<string>("")

  /* -------- Data -------- */
  const [summary, setSummary] = useState<Summary | null>(null)
  const [entries, setEntries] = useState<DailyEntryDto[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* -------- Mini toast -------- */
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  /* -------- Input Cepat state -------- */
  const [productQuery, setProductQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [beforeIpqc, setBeforeIpqc] = useState<number>(0)
  const [afterIpqc, setAfterIpqc] = useState<number>(0)
  const [afterPostcured, setAfterPostcured] = useState<number>(0)
  const [note, setNote] = useState<string>("")

  // === New: flexible flow + auto-deduct toggle ===
  const [autoKurangi, setAutoKurangi] = useState(true)
  const prevAfterSumRef = useRef(0) // track (afterIpqc + afterPostcured)

  const [previousQty, setPreviousQty] = useState<PreviousQty | null>(null)
  const [loadingPreviousQty, setLoadingPreviousQty] = useState(false)

  const productInputRef = useRef<HTMLInputElement>(null)

  /* -------- Queries -------- */
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("date", date)
    p.set("shift", shift.toUpperCase())
    if (plant) p.set("plant", plant)
    if (line) p.set("line", line)
    return p.toString()
  }, [date, shift, plant, line])

  const qsWithProduct = useMemo(() => {
    const p = new URLSearchParams()
    p.set("date", date)
    p.set("shift", shift.toUpperCase())
    if (plant) p.set("plant", plant)
    if (line) p.set("line", line)
    if (selectedProduct?.id) p.set("productId", selectedProduct.id)
    return p.toString()
  }, [date, shift, plant, line, selectedProduct?.id])

  /* -------- Loaders -------- */
  async function loadSummary() {
    const urlPrimary = `/ipqc/summary/summary?${qs}`
    const fallbackUrl = `/ipqc/summary?${qs}`

    try {
      let response: any
      try {
        response = await apiGet<any>(urlPrimary)
      } catch (e: any) {
        console.warn("[IPQC] primary summary endpoint failed, trying fallback…")
        response = await apiGet<any>(fallbackUrl)
      }

      const data: Summary = {
        totalBeforeIpqc: response.totalBeforeIpqc ?? 0,
        totalAfterIpqc: response.totalAfterIpqc ?? 0,
        totalOnGoingPostcured: response.totalOnGoingPostcured ?? 0,
        totalAfterPostcured: response.totalAfterPostcured ?? 0,
        totalBeforeOqc: response.totalBeforeOqc ?? 0,
        totalAfterOqc: response.totalAfterOqc ?? 0,
        totalHoldOrReturn: response.totalHoldOrReturn ?? 0,
        netAvailable: response.netAvailable ?? 0,
        passRateIpqc: response.passRateIpqc ?? 0,
        passRatePostcure: response.passRatePostcure ?? 0,
      }

      setSummary(data)
    } catch (e: any) {
      console.error("[IPQC] loadSummary error:", e?.message || e)
      setSummary({
        totalBeforeIpqc: 0,
        totalAfterIpqc: 0,
        totalOnGoingPostcured: 0,
        totalAfterPostcured: 0,
        totalBeforeOqc: 0,
        totalAfterOqc: 0,
        totalHoldOrReturn: 0,
        netAvailable: 0,
        passRateIpqc: 0,
        passRatePostcure: 0,
      })
    }
  }

  async function loadEntries() {
    try {
      setLoading(true)
      const raw = await apiGet<any>(`/entries?type=IPQC&${qsWithProduct}`)
      let items: DailyEntryDto[] = []
      if (Array.isArray(raw)) {
        items = raw
      } else if (raw && typeof raw === "object") {
        items = raw.items ?? raw.data ?? []
      }
      setEntries(items)
    } catch (e: any) {
      console.error("[IPQC] loadEntries error:", e?.message || e)
      setError(e.message || "Gagal memuat data")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  async function loadPreviousQty(productId: string) {
    if (!productId) {
      setPreviousQty(null)
      setBeforeIpqc(0)
      setAfterIpqc(0)
      setAfterPostcured(0)
      return
    }

    try {
      setLoadingPreviousQty(true)
      const data = await apiGet<PreviousQty>(`/entries/previous-qty?productId=${productId}&date=${date}&shift=${shift}`)
      setPreviousQty(data)

      if (data.found) {
        setBeforeIpqc(data.beforeIpqc)
        setAfterIpqc(data.afterIpqc)
        setAfterPostcured(data.afterPostcured)
        prevAfterSumRef.current = data.afterIpqc + data.afterPostcured
      } else {
        setBeforeIpqc(0)
        setAfterIpqc(0)
        setAfterPostcured(0)
        prevAfterSumRef.current = 0
      }
    } catch (e: any) {
      console.error("[IPQC] loadPreviousQty error:", e?.message || e)
      setPreviousQty(null)
      setBeforeIpqc(0)
      setAfterIpqc(0)
      setAfterPostcured(0)
      prevAfterSumRef.current = 0
    } finally {
      setLoadingPreviousQty(false)
    }
  }

  useEffect(() => {
    if (selectedProduct?.id) {
      loadSummary()
      loadEntries()
    } else {
      // If no product selected, clear entries to avoid showing entries from other products
      setEntries([])
      setSummary({
        totalBeforeIpqc: 0,
        totalAfterIpqc: 0,
        totalOnGoingPostcured: 0,
        totalAfterPostcured: 0,
        totalBeforeOqc: 0,
        totalAfterOqc: 0,
        totalHoldOrReturn: 0,
        netAvailable: 0,
        passRateIpqc: 0,
        passRatePostcure: 0,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qsWithProduct, selectedProduct?.id])

  useEffect(() => {
    if (selectedProduct?.id) {
      loadPreviousQty(selectedProduct.id)
    }
  }, [selectedProduct?.id, date, shift])

  /* -------- Product dropdown (debounced) -------- */
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
        const url = productQuery ? `/products?query=${encodeURIComponent(productQuery)}&take=50` : `/products?take=50`
        const raw = await apiGet<any>(url)
        const items: Product[] = Array.isArray(raw) ? raw : (raw.items ?? [])
        setProductOpts(items.filter((p) => p.isActive ?? true))
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

  /* -------- KPI dari server -------- */
  const passRate = summary?.passRatePostcure ?? 0
  const netAvailable = summary?.netAvailable ?? 0

  /* -------- Keyboard shortcuts for quick entry -------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (e.key.toLowerCase() === "enter") submitEntry()
      if (e.key.toLowerCase() === "escape") resetForm()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /* -------- Reset form helper -------- */
  const resetForm = () => {
    setSelectedProduct(null)
    setProductQuery("")
    setBeforeIpqc(0)
    setAfterIpqc(0)
    setAfterPostcured(0)
    setNote("")
    setError(null)
    setPreviousQty(null)
    prevAfterSumRef.current = 0
  }

  /* -------- Submit -------- */
  async function submitEntry() {
    const user = getUser()
    if (!user?.role) {
      setError("Sesi login tidak ditemukan. Silakan login ulang.")
      return
    }
    if (!selectedProduct) {
      setError("Pilih produk terlebih dulu.")
      productInputRef.current?.focus()
      return
    }
    if ([beforeIpqc, afterIpqc, afterPostcured].some((v) => v < 0)) {
      setError("Angka tidak boleh negatif.")
      return
    }

    const payload = {
      productId: selectedProduct.id,
      date,
      shift: shift.toUpperCase() as Shift,
      plant: plant || null,
      line: line || null,
      role: user.role as Role,
      beforeIpqc: beforeIpqc || 0,
      afterIpqc: afterIpqc || 0,
      onGoingPostcured: afterIpqc || 0,
      afterPostcured: afterPostcured || 0,
      beforeOqc: 0,
      afterOqc: 0,
      onHoldOrReturn: 0,
      note: note || null,
    }

    setSubmitting(true)
    setError(null)

    try {
      await apiPost("/entries", payload)
      resetForm()
      productInputRef.current?.focus()
      showToast("✓ Entri tersimpan dengan sukses")
      setSubmitting(false)

      setTimeout(async () => {
        try {
          await Promise.all([loadSummary(), loadEntries()])
        } catch (e) {
          console.error("[IPQC] reload after submit error:", e)
        }
      }, 300)
    } catch (e: any) {
      const errorMsg = e.message || "Gagal menyimpan entri"
      setError(errorMsg)
      showToast(errorMsg, "error")
      setSubmitting(false)
    }
  }

  /* -------- Inline update / delete -------- */
  async function updateEntry(id: string, patch: Partial<DailyEntryDto>) {
    const old = entries
    setEntries((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...patch } as DailyEntryDto) : e)))
    try {
      await apiPatch(`/entries/${id}`, patch)
      await loadSummary()
      showToast("✓ Perubahan disimpan")
    } catch (e: any) {
      setEntries(old)
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
      showToast("✓ Entri dihapus")
    } catch (e: any) {
      setEntries(old)
      setError(e.message || "Gagal hapus entri")
      showToast(e.message || "Gagal hapus entri", "error")
    }
  }

  /* -------- Export CSV -------- */
  function exportCsv() {
    const headers = [
      "Tanggal",
      "Shift",
      "Plant",
      "Line",
      "Kode",
      "Produk",
      "Before IPQC",
      "After IPQC / Before Postcured",
      "After Postcured",
      "Note",
    ]
    const rows = entries.map((e) => [
      e.date.slice(0, 10),
      e.shift,
      e.plant || "",
      e.line || "",
      e.product?.computerCode ?? "",
      e.product?.name ?? "",
      e.beforeIpqc,
      e.afterIpqc,
      e.afterPostcured,
      (e.note ?? "").replace(/\n/g, " "),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ipqc_${date}_${shift}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* -------- Simple hints -------- */
  const hintB = autoKurangi
    ? "Mode auto-kurangi aktif. Before akan berkurang sesuai total After."
    : "Opsional. Tidak akan otomatis berkurang."
  const hintA = "Isi hasil IPQC / alokasi ke curing (boleh tanpa Before)."
  const hintAP = "Isi hasil selesai postcure (jika ada)."

  /* -------- Handlers untuk Input Cepat -------- */

  const handleAfterPostcuredChange = (val: number) => {
    const v = Math.max(0, val)

    const deducted = v - afterPostcured // berapa yang ditambah/dikurangi
    const newAfterIpqc = Math.max(0, afterIpqc - deducted)

    setAfterPostcured(v)
    setAfterIpqc(newAfterIpqc)
  }

  const handleBeforeIpqcChange = (val: number) => {
    const v = Math.max(0, val)
    setBeforeIpqc(v)
    prevAfterSumRef.current = afterIpqc + afterPostcured
  }

  const handleAfterIpqcChange = (val: number) => {
    const v = Math.max(0, val)
    const newAfterSum = v + afterPostcured
    const diff = newAfterSum - prevAfterSumRef.current // delta in total After
    setAfterIpqc(v)

    if (autoKurangi && diff !== 0) {
      setBeforeIpqc((b) => Math.max(0, b - diff))
    }
    prevAfterSumRef.current = newAfterSum
  }

  /* -------- UI -------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-6 space-y-6">
      {/* Mini toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2",
            toast.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white",
          ].join(" ")}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Title & Filters */}
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            IPQC Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Input & monitoring inspeksi In-Process QC berdasarkan tanggal, shift, plant, dan line.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3">
          <div className="flex-1 grid grid-cols-2 sm:flex gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date-filter" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Tanggal
              </label>
              <input
                id="date-filter"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shift-filter" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Shift
              </label>
              <select
                id="shift-filter"
                value={shift}
                onChange={(e) => setShift(e.target.value as Shift)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="S1">S1</option>
                <option value="S2">S2</option>
                <option value="S3">S3</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="plant-filter" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Plant
              </label>
              <input
                id="plant-filter"
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                placeholder="HT"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="line-filter" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Line
              </label>
              <input
                id="line-filter"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="LINE-1"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
          <button
            onClick={exportCsv}
            className="h-10 rounded-lg px-4 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Before IPQC" value={fmt(summary?.totalBeforeIpqc ?? 0)} color="blue" />
        <Kpi title="After IPQC / Before Postcured" value={fmt(summary?.totalAfterIpqc ?? 0)} color="emerald" />
        <Kpi title="After Postcured" value={fmt(summary?.totalAfterPostcured ?? 0)} color="cyan" />
        <Kpi title="Net Available" value={fmt(netAvailable)} color="purple" />
        <Kpi title="Pass Rate" value={`${passRate}%`} color="rose" />
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Input Cepat IPQC</h3>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                className="rounded border-slate-300 dark:border-slate-700"
                checked={autoKurangi}
                onChange={(e) => setAutoKurangi(e.target.checked)}
              />
              Auto-kurangi Before IPQC
            </label>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Tekan <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Enter</kbd>{" "}
              untuk simpan
            </span>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-900 dark:text-rose-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
              aria-label="Tutup pesan error"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-6 grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2" ref={dropdownRef}>
            <label htmlFor="product-input" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Produk <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                id="product-input"
                ref={productInputRef}
                value={selectedProduct ? `${selectedProduct.computerCode} — ${selectedProduct.name}` : productQuery}
                onChange={(e) => {
                  setSelectedProduct(null)
                  setProductQuery(e.target.value)
                  if (!showList) setShowList(true)
                }}
                onFocus={() => setShowList(true)}
                placeholder="Klik untuk pilih / ketik untuk cari…"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
              {showList && (
                <div className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                  {loadingProducts && (
                    <div className="px-3 py-3 text-sm text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </div>
                  )}
                  {!loadingProducts && productOpts.length === 0 && (
                    <div className="px-3 py-3 text-sm text-slate-500">Tidak ada hasil</div>
                  )}
                  {!loadingProducts &&
                    productOpts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p)
                          setProductQuery("")
                          setShowList(false)
                          loadPreviousQty(p.id)
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900 dark:text-white">{p.computerCode}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {p.name} {p.size ? `• ${p.size}` : ""}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <NumberField label="Before IPQC" value={beforeIpqc} hint={hintB} onChange={handleBeforeIpqcChange} />

          <NumberField
            label="After IPQC / Before Postcured"
            value={afterIpqc}
            hint={hintA}
            onChange={handleAfterIpqcChange}
          />

          <NumberField
            label="After Postcured"
            value={afterPostcured}
            hint={hintAP}
            onChange={handleAfterPostcuredChange}
          />

          {selectedProduct && (
            <div className="md:col-span-5 p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3">
                📊 Total Qty dari Semua Penginputan
              </h4>
              {loadingPreviousQty ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat data…
                </div>
              ) : previousQty && previousQty.found ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div className="p-3 rounded bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Before IPQC</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {fmt(previousQty.beforeIpqc)}
                    </p>
                  </div>
                  <div className="p-3 rounded bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total After IPQC</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {fmt(previousQty.afterIpqc)}
                    </p>
                  </div>
                  <div className="p-3 rounded bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Ongoing Postcured</p>
                    <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
                      {fmt(previousQty.onGoingPostcured)}
                    </p>
                  </div>
                  <div className="p-3 rounded bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total After Postcured</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {fmt(previousQty.afterPostcured)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-300">Tidak ada data penginputan sebelumnya</p>
              )}
              {previousQty?.found && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                  Total {previousQty.totalInputs ?? 1} penginputan hingga Shift {previousQty.previousShift} pada tanggal{" "}
                  {previousQty.previousDate}
                </p>
              )}
            </div>
          )}

          <div className="md:col-span-5">
            <label htmlFor="note-input" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Catatan
            </label>
            <textarea
              id="note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Opsional, catatan tambahan…"
              className="w-full mt-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-none"
            />
          </div>

          <div className="md:col-span-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={submitEntry}
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Simpan Entri
                </>
              )}
            </button>
            <button
              onClick={resetForm}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={() => {
                setAfterIpqc((_) => {
                  const target = beforeIpqc
                  const newAfterSum = target + afterPostcured
                  const diff = newAfterSum - prevAfterSumRef.current
                  if (autoKurangi && diff !== 0) setBeforeIpqc((b) => Math.max(0, b - diff))
                  prevAfterSumRef.current = newAfterSum
                  return target
                })
                setAfterPostcured(0)
              }}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-300 dark:border-cyan-900 text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 hover:bg-cyan-100 dark:hover:bg-cyan-950/50 disabled:opacity-60 transition-all"
            >
              <Zap className="w-4 h-4" />
              Semua Lulus
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">Entri Hari Ini</h3>
            <p className="text-xs text-slate-500 mt-1">
              {selectedProduct ? (
                <>
                  Produk: <strong>{selectedProduct.computerCode}</strong> • Tanggal {date}, Shift {shift}
                  {plant ? `, Plant ${plant}` : ""}
                  {line ? `, Line ${line}` : ""}
                </>
              ) : (
                <>
                  Tanggal {date}, Shift {shift}
                  {plant ? `, Plant ${plant}` : ""}
                  {line ? `, Line ${line}` : ""}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {loading ? "Loading…" : `${entries.length} entri`}
            </div>
            <a
              href={`/ipqc/history?date=${encodeURIComponent(date)}&shift=${shift}${plant ? `&plant=${plant}` : ""}${line ? `&line=${line}` : ""}${selectedProduct?.id ? `&productId=${selectedProduct.id}` : ""}`}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
              title="Buka Riwayat Penginputan"
            >
              Lihat Riwayat
            </a>
          </div>
        </header>

        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch] relative">
          <table className="w-full text-sm table-fixed min-w-[1000px]">
            <colgroup>
              <col style={{ width: 280 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/50 backdrop-blur border-b border-slate-200 dark:border-slate-800">
              <tr className="text-left text-slate-600 dark:text-slate-400 font-medium">
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3 text-right">Before IPQC</th>
                <th className="px-4 py-3 text-right">After IPQC / Before Postcured</th>
                <th className="px-4 py-3 text-right">After Postcured</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3 sticky right-0 bg-slate-50 dark:bg-slate-800/50 z-20 shadow-[inset_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                entries.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                entries.map((e) => (
                  <Row
                    key={e.id}
                    entry={e}
                    onChange={(patch) => updateEntry(e.id, patch)}
                    onDelete={() => deleteEntry(e.id)}
                  />
                ))}

              {entries.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500 dark:text-slate-400" colSpan={6}>
                    <p className="font-medium">
                      {selectedProduct ? "Belum ada entri IPQC untuk produk ini" : "Pilih produk untuk melihat history entri hari ini"}
                    </p>
                    <p className="text-xs mt-1">
                      {selectedProduct ? "Gunakan form di atas untuk menambah data." : "Pilih produk terlebih dulu dari dropdown di atas"}
                    </p>
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

/* ================== Subcomponents ================== */

function NumberField({
  label,
  value,
  onChange,
  title,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  title?: string
  hint?: string
}) {
  return (
    <div title={title}>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full mt-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-right transition-all"
        placeholder="0"
      />
      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-500">
        {hint || (value === 0 ? "Belum mulai" : "")}
      </div>
    </div>
  )
}

function Row({
  entry,
  onChange,
  onDelete,
}: {
  entry: DailyEntryDto
  onChange: (patch: Partial<DailyEntryDto>) => void
  onDelete: () => void
}) {
  const [b, setB] = useState(entry.beforeIpqc)
  const [a, setA] = useState(entry.afterIpqc)
  const [ap, setAP] = useState(entry.afterPostcured)
  const [n, setN] = useState(entry.note ?? "")

  const totalSourceRef = useRef<number>(entry.beforeIpqc + entry.afterIpqc + entry.afterPostcured)
  const postTotalRefRow = useRef<number>(entry.afterIpqc + entry.afterPostcured)

  useEffect(() => {
    const initB = entry.beforeIpqc
    const initA = entry.afterIpqc
    const initAP = entry.afterPostcured
    setB(initB)
    setA(initA)
    setAP(initAP)
    setN(entry.note ?? "")

    totalSourceRef.current = initB + initA + initAP
    postTotalRefRow.current = initA + initAP
  }, [entry.id])

  const dirty =
    b !== entry.beforeIpqc || a !== entry.afterIpqc || ap !== entry.afterPostcured || n !== (entry.note ?? "")

  const src = Math.max(0, totalSourceRef.current || b + a + ap)
  const postTotal = Math.max(0, postTotalRefRow.current || a + ap)
  const sisaSumber = Math.max(0, src - (a + ap))

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800 odd:bg-slate-50/50 dark:odd:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900 dark:text-white">{entry.product?.computerCode ?? ""}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {entry.product?.name ?? ""}
          {entry.product?.size ? ` • ${entry.product.size}` : ""}
        </div>
      </td>

      <td className="px-4 py-3 text-right align-top">
        <input
          type="number"
          value={b}
          onChange={(e) => {
            const v = Math.max(0, Number(e.target.value || 0))
            const newSource = v + a + ap
            totalSourceRef.current = newSource
            const maxA = Math.max(0, newSource - ap)
            const clampedA = Math.max(0, Math.min(a, maxA))
            setA(clampedA)
            setB(Math.max(0, newSource - (clampedA + ap)))
            postTotalRefRow.current = clampedA + ap
          }}
          className="w-full text-right rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="0"
        />
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
          {src > 0 ? `Sumber: ${fmt(src)} pcs` : "Belum mulai"}
        </div>
      </td>

      <td className="px-4 py-3 text-right align-top">
        <input
          type="number"
          value={a}
          onChange={(e) => {
            const raw = Number(e.target.value || 0)
            const srcLoc = Math.max(0, totalSourceRef.current || b + a + ap)
            const maxA = Math.max(0, srcLoc - ap)
            const clamped = Math.max(0, Math.min(raw, maxA))
            setA(clamped)
            setB(Math.max(0, srcLoc - (clamped + ap)))
            postTotalRefRow.current = clamped + ap
          }}
          className="w-full text-right rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="0"
        />
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
          {a > 0
            ? `Hasil IPQC & Dialokasikan ke curing: ${fmt(a)} pcs • Sisa sumber: ${fmt(Math.max(0, sisaSumber))} pcs`
            : "Menunggu hasil IPQC"}
        </div>
      </td>

      <td className="px-4 py-3 text-right align-top">
        <input
          type="number"
          value={ap}
          onChange={(e) => {
            const raw = Number(e.target.value || 0)
            const postTotalLoc = postTotalRefRow.current || a + ap
            const maxAP = Math.max(0, postTotalLoc - a)
            const newAP = Math.max(0, Math.min(raw, maxAP))
            setAP(newAP)

            const newA = Math.max(0, postTotalLoc - newAP - a)
            setA(newA)

            const srcLoc = Math.max(0, totalSourceRef.current || b + a + ap)
            setB(Math.max(0, srcLoc - (newA + newAP)))
          }}
          className="w-full text-right rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="0"
        />
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
          {ap > 0
            ? `Selesai postcure: ${fmt(ap)} pcs • Sisa menunggu: ${fmt(Math.max(0, postTotal - ap))} pcs`
            : "Belum selesai postcure"}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="Catatan…"
        />
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{n ? "Catatan terisi" : "Opsional"}</div>
      </td>

      <td className="px-4 py-3 sticky right-0 bg-white dark:bg-slate-900 z-10 shadow-[inset_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ beforeIpqc: b, afterIpqc: a, onGoingPostcured: a, afterPostcured: ap, note: n })}
            disabled={!dirty}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title={dirty ? "Simpan perubahan" : "Tidak ada perubahan"}
            aria-label="Simpan perubahan entri"
          >
            Save
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-md border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
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

function Kpi({ title, value, color }: { title: string; value: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-900",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-900",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-900",
    },
    cyan: {
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-900",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-900",
    },
    rose: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200 dark:border-rose-900",
    },
  }

  const c = colorMap[color] || colorMap.blue

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 transition-all hover:shadow-md`}>
      <p className={`text-xs font-medium ${c.text}`}>{title}</p>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  )
}
