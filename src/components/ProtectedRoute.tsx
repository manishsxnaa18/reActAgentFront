import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { User } from '../types'

type ProtectedRouteProps = {
  user: User | null
  children: ReactNode
}

export default function ProtectedRoute({ user, children }: ProtectedRouteProps) {
  const location = useLocation()
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return children
}
