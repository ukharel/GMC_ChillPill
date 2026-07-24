import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'

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

// Admin Pages

// ---------- Role Guard ----------
const RoleGuard = ({ allowedRoles }: { allowedRoles: ('user' | 'vendor' | 'admin')[] }) => {
  const { user, role, isLoading } = useAuth() // <-- use role

  if (isLoading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />

  const effectiveRole = role || 'user'

  if (!allowedRoles.includes(effectiveRole)) {
    const redirectMap: Record<string, string> = {
      user: '/dashboard',
      vendor: '/vendor/dashboard',
      admin: '/admin/dashboard',
    }
    return <Navigate to={redirectMap[effectiveRole] || '/deals'} replace />
  }

  return <Outlet />
}

// ---------- App Root ----------
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
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
            <Route path="/vendor/withdraw" element={<Withdraw />} />
          </Route>

          <Route element={<RoleGuard allowedRoles={['admin']} />}>
          </Route>

          <Route path="*" element={<Navigate to="/deals" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App