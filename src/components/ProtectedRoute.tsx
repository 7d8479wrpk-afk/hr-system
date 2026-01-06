import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

interface ProtectedProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedProps) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }

  if (requireAdmin && !profile?.is_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-md border border-rose-100 bg-rose-50 px-6 py-4 text-sm text-rose-700 shadow-sm">
          You do not have admin access. Contact an administrator to grant permissions.
        </div>
      </div>
    )
  }

  return <>{children}</>
}
