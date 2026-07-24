import { BrowserRouter, Routes, Route, Navigate,Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'

// ---------- Public Pages ----------
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

// ---------- User Pages ----------
import { DealsPage } from '@/pages/DealsPage'
import { ReservationPage } from '@/pages/ReservationPage'
import { UserDashboard } from '@/pages/user/UserDashboard'
import { NotificationsPage } from '@/pages/NotificationsPage'

// ---------- Vendor Pages ----------
import { VendorDashboard } from '@/pages/vendor/VendorDashboard'
import { ProductManagement } from '@/pages/vendor/ProductManagement'
import { Withdraw } from '@/pages/vendor/Withdraw'
import { PaymentSuccess } from '@/pages/PaymentSuccess'
import { PaymentFailure } from '@/pages/PaymentFailure'

// ---------- Admin Pages ----------
import { AdminDashboard } from '@/pages/AdminDashboard'

// ---------- Role Guard Component ----------
const RoleGuard = ({ allowedRoles }: { allowedRoles: ('user' | 'vendor' | 'admin')[] }) => {
  const { user, profile, isLoading } = useAuth()

  // ... inside RoleGuard
if (isLoading) return <LoadingPage />
if (!user) return <Navigate to="/login" replace />
if (!profile) {
  // Profile not loaded yet – redirect to default
  return <Navigate to="/deals" replace />
}
if (!allowedRoles.includes(profile.role)) {
  const redirectMap: Record<string, string> = {
    user: '/deals',
    vendor: '/vendor/dashboard',
    admin: '/admin/dashboard',
  }
  return <Navigate to={redirectMap[profile.role] || '/deals'} replace />
}
return <Outlet />
}

// ---------- App Root ----------
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ---------- Public Routes ---------- */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* ---------- User Routes ---------- */}
          <Route element={<RoleGuard allowedRoles={['user']} />}>
            <Route path="/" element={<DealsPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/reserve/:inventoryId" element={<ReservationPage />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>

          {/* ---------- Vendor Routes ---------- */}
          <Route element={<RoleGuard allowedRoles={['vendor', 'admin']} />}>
            <Route path="/vendor/dashboard" element={<VendorDashboard />} />
            <Route path="/vendor/products" element={<ProductManagement />} />
            <Route path="/vendor/withdraw" element={<Withdraw />} />
          </Route>

          {/* ---------- Admin Routes ---------- */}
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-failure" element={<PaymentFailure />} />

          {/* ---------- Fallback ---------- */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App