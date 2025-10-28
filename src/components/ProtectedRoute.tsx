import { Navigate } from "react-router-dom"

type Props = {
  children: React.ReactNode
  allowedRoles?: string[] // e.g. ["ADMIN"]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const token = localStorage.getItem("token")
  const raw = localStorage.getItem("user")
  const user = raw ? (JSON.parse(raw) as { role?: string }) : null

  if (!token || !user?.role) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // kalau role tidak cocok, lempar ke dashboard sesuai role-nya
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
