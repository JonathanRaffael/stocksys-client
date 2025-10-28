import { useEffect, useMemo, useState } from "react"
import API from "../../api/axios"
import { Plus, RefreshCw, Search, Shield, KeyRound, Trash2 } from "lucide-react"

type User = {
  id: string
  name: string
  email: string
  role: "ADMIN" | "MASTER" | "IPQC" | "OQC"
  isActive?: boolean
  createdAt: string
}
type CreateUser = { name: string; email: string; password: string; role: User["role"] }

export default function UsersPanel() {
  const [rows, setRows] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [openCreate, setOpenCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateUser>({ name: "", email: "", password: "", role: "IPQC" })

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return s ? rows.filter((u) => (`${u.name} ${u.email} ${u.role}`).toLowerCase().includes(s)) : rows
  }, [rows, q])

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await API.get<User[]>("/users")
      setRows(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      const r = await API.post<User>("/users", form)
      setRows((prev) => [r.data, ...prev])
      setOpenCreate(false)
      setForm({ name: "", email: "", password: "", role: "IPQC" })
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to create user")
    } finally {
      setSaving(false)
    }
  }

  const changeRole = async (id: string, role: User["role"]) => {
    try {
      const r = await API.patch<User>(`/users/${id}`, { role })
      setRows((prev) => prev.map((u) => (u.id === id ? r.data : u)))
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to change role")
    }
  }

  const resetPassword = async (id: string) => {
    const pass = prompt("Password baru:")
    if (!pass) return
    try {
      await API.patch(`/users/${id}/password`, { password: pass })
      alert("Password direset")
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to reset password")
    }
  }

  const softDelete = async (id: string) => {
    if (!confirm("Nonaktifkan user ini?")) return
    try {
      await API.delete(`/users/${id}`)
      setRows((prev) => prev.filter((u) => u.id !== id))
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to delete user")
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="btn-outline">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              className="input pl-9 text-slate-700 bg-white"
              placeholder="Cari user…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <button onClick={() => setOpenCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> User Baru
        </button>
      </div>

      {error && <p className="mt-3 text-red-600">{error}</p>}

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-sm text-slate-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-56">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 text-slate-700">{u.name}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <select
                        className="border rounded-md px-2 py-1 text-slate-700 bg-white"
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as User["role"])}
                      >
                        <option>ADMIN</option>
                        <option>MASTER</option>
                        <option>IPQC</option>
                        <option>OQC</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-green-600">Active</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="btn-ghost" onClick={() => resetPassword(u.id)}>
                        <KeyRound className="w-4 h-4" /> Reset Password
                      </button>
                      <button className="btn-danger" onClick={() => softDelete(u.id)}>
                        <Trash2 className="w-4 h-4" /> Nonaktifkan
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Create */}
      {openCreate && (
        <div className="modal">
          <div className="modal-card max-w-lg bg-white border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">Tambah User</h3>
            <form className="grid gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); create() }}>
              <input
                className="input text-slate-700 bg-white"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                required
              />
              <input
                className="input text-slate-700 bg-white"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                required
              />
              <input
                className="input text-slate-700 bg-white"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                required
              />
              <select
                className="input text-slate-700 bg-white"
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as any }))}
              >
                <option>ADMIN</option>
                <option>MASTER</option>
                <option>IPQC</option>
                <option>OQC</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-outline" onClick={() => setOpenCreate(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Menyimpan…" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* util tailwind (taruh di global css)
.btn-primary{ @apply inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 }
.btn-outline{ @apply inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-slate-700 }
.btn-ghost{ @apply inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-slate-700 }
.btn-danger{ @apply inline-flex items-center gap-2 rounded-lg border border-red-300 text-red-600 px-2.5 py-1.5 hover:bg-red-50 }
.input{ @apply rounded-lg border px-3 py-2 border-slate-300 outline-none focus:ring-2 focus:ring-blue-500/30 }
.modal{ @apply fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 }
.modal-card{ @apply w-full max-w-xl rounded-2xl p-5 shadow-xl }
*/
