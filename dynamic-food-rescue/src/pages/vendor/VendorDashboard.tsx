// src/pages/vendor/VendorDashboard.tsx
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import {
  LayoutDashboard,
  ShoppingBag,
  History,
  Package,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Send,
  TrendingUp,
  Star,
  Heart,
  Plus,
  Edit,
  Trash2,
  X,
  DollarSign,
  Crown,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
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

// ---------- Stat Card ----------
const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="bg-white p-4 rounded-xl shadow flex items-center">
    <div className="p-3 bg-green-100 rounded-full mr-3">{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
)

// ---------- Main Component ----------
export const VendorDashboard = () => {
  const { user, signOut } = useAuth()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'reservations' | 'history' | 'products' | 'donate'>('overview')

  // Data states
  const [stats, setStats] = useState({ revenue: 0, orders: 0, rating: 0, deliveries: 0 })
  const [reservations, setReservations] = useState<any[]>([])
  const [paidHistory, setPaidHistory] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  // Donation states
  const [donations, setDonations] = useState<any[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDonation, setEditingDonation] = useState<any | null>(null)
  const [donationForm, setDonationForm] = useState({
    product_name: '',
    quantity: 0,
    unit: 'kg',
    expiry_date: '',
    pickup_deadline: '',
    notes: '',
  })

  // Store setup states
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Subscription states
  const [subscription, setSubscription] = useState<any>(null)
  const [checkingSubscription, setCheckingSubscription] = useState(true)

  // ---------- Fetch store ID ----------
  useEffect(() => {
    const fetchStore = async () => {
      if (!user) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('store_staff')
        .select('store_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) {
        console.error('Store fetch error:', error)
        setShowSetup(true)
        setLoading(false)
        return
      }
      if (data) {
        setStoreId(data.store_id)
        setShowSetup(false)
      } else {
        setShowSetup(true)
      }
      setLoading(false)
    }
    fetchStore()
  }, [user])

  // ---------- Subscription check ----------
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setCheckingSubscription(false)
        return
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Subscription check error:', error)
        setSubscription(null)
        setCheckingSubscription(false)
        return
      }

      const sub = data?.[0] || null
      const now = new Date()

      if (sub) {
        if (sub.status === 'trial' && sub.trial_end_date && new Date(sub.trial_end_date) > now) {
          setSubscription(sub)
          setCheckingSubscription(false)
          return
        }
        if (sub.status === 'active' && sub.end_date && new Date(sub.end_date) > now) {
          setSubscription(sub)
          setCheckingSubscription(false)
          return
        }
        // Expired – update to new trial
        try {
          const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
          const { data: updated, error: updateErr } = await supabase
            .from('subscriptions')
            .update({
              status: 'trial',
              trial_end_date: trialEnd.toISOString(),
              start_date: new Date().toISOString(),
              end_date: trialEnd.toISOString(),
              plan_id: null,
              payment_status: 'pending',
              transaction_id: null,
            })
            .eq('id', sub.id)
            .select()
            .single()
          if (updateErr) throw updateErr
          setSubscription(updated)
        } catch (err) {
          console.error('Subscription update error:', err)
          setSubscription(null)
        }
        setCheckingSubscription(false)
        return
      }

      // No subscription – insert trial
      try {
        const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        const { data: newSub, error: insErr } = await supabase
          .from('subscriptions')
          .insert({
            vendor_id: user.id,
            status: 'trial',
            trial_end_date: trialEnd.toISOString(),
            start_date: new Date().toISOString(),
            end_date: trialEnd.toISOString(),
          })
          .select()
          .single()
        if (insErr) throw insErr
        setSubscription(newSub)
      } catch (err) {
        console.error('Trial creation error:', err)
        setSubscription(null)
      }
      setCheckingSubscription(false)
    }

    checkSubscription()
  }, [user])

  // ---------- Data fetching ----------
  const fetchAnalytics = async () => {
    if (!storeId) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: metrics, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', today)
        .maybeSingle()
      if (metricsError) throw metricsError

      const { data: ratings, error: ratingError } = await supabase
        .from('ratings')
        .select('rating')
        .eq('store_id', storeId)
      if (ratingError) throw ratingError
      const avgRating = ratings?.length
        ? ratings.reduce((a, b) => a + b.rating, 0) / ratings.length
        : 0

      const { data: weeklyData, error: weeklyError } = await supabase
        .rpc('get_weekly_analytics', { store_id: storeId })
      if (weeklyError) throw weeklyError

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
    } catch (err) {
      console.error('Analytics error:', err)
      toast.error('Failed to load analytics')
    }
  }

  const fetchReservations = async () => {
    if (!storeId) return
    try {
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
      if (prodErr) throw prodErr
      const productIds = products?.map(p => p.id) || []
      if (productIds.length === 0) {
        setReservations([])
        setPaidHistory([])
        return
      }

      const { data: inventories, error: invErr } = await supabase
        .from('inventory')
        .select('id')
        .in('product_id', productIds)
      if (invErr) throw invErr
      const inventoryIds = inventories?.map(i => i.id) || []
      if (inventoryIds.length === 0) {
        setReservations([])
        setPaidHistory([])
        return
      }

      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select(`
          id,
          pickup_code,
          status,
          payment_status,
          paid_at,
          created_at,
          user_id,
          delivery_address,
          delivery_fee,
          delivery_status,
          inventory (products (name, original_price, current_discount)),
          profiles!user_id (full_name)
        `)
        .in('inventory_id', inventoryIds)
        .order('created_at', { ascending: false })
      if (resErr) throw resErr

      setReservations(resData || [])
      setPaidHistory(resData?.filter(r => r.payment_status === 'paid') || [])
    } catch (err) {
      console.error('Reservations error:', err)
      toast.error('Failed to load reservations')
    }
  }

  const fetchDonations = async () => {
    if (!storeId) return
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setDonations(data || [])
    } catch (err) {
      console.error('Donations error:', err)
      toast.error('Failed to load donations')
    }
  }

  const fetchData = async () => {
    if (!storeId) return
    await Promise.all([fetchAnalytics(), fetchReservations(), fetchDonations()])
  }

  // ---------- Store setup ----------
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!storeName.trim()) {
      toast.error('Please enter a store name')
      return
    }

    setSubmitting(true)
    try {
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

      const { error: staffError } = await supabase
        .from('store_staff')
        .insert({
          user_id: user.id,
          store_id: newStore.id,
          role: 'manager',
        })
      if (staffError) throw staffError

      toast.success('Store created!')
      setShowSetup(false)
      setStoreId(newStore.id)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Donation CRUD ----------
  const handleAddDonation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return
    try {
      const { error } = await supabase
        .from('donations')
        .insert({
          store_id: storeId,
          ...donationForm,
          quantity: Number(donationForm.quantity),
          status: 'active',
        })
      if (error) throw error
      toast.success('Donation added!')
      resetDonationForm()
      fetchDonations()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleUpdateDonation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDonation) return
    try {
      const { error } = await supabase
        .from('donations')
        .update({
          product_name: donationForm.product_name,
          quantity: Number(donationForm.quantity),
          unit: donationForm.unit,
          expiry_date: donationForm.expiry_date,
          pickup_deadline: donationForm.pickup_deadline,
          notes: donationForm.notes,
        })
        .eq('id', editingDonation.id)
      if (error) throw error
      toast.success('Donation updated!')
      resetDonationForm()
      fetchDonations()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteDonation = async (id: string) => {
    if (!confirm('Delete this donation?')) return
    try {
      const { error } = await supabase.from('donations').delete().eq('id', id)
      if (error) throw error
      toast.success('Donation deleted')
      fetchDonations()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const markPickedUp = async (id: string) => {
    try {
      const { error } = await supabase
        .from('donations')
        .update({ status: 'picked_up' })
        .eq('id', id)
      if (error) throw error
      toast.success('Donation marked as picked up!')
      fetchDonations()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const resetDonationForm = () => {
    setDonationForm({
      product_name: '',
      quantity: 0,
      unit: 'kg',
      expiry_date: '',
      pickup_deadline: '',
      notes: '',
    })
    setEditingDonation(null)
    setIsFormOpen(false)
  }

  const openEdit = (donation: any) => {
    setEditingDonation(donation)
    setDonationForm({
      product_name: donation.product_name,
      quantity: donation.quantity,
      unit: donation.unit,
      expiry_date: donation.expiry_date?.slice(0, 16) || '',
      pickup_deadline: donation.pickup_deadline?.slice(0, 16) || '',
      notes: donation.notes || '',
    })
    setIsFormOpen(true)
  }

  // ---------- Reservation actions ----------
  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('reservations').update({ status }).eq('id', id)
      if (error) throw error
      toast.success(`Status updated to ${status}`)
      fetchReservations()
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
      toast.success('Marked as paid!')
      fetchReservations()
      fetchAnalytics()
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
        .insert({
          user_id: userId,
          title: '📢 Store message',
          body: note,
          data: { reservation_id: reservationId },
        })
      if (error) throw error
      toast.success('Note sent!')
      setNoteInputs(prev => ({ ...prev, [reservationId]: '' }))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ---------- Realtime subscriptions ----------
  useEffect(() => {
    if (!storeId) return
    fetchData()

    const channel = supabase
      .channel('vendor-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations()
        fetchAnalytics()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, fetchAnalytics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, fetchDonations)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId])

  // ---------- Conditional rendering (after all hooks) ----------
  if (loading) return <LoadingPage />
  if (showSetup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-center text-green-700">Set Up Your Store</h2>
          <p className="text-center text-gray-500 text-sm mt-1">Create your store to start selling.</p>
          <form onSubmit={handleSetup} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium">Store Name *</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Fresh Mart"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Address</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="e.g. New Road, Kathmandu"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
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

  if (checkingSubscription) return <LoadingPage />
if (!subscription) {
  return <Navigate to="/vendor/subscribe" replace />
}

  if (!storeId) {
    return <div className="p-4 text-center">No store found. Please set up your store.</div>
  }

  // Sidebar nav items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'reservations', label: 'Reservations', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-5 h-5" /> },
    { id: 'donate', label: 'Donate', icon: <Heart className="w-5 h-5" /> },

  ]

  // ---------- Main render ----------
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className={`font-bold text-green-700 ${!sidebarOpen && 'hidden'}`}>Vendor Panel</h2>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-100">
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 border-b">
          {subscription?.status === 'trial' && (
            <span className="text-yellow-600">
              Trial: {Math.ceil((new Date(subscription.trial_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
            </span>
          )}
          {subscription?.status === 'active' && (
            <span className="text-green-600">Plan: Premium</span>
          )}
        </div>
        <Link to="/vendor/subscribe" className="...">Upgrade Plan</Link>
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

{/* 👇 NEW: Upgrade Plan link */}
<Link
  to="/vendor/subscribe"
  className="w-full flex items-center gap-3 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
>
  < Crown className="w-5 h-5" />
  <span className={sidebarOpen ? 'block' : 'hidden'}>Upgrade Plan</span>
</Link>

<div className="p-4 border-t">
  <button
    onClick={signOut}
    className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
  >
    <LogOut className="w-5 h-5" />
    <span className={sidebarOpen ? 'block' : 'hidden'}>Logout</span>
  </button>
</div>
        <div className="p-4 border-t">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <LogOut className="w-5 h-5" />
            <span className={sidebarOpen ? 'block' : 'hidden'}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Overview */}
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

        {/* Reservations */}
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
                      <th className="px-4 py-2 text-left">Type</th>
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
                            {r.delivery_status === 'not_requested' ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">Pickup</span>
                            ) : (
                              <div>
                                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Delivery</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <p>📍 {r.delivery_address || 'N/A'}</p>
                                  <p>Fee: ₹{r.delivery_fee || 0}</p>
                                  <p>Status: {r.delivery_status}</p>
                                </div>
                              </div>
                            )}
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

        {/* History */}
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

        {/* Products */}
        {activeTab === 'products' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700">Products</h1>
            <p className="text-gray-500 mt-2">
              <Link to="/vendor/products" className="text-blue-600 hover:underline">Manage Products</Link>
            </p>
          </div>
        )}

        {/* Donate */}
        {activeTab === 'donate' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700 flex items-center gap-2">
              <Heart className="text-red-500" /> Donate Surplus Food
            </h1>
            <p className="text-gray-500 mb-4">List surplus food for donation to charities and NGOs.</p>

            <button
              onClick={() => setIsFormOpen(true)}
              className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Donation
            </button>

            {donations.length === 0 ? (
              <p className="text-gray-500">No donations yet. Click "New Donation" to start.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {donations.map((d) => (
                  <div key={d.id} className="bg-white rounded-xl shadow p-4 border-t-4 border-green-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{d.product_name}</h3>
                        <p className="text-sm text-gray-500">{d.quantity} {d.unit}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        d.status === 'active' ? 'bg-green-100 text-green-800' :
                        d.status === 'claimed' ? 'bg-yellow-100 text-yellow-800' :
                        d.status === 'picked_up' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Expires: {new Date(d.expiry_date).toLocaleDateString()}</p>
                      <p>Pickup by: {new Date(d.pickup_deadline).toLocaleDateString()}</p>
                      {d.notes && <p className="text-gray-500 mt-1">📝 {d.notes}</p>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.status === 'active' && (
                        <button
                          onClick={() => markPickedUp(d.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Mark Picked Up
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(d)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                      >
                        <Edit className="w-4 h-4 inline mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => deleteDonation(d.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Donation Form Modal */}
            {isFormOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{editingDonation ? 'Edit' : 'Add'} Donation</h2>
                    <button onClick={resetDonationForm} className="text-gray-500 hover:text-gray-700">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <form onSubmit={editingDonation ? handleUpdateDonation : handleAddDonation} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium">Product Name</label>
                      <input
                        type="text"
                        value={donationForm.product_name}
                        onChange={(e) => setDonationForm({ ...donationForm, product_name: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Quantity</label>
                      <input
                        type="number"
                        value={donationForm.quantity === 0 ? '' : donationForm.quantity}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value)
                          setDonationForm({ ...donationForm, quantity: val })
                        }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Unit</label>
                      <select
                        value={donationForm.unit}
                        onChange={(e) => setDonationForm({ ...donationForm, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="kg">kg</option>
                        <option value="piece">piece</option>
                        <option value="bunch">bunch</option>
                        <option value="packet">packet</option>
                        <option value="dozen">dozen</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Expiry Date</label>
                      <input
                        type="datetime-local"
                        value={donationForm.expiry_date}
                        onChange={(e) => setDonationForm({ ...donationForm, expiry_date: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Pickup Deadline</label>
                      <input
                        type="datetime-local"
                        value={donationForm.pickup_deadline}
                        onChange={(e) => setDonationForm({ ...donationForm, pickup_deadline: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Notes (optional)</label>
                      <textarea
                        value={donationForm.notes}
                        onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        rows={2}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      {editingDonation ? 'Update' : 'Add'} Donation
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}