"use client"

import { useEffect, useMemo, useState, lazy, Suspense, useRef } from "react"
import { useSearchParams } from "react-router-dom"

// === Types
type Tab = "overview" | "products" | "users"

// === Lazy Panels
const OverviewPanel = lazy(() => import("./admin/OverviewPanel"))
const ProductsPanel = lazy(() => import("./admin/ProductsPanel"))
const UsersPanel    = lazy(() => import("./admin/UsersPanel"))

// === Small helpers
function isMacLike() {
  if (typeof navigator === "undefined") return false
  return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)
}

export default function DashboardAdmin() {
  const [params, setParams] = useSearchParams()

  // Default ke "overview" (tanpa ?tab=). Simpan preferensi terakhir.
  const initialTab: Tab =
    (params.get("tab") as Tab | null) ??
    ((sessionStorage.getItem("admin_tab") as Tab | null) || "overview")

  const [tab, setTab] = useState<Tab>(initialTab)
  const contentRef = useRef<HTMLDivElement>(null)

  // Pusat definisi tab
  const TABS = useMemo(
    () =>
      [
        { key: "overview", label: "Overview", hotkey: `${isMacLike() ? "⌘" : "Ctrl+"}0` },
        { key: "products", label: "Products", hotkey: `${isMacLike() ? "⌘" : "Ctrl+"}1` },
        { key: "users",    label: "Users",    hotkey: `${isMacLike() ? "⌘" : "Ctrl+"}2` },
      ] as const,
    []
  )

  // URL -> state
  const urlTab = (params.get("tab") as Tab | null) ?? "overview"
  useEffect(() => {
    if (urlTab !== tab) setTab(urlTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab])

  // Persist & document title
  useEffect(() => {
    sessionStorage.setItem("admin_tab", tab)
    document.title =
      tab === "overview" ? "Admin • Overview" :
      tab === "products" ? "Admin • Products" : "Admin • Users"
    // Scroll ke top panel saat ganti tab (biar UX enak)
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [tab])

  // Hotkeys: Ctrl/⌘ + 0/1/2
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = isMacLike() ? e.metaKey : e.ctrlKey
      if (!meta) return
      if (["0","1","2"].includes(e.key)) e.preventDefault()
      if (e.key === "0") choose("overview")
      if (e.key === "1") choose("products")
      if (e.key === "2") choose("users")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (t: Tab) => {
    setTab(t)
    // overview = default (tanpa ?tab), lainnya pakai ?tab=
    setParams(t === "overview" ? {} : { tab: t }, { replace: true })
  }

  return (
    <div className="px-4 md:px-6 pt-2 pb-6 space-y-4 md:space-y-6">
      {/* ====== Page Header ====== */}
      <div className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500 dark:text-gray-400">
          <ol className="inline-flex items-center gap-1">
            <li className="truncate">Admin</li>
            <li aria-hidden className="opacity-50">/</li>
            <li className="truncate capitalize">{tab}</li>
          </ol>
        </nav>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Kelola produk, pengguna, & ringkasan aktivitas.
              <span className="hidden sm:inline"> Gunakan {TABS[0].hotkey}/{TABS[1].hotkey}/{TABS[2].hotkey} untuk pindah tab.</span>
            </p>
          </div>

          {/* Slot aksi kanan (misal tombol global) */} 
          <div className="hidden md:flex items-center gap-2">
            {/* Contoh placeholder:
            <button className="btn-ghost">Refresh</button>
            <button className="btn">New</button>
            */}
          </div>
        </div>
      </div>

      {/* ====== Sticky Tabs ====== */}
      <div
        className="sticky top-14 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2
                   bg-white/70 dark:bg-gray-900/50 backdrop-blur
                   border-b border-gray-200/70 dark:border-gray-800/70"
      >
        {/* Mobile Select */}
        <label className="md:hidden sr-only" htmlFor="admin-tab">Pilih tab</label>
        <select
          id="admin-tab"
          className="md:hidden block w-full max-w-xs rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          value={tab}
          onChange={(e) => choose(e.target.value as Tab)}
        >
          {TABS.map(t => (<option key={t.key} value={t.key}>{t.label}</option>))}
        </select>

        {/* Desktop Segmented */}
        <div
          role="tablist"
          aria-label="Admin sections"
          className="hidden md:flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700
                     bg-white/70 dark:bg-gray-800/60 backdrop-blur p-1 shadow-sm"
        >
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.key}`}
                onClick={() => choose(t.key)}
                className={[
                  "relative px-4 py-2 rounded-lg text-sm font-medium transition outline-none",
                  active
                    ? "bg-[--color-brand] text-white shadow"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 focus-visible:ring-2 focus-visible:ring-[--color-brand]",
                ].join(" ")}
                title={t.hotkey}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ====== Panels ====== */}
      <div
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={tab}
        className="transition-opacity duration-300"
        // Panel scrollable (tetap dalam page), enak buat table panjang
        ref={contentRef}
      >
        <Suspense fallback={<PanelsFallback tab={tab} />}>
          {tab === "overview" && <OverviewPanel />}
          {tab === "products" && <ProductsPanel />}
          {tab === "users" && <UsersPanel />}
        </Suspense>
      </div>
    </div>
  )
}

/* ====== Fallback Skeletons (lebih “hidup”) ====== */
function PanelsFallback({ tab }: { tab: Tab }) {
  return (
    <div className="space-y-6">
      {/* Top cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="mt-3 h-7 w-20 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="mt-4 h-3 w-28 rounded bg-gray-200/80 dark:bg-gray-800/80 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3 grid grid-cols-12 gap-4">
              <div className="col-span-4 h-4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="col-span-3 h-4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="col-span-3 h-4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="col-span-2 h-4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Hint hotkey */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Memuat {tab}… tekan {isMacLike() ? "⌘" : "Ctrl+"}{tab === "overview" ? "0" : tab === "products" ? "1" : "2"} untuk navigasi cepat.
      </p>
    </div>
  )
}
