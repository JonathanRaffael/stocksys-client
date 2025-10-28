"use client"

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardList,
  CheckSquare,
  Headphones,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react"

type Props = { open?: boolean; onClose?: () => void }
type Role = "ADMIN" | "MASTER" | "IPQC" | "OQC"

type Item = {
  to: { pathname: string; search?: string }
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isActive?: (loc: { pathname: string }, q: URLSearchParams) => boolean
}

export default function Sidebar({ open = false, onClose }: Props) {
  const location = useLocation()
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search])

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null") } catch { return null }
  }, [])
  const role: Role = (user?.role as Role) ?? "ADMIN"

  const listRef = useRef<HTMLUListElement>(null)

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sb_collapsed") === "1" } catch { return false }
  })

  // width + persist
  useEffect(() => {
    const width = collapsed ? "5rem" : "18rem"
    document.documentElement.style.setProperty("--sbw", width)
    try { localStorage.setItem("sb_collapsed", collapsed ? "1" : "0") } catch {}
  }, [collapsed])

  // restore scroll & persist
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    try {
      const saved = Number(localStorage.getItem("sb_scroll") || 0)
      if (saved) el.scrollTop = saved
    } catch {}
    const onScroll = () => { try { localStorage.setItem("sb_scroll", String(el.scrollTop)) } catch {} }
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // close drawer on route change
  useEffect(() => { if (open && onClose) onClose() }, [location.pathname, location.search])
  // trap + esc + focus first link
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.() }
    window.addEventListener("keydown", onKey)
    setTimeout(() => { document.querySelector<HTMLAnchorElement>("[data-sb-link='1']")?.focus() }, 0)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // ===== ITEMS BY ROLE =====
  const items: Item[] = useMemo(() => {
    const ipqcMenus: Item[] = [
      {
        to: { pathname: "/ipqc", search: "" },
        label: "IPQC – Input & Monitoring",
        icon: ClipboardList,
        isActive: (l) => l.pathname === "/ipqc",
      },
      {
        to: { pathname: "/ipqc/history", search: "" },
        label: "IPQC – Riwayat",
        icon: History,
        isActive: (l) => l.pathname === "/ipqc/history",
      },
    ]

    const oqcMenus: Item[] = [
      {
        to: { pathname: "/oqc", search: "" },
        label: "OQC – Input & Monitoring",
        icon: CheckSquare,
        isActive: (l) => l.pathname === "/oqc",
      },
      {
        to: { pathname: "/oqc/history", search: "" },
        label: "OQC – Riwayat",
        icon: History,
        isActive: (l) => l.pathname === "/oqc/history",
      },
    ]

    if (role === "IPQC") return ipqcMenus

    if (role === "OQC") return oqcMenus

    if (role === "MASTER") {
      return [
        {
          to: { pathname: "/master", search: "" },
          label: "Master",
          icon: LayoutDashboard,
          isActive: (l) => l.pathname === "/master",
        },
      ]
    }

    // ===== ADMIN =====
    return [
      {
        to: { pathname: "/admin", search: "" },
        label: "Dashboard",
        icon: LayoutDashboard,
        isActive: (l, q) => l.pathname === "/admin" && !q.get("tab"),
      },
      // ⬇️ NEW: Product Totals (aggregasi per-produk)
      {
        to: { pathname: "/admin/totals", search: "" },
        label: "Product Totals",
        icon: ClipboardList,
        isActive: (l) => l.pathname === "/admin/totals",
      },
      {
        to: { pathname: "/admin", search: "?tab=products" },
        label: "Products",
        icon: Package,
        isActive: (l, q) => l.pathname === "/admin" && q.get("tab") === "products",
      },
      {
        to: { pathname: "/admin", search: "?tab=users" },
        label: "Users",
        icon: Users,
        isActive: (l, q) => l.pathname === "/admin" && q.get("tab") === "users",
      },
    ]
  }, [role])

  return (
    <>
      {/* Desktop */}
      <aside
        role="navigation"
        aria-label="Sidebar"
        className={[
          "sidebar",
          "hidden md:flex flex-col fixed top-14 left-0 bottom-0 z-40",
          "bg-slate-100 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100",
          "border-r border-slate-200 dark:border-slate-700 shadow-[inset_-1px_0_0_rgba(0,0,0,0.04)]",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "w-20" : "w-72",
        ].join(" ")}
      >
        <Header collapsed={collapsed} setCollapsed={setCollapsed} />
        <Menu ref={listRef} items={items} collapsed={collapsed} qs={qs} />
        <Footer collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <div
            className="sidebar absolute left-0 top-0 h-full w-[18rem]
                       bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100
                       border-r border-slate-200 dark:border-slate-700 shadow-xl animate-slide-in"
          >
            <Header collapsed={false} setCollapsed={() => {}} />
            <Menu items={items} collapsed={false} qs={qs} onLinkClick={onClose} />
            <Footer collapsed={false} />
          </div>
        </div>
      )}

      {/* Scoped CSS kecil */}
      <style>{`
        @keyframes slide-in { from { transform: translateX(-16px); opacity:.0 } to { transform: translateX(0); opacity:1 } }
        .animate-slide-in { animation: slide-in .22s ease-out both; }
        aside ul::-webkit-scrollbar { width: 8px }
        aside ul::-webkit-scrollbar-thumb { background: rgba(30,41,59,.2); border-radius: 8px }
        .dark aside ul::-webkit-scrollbar-thumb { background: rgba(148,163,184,.25) }
        .sidebar a { color: inherit; }
        .sidebar a:hover { color: inherit; }
      `}</style>
    </>
  )
}

