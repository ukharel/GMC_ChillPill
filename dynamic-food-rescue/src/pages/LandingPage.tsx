// src/pages/LandingPage.tsx
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { LoadingPage } from './LoadingPage'

export const LandingPage = () => {
  const { user, profile, isLoading } = useAuth()
  if (isLoading) return <LoadingPage />
  if (!user) return <Navigate to="/login" />
  if (profile?.role === 'vendor') return <Navigate to="/vendor/dashboard" />
  if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" />
  return <Navigate to="/deals" /> // user
}
