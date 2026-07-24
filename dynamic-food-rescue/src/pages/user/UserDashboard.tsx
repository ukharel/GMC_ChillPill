import { useState, useEffect, useRef } from 'react'
import { LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import {
  Star,
  MapPin,
  MessageCircle,
  Bell,
  Send,
  Search,
  Leaf,
  Clock,
  Zap,
  LayoutDashboard,
  ShoppingBag,
  ThumbsUp,
  Trash2,
  Menu,
  X,
  History,
} from 'lucide-react'
import { MotionWrapper } from '@/components/MotionWrapper'
import { motion } from "motion/react"

// ---------- Types ----------
interface StoreWithRating {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  avg_rating: number
  distance_km: number
}

interface RatedStore {
  store_id: string
  store_name: string
  rating: number
  comment: string
  created_at: string
}

interface Product {
  id: string
  name: string
  original_price: number
  current_discount: number
  discounted_price: number
  sell_by: string
  inventory_id: string
  available: number
  store_name: string
}

// ---------- FlashAlertItem Component ----------
const FlashAlertItem = ({
  reservation,
  onCancel,
  onSendNote,
  onChat,
  onRemind,
  noteInput,
  setNoteInput,
}: {
  reservation: any
  onCancel: (id: string) => void
  onSendNote: (id: string, vendorId: string, note: string) => void
  onChat: (id: string, vendorId: string) => void
  onRemind: (id: string) => void
  noteInput: string
  setNoteInput: (value: string) => void
}) => {
  if (!reservation || !reservation.inventory) return null

  const product = reservation.inventory?.products
  const store = product?.stores
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0 })
  const expiry = new Date(reservation.expires_at).getTime()

  useEffect(() => {
    const fetchVendor = async () => {
      if (!product?.store_id) return
      const { data } = await supabase
        .from('store_staff')
        .select('user_id')
        .eq('store_id', product.store_id)
        .limit(1)
      if (data?.[0]) setVendorId(data[0].user_id)
    }
    fetchVendor()
  }, [product?.store_id])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = Math.max(0, expiry - now)
      setTimeLeft({
        minutes: Math.floor(diff / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [expiry])

  const isUrgent = timeLeft.minutes < 10

  return (
    <div className={`p-4 rounded-lg border ${isUrgent ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{product?.name || 'Item'}</p>
          <p className="text-sm text-gray-500">{store?.name || 'Store'}</p>
        </div>
        <div className="text-right">
          <span className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-gray-600'}`}>
            {timeLeft.minutes}m {timeLeft.seconds}s
          </span>
          <button
            onClick={() => onCancel(reservation.id)}
            className="block text-xs text-red-600 hover:text-red-800 mt-1"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => onRemind(reservation.id)}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          ⏰ Remind Me
        </button>
        <Link
          to={`/reserve/${reservation.inventory_id}`}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          View
        </Link>
        {vendorId && (
          <>
            <input
              type="text"
              placeholder="Send note to vendor..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="flex-1 min-w-[100px] px-2 py-1 border rounded text-sm"
            />
            <button
              onClick={() => onSendNote(reservation.id, vendorId, noteInput)}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
            >
              <Send className="w-4 h-4 inline mr-1" /> Send
            </button>
            <button
              onClick={() => onChat(reservation.id, vendorId)}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
            >
              <MessageCircle className="w-4 h-4 inline mr-1" /> Chat
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- Main UserDashboard ----------
export const UserDashboard = () => {
  const { user, signOut } = useAuth()
  const { latitude, longitude, isLoading: locationLoading, error: locationError } = useGeolocation()
  const [stores, setStores] = useState<StoreWithRating[]>([])
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreWithRating | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'flash_alerts' | 'smart_picks' | 'rated_stores' | 'nearby_stores' | 'history'>('overview')

  // Impact stats
  const [impactStats, setImpactStats] = useState({
    foodSaved: 0,
    moneySaved: 0,
    co2Saved: 0,
    trees: 0,
  })
  const [activeReservations, setActiveReservations] = useState<any[]>([])
  const [orderHistory, setOrderHistory] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [ratedStores, setRatedStores] = useState<RatedStore[]>([])
  const [loadingImpact, setLoadingImpact] = useState(true)

  // Chat state
  const [chatReservationId, setChatReservationId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  const userLat = latitude || 27.7172
  const userLng = longitude || 85.3240
  const hasLocation = !!latitude && !!longitude

  // ---------- Fetch Impact ----------
  const fetchImpactStats = async () => {
    if (!user) return
    try {
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select(`
          id,
          inventory ( products ( name, original_price, current_discount, category ) )
        `)
        .eq('user_id', user.id)
        .eq('status', 'picked_up')

      if (error) throw error

      let totalFoodSaved = 0
      let totalMoneySaved = 0
      let totalItems = 0

      reservations?.forEach((r: any) => {
        const product = r.inventory?.products
        if (product) {
          const discount = product.current_discount || 0
          totalMoneySaved += discount
          totalItems += 1
          const weightPerItem = product.category === 'Fruits' || product.category === 'Vegetables' ? 0.5 : 0.3
          totalFoodSaved += weightPerItem
        }
      })

      const co2 = totalFoodSaved * 0.5
      const trees = co2 / 20

      setImpactStats({
        foodSaved: Math.round(totalFoodSaved * 10) / 10,
        moneySaved: Math.round(totalMoneySaved),
        co2Saved: Math.round(co2 * 10) / 10,
        trees: Math.round(trees * 10) / 10,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingImpact(false)
    }
  }

  // ---------- Fetch Active Reservations ----------
  const fetchActiveReservations = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          inventory_id,
          pickup_code,
          reserved_at,
          expires_at,
          status,
          inventory ( products ( name, store_id, stores ( name ) ) )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error
      setActiveReservations(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  // ---------- Fetch Order History ----------
  const fetchOrderHistory = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          pickup_code,
          status,
          payment_status,
          created_at,
          vendor_note,
          inventory ( products ( name, original_price, current_discount, stores ( name ) ) )
        `)
        .eq('user_id', user.id)
        .neq('status', 'active') // exclude active
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrderHistory(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  // ---------- Fetch Recommendations ----------
  const fetchRecommendations = async () => {
    if (!user) return
    try {
      const { data: pastOrders, error: orderErr } = await supabase
        .from('reservations')
        .select(`
          inventory ( products ( category, store_id ) )
        `)
        .eq('user_id', user.id)
        .eq('status', 'picked_up')

      if (orderErr) throw orderErr

      const categoryCounts: Record<string, number> = {}
      pastOrders?.forEach((r: any) => {
        const cat = r.inventory?.products?.category
        if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      })
      const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
      const topCategory = sorted.length > 0 ? sorted[0][0] : null

      if (!topCategory) {
        const { data: randomProducts } = await supabase
          .from('products')
          .select(`
            id,
            name,
            original_price,
            current_discount,
            sell_by,
            inventory!inner ( id, quantity, reserved ),
            stores ( name )
          `)
          .gt('sell_by', new Date().toISOString())
          .gt('current_discount', 0)
          .limit(5)

        const formatted = randomProducts?.map((p: any) => ({
          id: p.id,
          name: p.name,
          original_price: p.original_price,
          current_discount: p.current_discount || 0,
          discounted_price: p.original_price - (p.current_discount || 0),
          sell_by: p.sell_by,
          inventory_id: p.inventory?.id,
          available: (p.inventory?.quantity || 0) - (p.inventory?.reserved || 0),
          store_name: p.stores?.name || 'Unknown',
        })) || []
        setRecommendations(formatted)
        return
      }

      const { data: recommended, error: recErr } = await supabase
        .from('products')
        .select(`
          id,
          name,
          original_price,
          current_discount,
          sell_by,
          inventory!inner ( id, quantity, reserved ),
          stores ( name )
        `)
        .eq('category', topCategory)
        .gt('sell_by', new Date().toISOString())
        .gt('current_discount', 0)
        .limit(5)

      if (recErr) throw recErr

      const formattedRecs = recommended?.map((p: any) => ({
        id: p.id,
        name: p.name,
        original_price: p.original_price,
        current_discount: p.current_discount || 0,
        discounted_price: p.original_price - (p.current_discount || 0),
        sell_by: p.sell_by,
        inventory_id: p.inventory?.id,
        available: (p.inventory?.quantity || 0) - (p.inventory?.reserved || 0),
        store_name: p.stores?.name || 'Unknown',
      })) || []
      setRecommendations(formattedRecs)
    } catch (err) {
      console.error(err)
      setRecommendations([])
    }
  }

  // ---------- Fetch Rated Stores ----------
  const fetchRatedStores = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          store_id,
          rating,
          comment,
          created_at,
          stores ( name )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      const mapped = data?.map((r: any) => ({
        store_id: r.store_id,
        store_name: r.stores?.name || 'Unknown',
        rating: r.rating,
        comment: r.comment || '',
        created_at: r.created_at,
      })) || []
      setRatedStores(mapped)
    } catch (err) {
      console.error(err)
    }
  }

  // ---------- Fetch Nearby Stores ----------
  const fetchNearbyStores = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .rpc('nearby_stores_with_rating', { lat: userLat, lng: userLng, radius_km: 10 })
      if (error) throw error
      setStores(data || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Initial data load ----------
  useEffect(() => {
    if (user) {
      fetchImpactStats()
      fetchActiveReservations()
      fetchOrderHistory()
      fetchRecommendations()
      fetchRatedStores()
      fetchNearbyStores()
    }
  }, [user])

  // ---------- Actions ----------
  const deleteReservation = async (reservationId: string) => {
    if (!confirm('Cancel this reservation? The item will be released back to the store.')) return
    try {
      const { data, error } = await supabase
        .rpc('cancel_reservation', { p_reservation_id: reservationId })
      if (error) throw error
      toast.success('Reservation cancelled and inventory released.')
      // Immediately refresh both active and history lists
      await fetchActiveReservations()
      await fetchOrderHistory()
    } catch (err: any) {
      console.error('Cancel error:', err)
      toast.error(err.message || 'Failed to cancel reservation.')
    }
  }

  const sendNoteToVendor = async (reservationId: string, vendorId: string, note: string) => {
    if (!note.trim()) { toast.warning('Please write a note.'); return }
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: vendorId,
          title: '📝 Message from customer',
          body: note,
          data: { reservation_id: reservationId },
        })
      if (error) throw error
      toast.success('Note sent to vendor!')
      setNoteInputs(prev => ({ ...prev, [reservationId]: '' }))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const remindMe = () => {
    toast.info('⏰ We will remind you 10 minutes before expiry!')
  }

  // ---------- Chat ----------
  const openChat = async (reservationId: string, partnerId: string) => {
    setChatReservationId(reservationId)
    setChatPartnerId(partnerId)
    setShowChat(true)
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true })
    if (!error) setChatMessages(data || [])
    await supabase
      .from('chats')
      .update({ is_read: true })
      .eq('reservation_id', reservationId)
      .eq('receiver_id', user?.id)
  }

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !chatReservationId || !chatPartnerId) return
    try {
      const { error } = await supabase
        .from('chats')
        .insert({
          reservation_id: chatReservationId,
          sender_id: user?.id,
          receiver_id: chatPartnerId,
          message: newMessage.trim(),
        })
      if (error) throw error
      setNewMessage('')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    if (!chatReservationId) return
    const channel = supabase
      .channel(`chat-${chatReservationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `reservation_id=eq.${chatReservationId}`,
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new as any])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chatReservationId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ---------- Rating ----------
  const submitRating = async () => {
    if (!selectedStore || !user) return
    if (rating < 1 || rating > 5) {
      toast.warning('Please select a rating between 1 and 5')
      return
    }
    try {
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', selectedStore.id)
      if (prodErr) throw prodErr
      const productIds = products?.map(p => p.id) || []
      if (productIds.length === 0) {
        toast.warning('No products found for this store.')
        return
      }

      const { data: inventories, error: invErr } = await supabase
        .from('inventory')
        .select('id')
        .in('product_id', productIds)
      if (invErr) throw invErr
      const inventoryIds = inventories?.map(i => i.id) || []
      if (inventoryIds.length === 0) {
        toast.warning('No inventory for this store.')
        return
      }

      const { data: reservations, error: resErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'picked_up')
        .in('inventory_id', inventoryIds)
      if (resErr) throw resErr
      if (!reservations || reservations.length === 0) {
        toast.warning('You have no picked‑up reservations for this store.')
        return
      }
      const reservationId = reservations[0].id

      const { error } = await supabase
        .from('ratings')
        .insert({
          user_id: user.id,
          store_id: selectedStore.id,
          reservation_id: reservationId,
          rating,
          comment: comment.trim() || null,
        })
      if (error) throw error
      toast.success('Rating submitted!')
      setShowRatingModal(false)
      setSelectedStore(null)
      fetchRatedStores()
      fetchNearbyStores()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleChat = async (storeId: string) => {
    if (!user) return
    try {
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
      if (prodErr) throw prodErr
      const productIds = products?.map(p => p.id) || []
      if (productIds.length === 0) {
        toast.warning('No products for this store.')
        return
      }

      const { data: inventories, error: invErr } = await supabase
        .from('inventory')
        .select('id')
        .in('product_id', productIds)
      if (invErr) throw invErr
      const inventoryIds = inventories?.map(i => i.id) || []
      if (inventoryIds.length === 0) {
        toast.warning('No inventory for this store.')
        return
      }

      const { data: reservations, error: resErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('inventory_id', inventoryIds)
      if (resErr) throw resErr
      if (!reservations || reservations.length === 0) {
        toast.warning('You have no active reservation at this store.')
        return
      }
      const reservationId = reservations[0].id

      const { data: staff, error: staffErr } = await supabase
        .from('store_staff')
        .select('user_id')
        .eq('store_id', storeId)
        .limit(1)
      if (staffErr) throw staffErr
      if (!staff || staff.length === 0) {
        toast.warning('No vendor contact for this store.')
        return
      }

      openChat(reservationId, staff[0].user_id)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ---------- Sidebar navigation ----------
  const navItems = [

    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'flash_alerts', label: 'Flash Alerts', icon: <Clock className="w-5 h-5" /> },
    { id: 'smart_picks', label: 'Smart Picks', icon: <Zap className="w-5 h-5" /> },
    { id: 'rated_stores', label: 'Rated Stores', icon: <ThumbsUp className="w-5 h-5" /> },
    { id: 'nearby_stores', label: 'Nearby Stores', icon: <MapPin className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  ]

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading || loadingImpact) return <LoadingPage />

  return ( <MotionWrapper className="flex h-screen bg-gray-100 overflow-hidden">
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
  <div className="flex items-center justify-between p-4 border-b">
    <h2 className={`font-bold text-green-700 ${!sidebarOpen && 'hidden'}`}>User Panel</h2>
    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-100">
      {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
      ><motion.button
  key={item.id}
  whileHover={{ scale: 1.02, x: 4 }}
  whileTap={{ scale: 0.98 }}
  onClick={() => setActiveTab(item.id as any)}
  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
    activeTab === item.id ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'
  }`}
>
        {item.icon}
        <span className={sidebarOpen ? 'block' : 'hidden'}>{item.label}</span>
        </motion.button>
      </button>
    ))}
  </nav>
  <div className="p-4 border-t space-y-2">
    <Link
      to="/deals"
      className="w-full flex items-center gap-3 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
    >
      <ShoppingBag className="w-5 h-5" />
      <span className={sidebarOpen ? 'block' : 'hidden'}>Browse Deals</span>
    </Link>
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
        {/* ---------- Overview ---------- */}
        {activeTab === 'overview' && (
          <div>
            <h1 className="text-3xl font-bold text-green-700 mb-4">Overview</h1>
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-semibold flex items-center gap-2 text-green-700">
                <Leaf className="w-5 h-5" /> Your Impact
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{impactStats.foodSaved} kg</p>
                  <p className="text-xs text-gray-500">Food Saved</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">रू {impactStats.moneySaved}</p>
                  <p className="text-xs text-gray-500">Money Saved</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-700">{impactStats.co2Saved} kg</p>
                  <p className="text-xs text-gray-500">CO₂ Saved</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-700">{impactStats.trees}</p>
                  <p className="text-xs text-gray-500">Trees Equivalent</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Flash Alerts ---------- */}
        {activeTab === 'flash_alerts' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700 mb-4">Flash Alerts</h1>
            <div className="bg-white rounded-xl shadow p-4">
              {activeReservations.length === 0 ? (
                <p className="text-gray-500">No active reservations.</p>
              ) : (
                <div className="space-y-3">
                  {activeReservations.map((res) => (
                    <FlashAlertItem
                      key={res.id}
                      reservation={res}
                      onCancel={deleteReservation}
                      onSendNote={sendNoteToVendor}
                      onChat={openChat}
                      onRemind={remindMe}
                      noteInput={noteInputs[res.id] || ''}
                      setNoteInput={(value) => setNoteInputs(prev => ({ ...prev, [res.id]: value }))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- Smart Picks ---------- */}
        {activeTab === 'smart_picks' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700 mb-4">Smart Picks</h1>
            <div className="bg-white rounded-xl shadow p-4">
              {recommendations.length === 0 ? (
                <p className="text-gray-500">No recommendations yet. Start shopping!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="border rounded-lg p-3 hover:shadow transition">
                      <p className="font-medium">{rec.name}</p>
                      <p className="text-sm text-gray-500">{rec.store_name}</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-lg font-bold text-green-600">
                          रू {rec.discounted_price.toFixed(2)}
                        </span>
                        {rec.current_discount > 0 && (
                          <span className="text-sm text-gray-400 line-through">
                            रू {rec.original_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/reserve/${rec.inventory_id}`}
                        className="mt-2 block text-center bg-green-600 text-white py-1 rounded hover:bg-green-700"
                      >
                        Reserve
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- Rated Stores ---------- */}
        {activeTab === 'rated_stores' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700 mb-4">Rated Stores</h1>
            <div className="bg-white rounded-xl shadow p-4">
              {ratedStores.length === 0 ? (
                <p className="text-gray-500">You haven't rated any stores yet.</p>
              ) : (
                <ul className="divide-y">
                  {ratedStores.map((r) => (
                    <li key={r.store_id} className="py-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{r.store_name}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span>{r.rating}.0</span>
                          </div>
                          {r.comment && <p className="text-sm text-gray-600 mt-1">"{r.comment}"</p>}
                          <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ---------- Nearby Stores ---------- */}
        {activeTab === 'nearby_stores' && (
          <div>
            <h1 className="text-2xl font-bold text-green-700 mb-4">Nearby Stores</h1>
            {!hasLocation && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ Location access blocked. Showing stores near Kathmandu (fallback).<br />
                <button onClick={() => window.location.reload()} className="text-blue-600 hover:underline">
                  Retry location
                </button>
              </div>
            )}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search stores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Search className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              {filteredStores.length === 0 ? (
                <p className="text-gray-500">No stores found nearby.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredStores.map((store) => (
                    <div key={store.id} className="border rounded-lg p-3 hover:shadow transition">
                      <h3 className="font-semibold">{store.name}</h3>
                      <p className="text-sm text-gray-500">{store.address}</p>
                      <p className="text-sm">📏 {store.distance_km.toFixed(1)} km</p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{store.avg_rating ? store.avg_rating.toFixed(1) : 'No ratings'}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { setSelectedStore(store); setShowRatingModal(true) }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Rate Store
                        </button>
                        <button
                          onClick={() => handleChat(store.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          <MessageCircle className="w-4 h-4 inline mr-1" /> Chat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- History ---------- */}
        {activeTab === 'history' && (
  <div>
    <h1 className="text-2xl font-bold text-green-700 mb-4">Order History</h1>
    <div className="bg-white rounded-xl shadow p-4">
      {orderHistory.length === 0 ? (
        <p className="text-gray-500">No past orders.</p>
      ) : (
        <ul className="divide-y">
          {orderHistory.map((order) => {
            const product = order.inventory?.products
            const store = product?.stores
            const amount = product ? product.original_price - (product.current_discount || 0) : 0
            return (
              <li key={order.id} className="py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{product?.name || 'Item'}</p>
                    <p className="text-sm text-gray-500">{store?.name || 'Store'}</p>
                    <p className="text-sm">Status: <span className="font-medium">{order.status}</span></p>
                    {order.payment_status && (
                      <p className="text-sm">Payment: <span className="font-medium">{order.payment_status}</span></p>
                    )}
                    {order.vendor_note && (
                      <p className="text-sm text-blue-600 mt-1">📝 Vendor note: {order.vendor_note}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">रू {amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  </div>
)}
      </main>

      {/* Rating Modal */}
      {showRatingModal && selectedStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold">Rate {selectedStore.name}</h2>
            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-3xl focus:outline-none"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Leave a comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full mt-2 p-2 border rounded-lg"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={submitRating} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Submit Rating
              </button>
              <button onClick={() => { setShowRatingModal(false); setSelectedStore(null) }} className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChat && chatReservationId && chatPartnerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold">💬 Bargaining</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-72">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-1 rounded-lg ${msg.sender_id === user?.id ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-[10px] opacity-70">{new Date(msg.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-1 border rounded-lg text-sm"
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <button onClick={sendChatMessage} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
      )}
    </div>
    </MotionWrapper>
  )
}