function Header({
  collapsed,
  setCollapsed,
}: { collapsed: boolean; setCollapsed: (v: boolean | ((b: boolean) => boolean)) => void }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div
        className={[
          collapsed ? "flex items-center justify-center w-full" : "grid grid-cols-[2.75rem_1fr] items-center gap-3 w-full",
          "transition-all duration-200",
        ].join(" ")}
      >
        <div
          className="grid place-items-center w-11 h-11 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700
                     bg-white dark:bg-slate-800 text-blue-600 font-bold text-sm"
        >
          HT
        </div>
        {!collapsed && (
          <div className="leading-tight text-left select-none">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">PT. Hang Tong Manufactory</p>
            <p className="text-xs font-medium text-blue-600/90 dark:text-blue-400 tracking-wide">Stock-System</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg py-2 mt-1
                   text-xs font-medium text-slate-700 dark:text-slate-200
                   hover:bg-blue-50 dark:hover:bg-slate-800
                   active:scale-[0.98] transition
                   focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-blue-600 focus-visible:ring-offset-2
                   dark:focus-visible:ring-offset-slate-900"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={18} strokeWidth={2.5} /> : (<><ChevronLeft size={18} strokeWidth={2.5} /><span className="hidden sm:inline">Collapse</span></>)}
      </button>
    </div>
  )
}

const Menu = React.forwardRef<HTMLUListElement, {
  items: Item[]
  collapsed: boolean
  qs: URLSearchParams
  onLinkClick?: () => void
}>(
function MenuInner({ items, collapsed, qs, onLinkClick }, ref) {
  const location = useLocation()

  const renderItem = useCallback((item: Item, idx: number) => {
    const { to, label, icon: Icon, isActive } = item
    const active = isActive ? isActive(location as any, qs) : false

    return (
      <li key={label}>
        <NavLink
          to={to as any}
          onClick={onLinkClick}
          data-sb-link={idx === 0 ? "1" : undefined}
          className={[
            "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
            "before:content-[''] before:absolute before:left-1 before:inset-y-2 before:w-1 before:rounded-full",
            active
              ? "bg-blue-600 text-white shadow-sm before:bg-blue-600"
              : "text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 before:bg-transparent hover:text-blue-700 dark:hover:text-blue-400",
          ].join(" ")}
          title={collapsed ? label : undefined}
          aria-current={active ? "page" : undefined}
        >
          <Icon
            className={[
              "w-5 h-5 shrink-0 transition-colors",
              active ? "text-white opacity-100" : "text-inherit opacity-90 group-hover:opacity-100",
            ].join(" ")}
          />
          {!collapsed && (
            <span className={active ? "font-semibold text-white" : "font-medium"}>{label}</span>
          )}
        </NavLink>
      </li>
    )
  }, [location, qs, collapsed, onLinkClick])

  return (
    <ul ref={ref} className="flex-1 overflow-y-auto p-3 space-y-1">
      {items.map((it: Item, i: number) => renderItem(it, i))}
    </ul>
  )
})
Menu.displayName = "Menu"

function Footer({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="p-3 mt-auto">
      <a
        href="https://wa.me/6289623143027"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 text-sm rounded-lg py-2
                   text-slate-700 dark:text-slate-200
                   hover:bg-blue-50 dark:hover:bg-slate-800 transition
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <Headphones className="w-4 h-4" />
        {!collapsed && <span>IT Support</span>}
      </a>
    </div>
  )
}
