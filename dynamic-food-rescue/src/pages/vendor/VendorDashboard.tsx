import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, Package, Star, Truck, Store, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
export const VendorDashboard = () => {
  const { user, refreshProfile } = useAuth()
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    rating: 0,
    deliveries: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)

  // Setup state
  const [showSetup, setShowSetup] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ---------- Fetch Store ----------
  useEffect(() => {
    const fetchStore = async () => {
      if (!user) return
      const { data, error } = await supabase
        .from('store_staff')
        .select('store_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching store:', error)
        toast.error('Failed to fetch store')
        setLoading(false)
        return
      }

      if (data) {
        setStoreId(data.store_id)
        setShowSetup(false)
        setLoading(false)
      } else {
        // No store found – show setup
        setShowSetup(true)
        setLoading(false)
      }
    }
    fetchStore()
  }, [user])

  // ---------- Fetch Analytics (only if storeId exists) ----------
  useEffect(() => {
    if (!storeId) return

    const fetchAnalytics = async () => {
      try {
        // 1. Today's metrics
        const today = new Date().toISOString().split('T')[0]
    const { data: metrics, error: metricsError } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', today)
      .maybeSingle()
    if (metricsError) throw metricsError

        // 2. Average rating
        const { data: ratings, error: ratingError } = await supabase
      .from('ratings')
      .select('rating')
      .eq('store_id', storeId)
    if (ratingError) throw ratingError
    const avgRating = ratings?.length
      ? ratings.reduce((a, b) => a + b.rating, 0) / ratings.length
      : 0

    // 3. Weekly chart data
    const { data: weeklyData, error: weeklyError } = await supabase
      .rpc('get_weekly_analytics', { store_id: storeId })
    if (weeklyError) throw weeklyError

        // 3. Recent orders – fetch product IDs first
        const { data: products, error: prodError } = await supabase
          .from('products')
          .select('id')
          .eq('store_id', storeId)
        if (prodError) throw prodError
        const productIds = products?.map((p: any) => p.id) || []

        let inventoryIds: string[] = []
        if (productIds.length > 0) {
          const { data: inventories, error: invError } = await supabase
            .from('inventory')
            .select('id')
            .in('product_id', productIds)
          if (invError) throw invError
          inventoryIds = inventories?.map((i: any) => i.id) || []
        }

        let orders: any[] = []
        if (inventoryIds.length > 0) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('reservations')
            .select(`
              id,
              pickup_code,
              status,
              created_at,
              inventory (
                products (
                  name
                )
              )
            `)
            .in('inventory_id', inventoryIds)
            .order('created_at', { ascending: false })
            .limit(10)
          if (ordersError) throw ordersError
          orders = ordersData || []
        }

        setRecentOrders(orders)
        setStats({
          revenue: metrics?.revenue_recovered || 0,
          orders: metrics?.reservations_picked || 0,
          rating: avgRating,
          deliveries: metrics?.deliveries || 0,
        })
    
        // Format weekly data for recharts
        // Chart data (replace with real data later)

        const chartData = weeklyData?.map((day: any) => ({
          name: day.day_name,
          revenue: day.revenue || 0,
          orders: day.orders || 0,
        })) || []
        setDailyData(chartData)

        
      } catch (err: any) {
        console.error('Error fetching analytics:', err)
        toast.error(err.message || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()

    // Real‑time updates
    const channel = supabase
      .channel('vendor-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchAnalytics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, fetchAnalytics)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  // ---------- Handle Store Setup ----------
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!storeName.trim()) {
      toast.error('Please enter a store name')
      return
    }

    setSubmitting(true)
    try {
      // 1. Create the store
      const { data: newStore, error: storeError } = await supabase
        .from('stores')
        .insert({
          name: storeName.trim(),
          address: storeAddress.trim() || 'Kathmandu, Nepal',
          latitude: 27.7172,
          longitude: 85.3240,
        })
        .select()
        .single()
      if (storeError) throw storeError

      // 2. Create store_staff record
      const { error: staffError } = await supabase
        .from('store_staff')
        .insert({
          user_id: user.id,
          store_id: newStore.id,
          role: 'manager',
        })
      if (staffError) throw staffError

      toast.success('Store created successfully!')
      // Refresh profile to update role if needed
      await refreshProfile()
      // Reload to fetch the new store
      window.location.reload()
    } catch (err: any) {
      console.error('Setup error:', err)
      toast.error(err.message || 'Failed to create store')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Loading ----------
  if (loading) return <LoadingPage />

  // ---------- Setup Screen ----------
  if (showSetup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <Store className="w-12 h-12 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-800 mt-2">Set Up Your Store</h2>
            <p className="text-gray-500 text-sm">
              Create your store to start selling discounted products.
            </p>
          </div>
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Store Name *</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Fresh Mart"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="e.g. New Road, Kathmandu"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Store & Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ---------- Dashboard ----------
  return (
    <div className="min-h-screen bg-gray-50 p-4">
<div className="flex justify-between items-center">
  <h1 className="text-3xl font-bold text-green-700">Vendor Dashboard</h1>
  <Link
    to="/vendor/products"
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    Manage Products
  </Link>
</div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
        <StatCard icon={<DollarSign />} label="Revenue" value={`रू ${stats.revenue}`} />
        <StatCard icon={<Package />} label="Orders" value={stats.orders} />
        <StatCard icon={<Star />} label="Rating" value={stats.rating.toFixed(1)} />
        <StatCard icon={<Truck />} label="Deliveries" value={stats.deliveries} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold">Revenue (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#16a34a" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold">Orders (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-lg">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">No orders yet</p>
        ) : (
          <ul className="divide-y">
            {recentOrders.map((order) => (
              <li key={order.id} className="py-2 flex justify-between">
                <div>
                  <p>{order.inventory?.products?.name || 'Item'}</p>
                  <p className="text-sm text-gray-500">Code: {order.pickup_code}</p>
                </div>
                <span className="text-sm text-gray-600">{order.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Withdraw Button */}
      <div className="mt-4 text-right">
        <button
          onClick={() => (window.location.href = '/vendor/withdraw')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Withdraw to eSewa
        </button>
      </div>
    </div>
  )
}

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="bg-white p-4 rounded-xl shadow flex items-center">
    <div className="p-3 bg-green-100 rounded-full mr-3">{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
)
