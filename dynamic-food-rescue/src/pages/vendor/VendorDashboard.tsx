// src/pages/vendor/VendorDashboard.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import {
  LayoutDashboard,
  ShoppingBag,
  History,
  Package,
  DollarSign,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Send,
  TrendingUp,
  Star,
} from 'lucide-react'
import { Link } from 'react-router-dom'
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

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="bg-white p-4 rounded-xl shadow flex items-center">
    <div className="p-3 bg-green-100 rounded-full mr-3">{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
)

export const VendorDashboard = () => {
  const { user, signOut } = useAuth()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'overview' | 'reservations' | 'history' | 'products' | 'withdraw'>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [stats, setStats] = useState({ revenue: 0, orders: 0, rating: 0, deliveries: 0 })
  const [reservations, setReservations] = useState<any[]>([])
  const [paidHistory, setPaidHistory] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  // Fetch store ID
  useEffect(() => {
    const fetchStore = async () => {
      if (!user) return
      const { data, error } = await supabase
        .from('store_staff')
        .select('store_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) {
        toast.error('Failed to fetch store')
        return
      }
      if (data) setStoreId(data.store_id)
      else toast.error('You are not registered as store staff')
      setLoading(false)
    }
    fetchStore()
  }, [user])

  // ---------- Fetch Data ----------
  const fetchData = async () => {
    if (!storeId) {
      console.warn('No storeId, skipping fetch')
      return
    }

    try {
      console.log('🔄 Fetching data for store:', storeId)

      // 1. Today's metrics
      const today = new Date().toISOString().split('T')[0]
      const { data: metrics } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', today)
        .maybeSingle()

      // 2. Average rating
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('store_id', storeId)
      const avgRating = ratings?.length ? ratings.reduce((a, b) => a + b.rating, 0) / ratings.length : 0

      // 3. Weekly chart
      const { data: weeklyData } = await supabase.rpc('get_weekly_analytics', { store_id: storeId })
      const chartData = (weeklyData || []).map((day: any) => ({
        name: day.day_name,
        revenue: day.revenue || 0,
        orders: day.orders || 0,
      }))

      setStats({
        revenue: metrics?.revenue_recovered || 0,
        orders: metrics?.reservations_picked || 0,
        rating: avgRating,
        deliveries: metrics?.deliveries || 0,
      })
      setDailyData(chartData)

      // ---------- 4. Reservations (Step by Step) ----------
      console.log('📦 Step 1: Fetching products...')
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
      if (prodErr) throw prodErr
      const productIds = products?.map(p => p.id) || []
      console.log(`  → ${productIds.length} products found`)

      let inventoryIds: string[] = []
      if (productIds.length) {
        console.log('📦 Step 2: Fetching inventory...')
        const { data: inventories, error: invErr } = await supabase
          .from('inventory')
          .select('id')
          .in('product_id', productIds)
        if (invErr) throw invErr
        inventoryIds = inventories?.map(i => i.id) || []
        console.log(`  → ${inventoryIds.length} inventory records found`)
      }

      let reservationsData: any[] = []
      if (inventoryIds.length) {
        console.log('📦 Step 3: Fetching reservations...')
        // CORRECTED: only fetch full_name from profiles
        const { data: reservations, error: resErr } = await supabase
          .from('reservations')
          .select(`
            id,
            pickup_code,
            status,
            payment_status,
            paid_at,
            created_at,
            user_id,
            inventory (products (name, original_price, current_discount)),
            profiles!user_id (full_name)
          `)
          .in('inventory_id', inventoryIds)
          .order('created_at', { ascending: false })
        if (resErr) throw resErr
        reservationsData = reservations || []
        console.log(`  → ${reservationsData.length} reservations found`)
      } else {
        console.warn('⚠️ No inventory IDs, skipping reservation fetch')
      }

      setReservations(reservationsData)
      setPaidHistory(reservationsData.filter(r => r.payment_status === 'paid'))

    } catch (err) {
      console.error('❌ Error fetching data:', err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (storeId) {
      fetchData()
      const channel = supabase
        .channel('vendor-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, fetchData)
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [storeId])

  // ---------- Actions ----------
  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('reservations').update({ status }).eq('id', id)
      if (error) throw error
      toast.success(`Status updated to ${status}`)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const markPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Marked as paid! Revenue added to analytics.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const sendNote = async (reservationId: string, userId: string) => {
    const note = noteInputs[reservationId]?.trim()
    if (!note) { toast.warning('Please write a note.'); return }
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({ user_id: userId, title: '📢 Store message', body: note, data: { reservation_id: reservationId } })
      if (error) throw error
      toast.success('Note sent!')
      setNoteInputs(prev => ({ ...prev, [reservationId]: '' }))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) return <LoadingPage />
  if (!storeId) return <div className="p-4 text-center">No store found. Please set up your store.</div>

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'reservations', label: 'Reservations', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-5 h-5" /> },
    { id: 'withdraw', label: 'Withdraw', icon: <DollarSign className="w-5 h-5" /> },
  ]

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className={`font-bold text-green-700 ${!sidebarOpen && 'hidden'}`}>Vendor Panel</h2>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-100">
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === item.id ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'
              }`}
            >
              {item.icon}
              <span className={sidebarOpen ? 'block' : 'hidden'}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
            <LogOut className="w-5 h-5" />
            <span className={sidebarOpen ? 'block' : 'hidden'}>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div>
            <h1 className="text-3xl font-bold text-green-700">Overview</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
              <StatCard icon={<DollarSign />} label="Revenue" value={`रू ${stats.revenue}`} />
              <StatCard icon={<ShoppingBag />} label="Orders" value={stats.orders} />
              <StatCard icon={<Star />} label="Rating" value={stats.rating.toFixed(1)} />
              <StatCard icon={<TrendingUp />} label="Deliveries" value={stats.deliveries} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
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
          </div>
        )}

        {activeTab === 'reservations' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700">Reservations</h1>
            <div className="mt-4 bg-white rounded-xl shadow overflow-x-auto">
              {reservations.length === 0 ? (
                <p className="p-4 text-gray-500">No reservations yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Payment</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => {
                      const prod = r.inventory?.products
                      const profile = r.profiles
                      return (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{prod?.name || 'Item'}</td>
                          <td className="px-4 py-2">{profile?.full_name || 'User'}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${r.payment_status === 'paid' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {r.payment_status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2">
                              {r.status === 'active' && (
                                <button onClick={() => updateStatus(r.id, 'picked_up')} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                  <CheckCircle className="w-4 h-4 inline mr-1" /> Pick Up
                                </button>
                              )}
                              {r.payment_status !== 'paid' && (
                                <button onClick={() => markPaid(r.id)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                  <DollarSign className="w-4 h-4 inline mr-1" /> Mark Paid
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="Note..."
                                  value={noteInputs[r.id] || ''}
                                  onChange={(e) => setNoteInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  className="w-24 px-1 py-1 border rounded text-xs"
                                />
                                <button onClick={() => sendNote(r.id, r.user_id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">
                                  <Send className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700">Payment History</h1>
            <div className="mt-4 bg-white rounded-xl shadow overflow-x-auto">
              {paidHistory.length === 0 ? (
                <p className="p-4 text-gray-500">No paid transactions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Paid At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidHistory.map((r) => {
                      const prod = r.inventory?.products
                      const profile = r.profiles
                      const amount = prod ? prod.original_price - (prod.current_discount || 0) : 0
                      return (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{prod?.name || 'Item'}</td>
                          <td className="px-4 py-2">{profile?.full_name || 'User'}</td>
                          <td className="px-4 py-2">रू {amount.toFixed(2)}</td>
                          <td className="px-4 py-2">{r.paid_at ? new Date(r.paid_at).toLocaleString() : 'N/A'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700">Products</h1>
            <p className="text-gray-500 mt-2">
              <Link to="/vendor/products" className="text-blue-600 hover:underline">Manage Products</Link>
            </p>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700">Withdraw</h1>
            <p className="text-gray-500 mt-2">
              <Link to="/vendor/withdraw" className="text-blue-600 hover:underline">
                Withdraw to eSewa
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}