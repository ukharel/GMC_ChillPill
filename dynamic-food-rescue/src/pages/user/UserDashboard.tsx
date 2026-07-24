import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import { Link } from 'react-router-dom'
import { Star, ShoppingBag, MapPin, MessageCircle } from 'lucide-react'

export const UserDashboard = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      try {
        // Orders history
        const { data: orderData } = await supabase
          .from('reservations')
          .select(`
            id,
            pickup_code,
            status,
            created_at,
            inventory (products (name, original_price, current_discount))
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        // Delivery addresses
        const { data: addrData } = await supabase
          .from('delivery_addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })

        setOrders(orderData || [])
        setAddresses(addrData || [])
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  // Search stores (for finding deals)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    // Redirect to deals page with search param
    window.location.href = `/deals?search=${encodeURIComponent(searchQuery)}`
  }

  if (loading) return <LoadingPage />

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold text-green-700">My Dashboard</h1>

      {/* Search Location */}
      <div className="mt-4 flex space-x-2">
        <input
          type="text"
          placeholder="Search for stores or products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Search
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Order History */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold text-lg flex items-center">
            <ShoppingBag className="w-5 h-5 mr-2" /> Orders
          </h2>
          {orders.length === 0 ? (
            <p className="text-gray-500">No orders yet</p>
          ) : (
            <ul className="divide-y">
              {orders.slice(0, 5).map((order) => {
                const prod = order.inventory?.products
                const price = prod ? prod.original_price - (prod.current_discount || 0) : 0
                return (
                  <li key={order.id} className="py-2">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{prod?.name || 'Item'}</p>
                        <p className="text-sm text-gray-500">रू {price}</p>
                      </div>
                      <span className={`text-sm ${order.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
                    {order.status === 'picked_up' && (
                      <Link
                        to={`/rate/${order.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Rate Store
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Delivery Addresses */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold text-lg flex items-center">
            <MapPin className="w-5 h-5 mr-2" /> Addresses
          </h2>
          {addresses.length === 0 ? (
            <p className="text-gray-500">No addresses added</p>
          ) : (
            <ul className="space-y-2">
              {addresses.map((addr) => (
                <li key={addr.id} className="p-2 border rounded-lg">
                  <p>{addr.address}</p>
                  {addr.is_default && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Default</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => window.location.href = '/user/addresses'}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Manage Addresses
          </button>
        </div>
      </div>
    </div>
  )
}