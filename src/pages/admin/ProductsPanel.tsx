"use client"

import { useEffect, useMemo, useState } from "react"
import API from "../../api/axios"
import { Plus, Pencil, Trash2, RefreshCw, Search, RotateCcw } from "lucide-react"
import { useSearchParams } from "react-router-dom"

type Product = {
  id: string
  computerCode: string
  name: string
  size?: string | null
  description?: string | null
  uom?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ListResponse = {
  items: Product[]
  page: number
  take: number
  total: number
  pages: number
}

type FormState = {
  computerCode: string
  name: string
  size?: string
  description?: string
  uom?: string
}

function useDebounce<T>(value: T, ms = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function ProductsPanel() {
  const [params, setParams] = useSearchParams()

  // ===== Init from URL or sessionStorage
  const ss = typeof window !== "undefined" ? sessionStorage : null
  const initQuery = params.get("q") ?? ss?.getItem("prod_q") ?? ""
  const initPage  = Number(params.get("p") ?? ss?.getItem("prod_p") ?? 1) || 1
  const initTake  = Number(params.get("t") ?? ss?.getItem("prod_t") ?? 20) || 20
  const initShowI = (params.get("x") ?? ss?.getItem("prod_x") ?? "0") === "1"

  // table state
  const [rows, setRows] = useState<Product[]>([])
  const [page, setPage] = useState(initPage)
  const [take, setTake] = useState(initTake)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showInactive, setShowInactive] = useState(initShowI)

  // search
  const [query, setQuery] = useState(initQuery)
  const q = useDebounce(query, 350)

  // ui state
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ computerCode: "", name: "", size: "", description: "", uom: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ===== Sync to URL + sessionStorage
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set("q", q); else next.delete("q")
    if (page > 1) next.set("p", String(page)); else next.delete("p")
    if (take !== 20) next.set("t", String(take)); else next.delete("t")
    if (showInactive) next.set("x", "1"); else next.delete("x")
    setParams(next, { replace: true })

    try {
      sessionStorage.setItem("prod_q", q)
      sessionStorage.setItem("prod_p", String(page))
      sessionStorage.setItem("prod_t", String(take))
      sessionStorage.setItem("prod_x", showInactive ? "1" : "0")
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, take, showInactive])

  // ===== Fetch list (server-side filtering & pagination)
  async function fetchList(p = page) {
    setLoading(true)
    setError(null)
    try {
      const r = await API.get<ListResponse>("/products", {
        params: { query: q || undefined, take, page: p, includeInactive: showInactive || undefined },
      })
      setRows(r.data.items)
      setPage(r.data.page)
      setPages(r.data.pages)
      setTotal(r.data.total)
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal memuat data produk")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList(1) // kalau filter berubah, reset ke page 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, take, showInactive])

  // ===== CRUD
  async function create(payload: FormState) {
    setSaving(true)
    setError(null)
    try {
      await API.post<Product>("/products", payload)
      setOpen(false)
      setEditId(null)
      setForm({ computerCode: "", name: "", size: "", description: "", uom: "" })
      await fetchList(1)
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal menambah produk")
    } finally {
      setSaving(false)
    }
  }

  async function update(id: string, payload: Partial<FormState>) {
    setSaving(true)
    setError(null)
    try {
      await API.patch<Product>(`/products/${id}`, payload)
      setOpen(false)
      setEditId(null)
      await fetchList(page)
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengubah produk")
    } finally {
      setSaving(false)
    }
  }

  // Optimistic soft delete
  async function softDelete(id: string) {
    if (!confirm("Nonaktifkan produk ini?")) return
    const prev = rows
    setRows((rs) => rs.map(r => r.id === id ? { ...r, isActive: false } : r))
    try {
      await API.delete(`/products/${id}`)
      await fetchList(page)
    } catch (e: any) {
      alert(e?.response?.data?.error || "Gagal menonaktifkan produk")
      setRows(prev) // rollback
    }
  }

  // Optimistic restore
  async function restore(id: string) {
    const prev = rows
    setRows((rs) => rs.map(r => r.id === id ? { ...r, isActive: true } : r))
    try {
      await API.patch<Product>(`/products/${id}`, { isActive: true })
      await fetchList(page)
    } catch (e: any) {
      alert(e?.response?.data?.error || "Gagal mengaktifkan kembali")
      setRows(prev) // rollback
    }
  }

  // ===== Derived
  const from = useMemo(() => (rows.length ? (page - 1) * take + 1 : 0), [rows.length, page, take])
  const to   = useMemo(() => (rows.length ? (page - 1) * take + rows.length : 0), [rows.length, page, take])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchList(page)}
            className="btn-outline"
            title="Refresh daftar"
            aria-label="Refresh daftar produk"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          <label className="relative" aria-label="Pencarian produk" title="Cari kode / nama / size">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kode / nama / size…"
              className="input pl-9 bg-white dark:bg-gray-900/50"
              maxLength={80}
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-[--color-brand]"
            />
            Tampilkan yang non-aktif
          </label>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={take}
            onChange={(e) => setTake(Number(e.target.value))}
            className="input bg-white dark:bg-gray-900/50 text-sm w-[90px]"
            title="Baris per halaman"
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>

          <button
            onClick={() => {
              setOpen(true)
              setEditId(null)
              setForm({ computerCode: "", name: "", size: "", description: "", uom: "" })
            }}
            className="btn"
            aria-haspopup="dialog"
          >
            <Plus className="w-4 h-4" />
            Produk Baru
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200 px-3 py-2 text-sm"
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0 z-10">
            <tr className="text-sm text-gray-600 dark:text-gray-300">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">UoM</th>
              <th className="px-4 py-3">Desc</th>
              <th className="px-4 py-3 w-48">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows
              [...Array(6)].map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                  {[...Array(6)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full max-w-[12rem] rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr
                  key={p.id}
                  className={[
                    "border-t border-gray-100 dark:border-gray-800",
                    !p.isActive ? "opacity-60" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/40",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 font-mono text-sm text-gray-800 dark:text-gray-100">{p.computerCode}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{p.name}</span>
                      {!p.isActive && (
                        <span className="badge">inactive</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{p.size || "-"}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{p.uom || "-"}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{p.description || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setOpen(true)
                          setEditId(p.id)
                          setForm({
                            computerCode: p.computerCode,
                            name: p.name,
                            size: p.size ?? "",
                            description: p.description ?? "",
                            uom: p.uom ?? "",
                          })
                        }}
                        title="Edit produk"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>

                      {p.isActive ? (
                        <button className="btn-danger" onClick={() => softDelete(p.id)} title="Nonaktifkan produk">
                          <Trash2 className="w-4 h-4" /> Nonaktifkan
                        </button>
                      ) : (
                        <button className="btn-outline" onClick={() => restore(p.id)} title="Aktifkan kembali">
                          <RotateCcw className="w-4 h-4" /> Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <div>
          Menampilkan <b>{from}</b>–<b>{to}</b> dari <b>{total}</b>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-outline"
            disabled={page <= 1}
            onClick={() => fetchList(page - 1)}
            aria-disabled={page <= 1}
            title="Halaman sebelumnya"
          >
            Prev
          </button>
          <span>Page {page} / {pages}</span>
          <button
            className="btn-outline"
            disabled={page >= pages}
            onClick={() => fetchList(page + 1)}
            aria-disabled={page >= pages}
            title="Halaman berikutnya"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setOpen(false); setEditId(null) } }}
        >
          <div
            className="w-full max-w-xl rounded-2xl p-5 shadow-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {editId ? "Edit Produk" : "Tambah Produk"}
            </h3>

            <form
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
              onSubmit={(e) => {
                e.preventDefault()
                editId ? update(editId, form) : create(form)
              }}
            >
              <input
                className="input"
                placeholder="Computer Code"
                required
                value={form.computerCode}
                onChange={(e) => setForm((s) => ({ ...s, computerCode: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Product Name"
                required
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Size"
                value={form.size}
                onChange={(e) => setForm((s) => ({ ...s, size: e.target.value }))}
              />
              <input
                className="input"
                placeholder="UoM"
                value={form.uom}
                onChange={(e) => setForm((s) => ({ ...s, uom: e.target.value }))}
              />
              <textarea
                className="input md:col-span-2 min-h-24"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />

              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => { setOpen(false); setEditId(null) }}
                >
                  Batal
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Menyimpan…" : editId ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
