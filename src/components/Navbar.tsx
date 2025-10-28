"use client"

import { useLayoutEffect, useState, useEffect, useMemo } from "react"
import { Menu, Sun, Moon, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"

type Props = { onMenuClick?: () => void }
type Theme = "light" | "dark"

export default function Navbar({ onMenuClick }: Props) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState<Theme>("light")

  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    root.classList.toggle("dark", t === "dark")
    root.style.colorScheme = t
    try { localStorage.setItem("theme", t) } catch {}
  }

  useLayoutEffect(() => {
    let initial: Theme = "light"
    try {
      const saved = localStorage.getItem("theme") as Theme | null
      if (saved === "dark" || saved === "light") initial = saved
    } catch {}
    setTheme(initial)
    applyTheme(initial)
  }, [])

  useEffect(() => { applyTheme(theme) }, [theme])

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null") } catch { return null }
  }, [])

  const initials = (user?.name ?? "U")
    .split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase()

  return (
    <header
  role="banner"
  className={[
    "fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between",
    "px-3 md:px-6",
    "bg-slate-100 dark:bg-slate-900/60",
    "text-slate-800 dark:text-slate-100",
    "border-b border-slate-200 dark:border-slate-700",
    // samain arah shadow-nya dengan sidebar
    "shadow-[inset_-1px_0_0_rgba(0,0,0,0.04)]",
    "transition-colors duration-200",
  ].join(" ")}
  style={{ backdropFilter: "none" }}
>

      {/* LEFT: Brand + Menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onMenuClick?.()}
          aria-label="Open sidebar"
          className="md:hidden p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/60
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Menu className="w-5 h-5" aria-hidden />
        </button>

        {/* Logo Tile (mobile) */}
        <div className="grid md:hidden place-items-center w-8 h-8 rounded-xl
                        bg-white dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 shadow-sm
                        ring-1 ring-slate-200 dark:ring-slate-700">
          <span className="text-[10px] font-bold tracking-wide">HT</span>
        </div>

        <span className="font-semibold tracking-tight text-sm md:text-base text-pretty">
          HT Stock QC
        </span>
      </div>

      {/* RIGHT: Theme + User + Logout */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          className="p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/60
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}
          title={theme === "light" ? "Dark mode" : "Light mode"}
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* User Card */}
        <div
          className="hidden sm:flex items-center gap-3 pl-1 pr-3 py-1.5 rounded-full
                     bg-white dark:bg-slate-900/60
                     border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold bg-blue-600 text-white">
              {initials}
            </div>
            <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70 dark:ring-slate-900/70" />
          </div>

          <div className="leading-tight min-w-0">
            <div className="text-sm font-medium truncate max-w-[10rem]">
              {user?.name ?? "User"}
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="inline-flex items-center px-2 py-[2px] rounded-full uppercase
                               bg-blue-600/10 text-blue-700 dark:text-blue-300
                               dark:bg-blue-600/20 border border-blue-600/20">
                {user?.role ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            try { localStorage.removeItem("token"); localStorage.removeItem("user") } catch {}
            navigate("/login", { replace: true })
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
                     border border-slate-200 dark:border-slate-700
                     bg-white dark:bg-slate-900/60
                     text-slate-900 dark:text-white
                     hover:bg-slate-200/60 dark:hover:bg-slate-800/60
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600
                     focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <LogOut className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
