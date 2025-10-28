// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import DashboardAdmin from "./pages/DashboardAdmin"
import DashboardIPQC from "./pages/ipqc/DashboardIPQC"
import DashboardOQC from "./pages/oqc/DashboardOQC"
import DashboardMaster from "./pages/DashboardMaster"
import ProtectedRoute from "./components/ProtectedRoute"
import AppShell from "./components/AppShell"

// History pages
import IPQCHistory from "./pages/ipqc/IPQCHistory"
import OQCHistory from "./pages/oqc/OQCHistory"

// ⬇️ NEW: Admin Product Totals page
import AdminProductTotals from "./pages/admin/AdminProductTotals"

function DashboardRedirect() {
  const raw = localStorage.getItem("user")
  const user = raw ? (JSON.parse(raw) as { role?: string }) : null
  if (!user?.role) return <Navigate to="/login" replace />

  switch (user.role) {
    case "ADMIN":  return <Navigate to="/admin" replace />
    case "IPQC":   return <Navigate to="/ipqc" replace />
    case "OQC":    return <Navigate to="/oqc" replace />
    case "MASTER": return <Navigate to="/master" replace />
    default:       return <Navigate to="/login" replace />
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardRedirect />} />

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <DashboardAdmin />
              </ProtectedRoute>
            }
          />
          {/* ⬇️ NEW: Admin Product Totals */}
          <Route
            path="/admin/totals"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminProductTotals />
              </ProtectedRoute>
            }
          />

          {/* IPQC */}
          <Route
            path="/ipqc"
            element={
              <ProtectedRoute allowedRoles={["IPQC","ADMIN","MASTER"]}>
                <DashboardIPQC />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ipqc/history"
            element={
              <ProtectedRoute allowedRoles={["IPQC","ADMIN","MASTER"]}>
                <IPQCHistory />
              </ProtectedRoute>
            }
          />

          {/* OQC */}
          <Route
            path="/oqc"
            element={
              <ProtectedRoute allowedRoles={["OQC","ADMIN","MASTER"]}>
                <DashboardOQC />
              </ProtectedRoute>
            }
          />
          <Route
            path="/oqc/history"
            element={
              <ProtectedRoute allowedRoles={["OQC","ADMIN","MASTER"]}>
                <OQCHistory />
              </ProtectedRoute>
            }
          />

          {/* MASTER */}
          <Route
            path="/master"
            element={
              <ProtectedRoute allowedRoles={["MASTER"]}>
                <DashboardMaster />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
