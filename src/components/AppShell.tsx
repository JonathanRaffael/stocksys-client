"use client"

import { useEffect, useState, useCallback } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from "./Navbar"
import Sidebar from "./Sidebar"

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const location = useLocation()

  // ===== Layout constants
  const NAVBAR_H = "56px"      // samakan dengan tinggi Navbar
  const MAIN_GAP = "16px"      // jarak ekstra di bawah navbar

  // Set CSS vars global (jangan set --sbw di sini: Sidebar yang ngatur)
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty("--navh", NAVBAR_H)
    r.style.setProperty("--main-gap", MAIN_GAP)
  }, [])

  // Detect mobile (md breakpoint)
  const handleResize = useCallback(() => {
    if (typeof window === "undefined") return
    setIsMobile(window.matchMedia("(max-width: 768px)").matches)
  }, [])
  useEffect(() => {
    handleResize()
    const mq = window.matchMedia("(max-width: 768px)")
    const onChange = () => handleResize()
    mq.addEventListener?.("change", onChange)
    window.addEventListener("resize", handleResize)
    return () => {
      mq.removeEventListener?.("change", onChange)
      window.removeEventListener("resize", handleResize)
    }
  }, [handleResize])

  // Tutup drawer saat pindah halaman (UX mobile)
  useEffect(() => {
    if (isMobile) setDrawerOpen(false)
  }, [location.pathname, location.search, isMobile])

  // Lock scroll body saat drawer terbuka (mobile)
  useEffect(() => {
    if (!isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = drawerOpen ? "hidden" : prev || ""
    return () => { document.body.style.overflow = prev || "" }
  }, [drawerOpen, isMobile])

  // ESC untuk menutup drawer (mobile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobile && drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerOpen, isMobile])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Skip link untuk aksesibilitas */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2
                   focus:bg-white dark:focus:bg-gray-900 focus:text-blue-600
                   focus:px-3 focus:py-1.5 focus:rounded-lg focus:shadow"
      >
        Skip to content
      </a>

      {/* Navbar fixed */}
      <Navbar onMenuClick={() => setDrawerOpen(true)} />

      {/* Sidebar:
          - Desktop: selalu tampil
          - Mobile: jadi drawer controlled lewat open/onClose
          (Sidebar sudah punya overlay & animasinya sendiri) */}
      <Sidebar open={isMobile ? drawerOpen : true} onClose={() => setDrawerOpen(false)} />

      {/* Main content
          - Offset dari navbar + gap
          - Geser kanan pakai --sbw saat desktop (Sidebar yang set variabel ini)
      */}
      <main
        id="main"
        className="px-4 md:px-6 pb-[calc(10px+env(safe-area-inset-bottom))] transition-[margin] duration-200 ease-out"
        style={{
          marginTop: "calc(var(--navh, 56px) + var(--main-gap, 16px))",
          marginLeft: isMobile ? "0" : "var(--sbw, 18rem)",
          minHeight: "calc(100vh - var(--navh, 56px) - var(--main-gap, 16px))",
        }}
      >
        <div className="space-y-8 md:space-y-10">
          <Outlet />
        </div>
      </main>

      {/* Region untuk toast/alerts live (opsional) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" />
    </div>
  )
}
