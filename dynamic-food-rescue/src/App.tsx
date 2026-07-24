import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

// Public Pages
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

// User Pages
import { DealsPage } from '@/pages/DealsPage'
import { ReservationPage } from '@/pages/ReservationPage'
import { UserDashboard } from '@/pages/user/UserDashboard'
import { NotificationsPage } from '../src/pages/NotificationPage'

// Vendor Pages
import { VendorDashboard } from '@/pages/vendor/VendorDashboard'
import { ProductManagement } from '@/pages/vendor/ProductManagement'
import { Withdraw } from '@/pages/vendor/Withdraw'

import { PageTransition } from './components/PageTransition'

const RoleGuard = ({ allowedRoles }: { allowedRoles: ('user' | 'vendor' | 'admin')[] }) => {
  const { user, role, isLoading } = useAuth()
  if (isLoading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />
  const effectiveRole = role || 'user'
  if (!allowedRoles.includes(effectiveRole)) {
    const redirectMap = {
      user: '/dashboard',
      vendor: '/vendor/dashboard',
      admin: '/admin/dashboard',
    }
    return <Navigate to={redirectMap[effectiveRole] || '/deals'} replace />
  }
  return <Outlet />
}

function App() {
  const location = useLocation() // now safe to use, because BrowserRouter is in main.tsx

  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<RoleGuard allowedRoles={['user']} />}>
            <Route path="/" element={<DealsPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/reserve/:inventoryId" element={<ReservationPage />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['vendor', 'admin']} />}>
            <Route path="/vendor/dashboard" element={<VendorDashboard />} />
            <Route path="/vendor/products" element={<ProductManagement />} />
          </Route>
          <Route path="*" element={<Navigate to="/deals" replace />} />
        </Routes>
      </AnimatePresence>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  )
}

export default App