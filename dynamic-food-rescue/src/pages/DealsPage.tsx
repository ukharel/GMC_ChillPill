import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { LoadingPage } from '@/pages/LoadingPage'
import { motion } from 'framer-motion'
import { MotionWrapper } from '@/components/MotionWrapper'
interface Deal {
  product_id: string
  product_name: string
  store_id: string
  store_name: string
  original_price: number
  discount: number
  discounted_price: number
  sell_by: string
  inventory_id: string
  available: number
  distance_km: number
}

// ---------- Inline DealCard ----------
const DealCard = ({
  product_name,
  store_name,
  original_price,
  discount,
  discounted_price,
  sell_by,
  inventory_id,
  available,
  distance_km,
}: Omit<Deal, 'product_id' | 'store_id'>) => {
  const discountPercent = Math.round((discount / original_price) * 100)
  const isAvailable = available > 0

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg text-gray-800">{product_name}</h3>
            <p className="text-sm text-gray-500">{store_name}</p>
          </div>
          {discountPercent > 0 && (
            
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <motion.span
  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
  animate={{ scale: [1, 1.05, 1] }}
  transition={{ duration: 1.5, repeat: Infinity }}
>
              {discountPercent}% OFF
              </motion.span>
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-lg font-bold text-green-600">
            रू {discounted_price.toFixed(2)}
          </span>
          {discount > 0 && (
            <span className="text-sm text-gray-400 line-through">
              रू {original_price.toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center text-sm text-gray-500">
          <span className="mr-4">📏 {distance_km.toFixed(1)} km</span>
          <span>📦 {isAvailable ? `${available} left` : 'Sold out'}</span>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          ⏳ {new Date(sell_by).toLocaleString()}
        </div>
        <Link
          to={isAvailable ? `/reserve/${inventory_id}` : '#'}
          className={`mt-4 w-full block text-center py-2 px-4 rounded-lg font-medium transition-colors ${
            isAvailable
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
          }`}
        >
          {isAvailable ? 'Reserve Now' : 'Sold Out'}
        </Link>
      </div>
    </div>
  )
}

// ---------- Main DealsPage ----------
export const DealsPage = () => {
  const { signOut } = useAuth()
  const { latitude, longitude, isLoading: locationLoading, error: locationError } = useGeolocation()
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('')

  const lat = latitude || 27.7172
  const lng = longitude || 85.3240

  // ---------- Fetch Deals ----------
  const fetchDeals = useCallback(async () => {
    setIsLoading(true)
    try {
      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('nearby_products', {
        lat,
        lng,
        radius_km: 50,
      })

      if (!rpcError && rpcData && rpcData.length > 0) {
        setDeals(rpcData)
        return
      }

      // Fallback direct query
      console.warn('RPC failed or empty, falling back to direct query')
      const { data: directData, error: directError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          original_price,
          current_discount,
          sell_by,
          store_id,
          stores (name),
          inventory!inner (id, quantity, reserved)
        `)
        .gt('sell_by', new Date().toISOString())

      if (directError) throw directError

      const formatted = directData.map((p: any) => ({
        product_id: p.id,
        product_name: p.name,
        store_id: p.store_id,
        store_name: p.stores?.name || 'Unknown Store',
        original_price: p.original_price,
        discount: p.current_discount || 0,
        discounted_price: p.original_price - (p.current_discount || 0),
        sell_by: p.sell_by,
        inventory_id: p.inventory?.id || '',
        available: (p.inventory?.quantity || 0) - (p.inventory?.reserved || 0),
        distance_km: 0,
      }))
      setDeals(formatted)
    } catch (err: any) {
      console.error('Error fetching deals:', err)
      toast.error(err.message || 'Failed to load deals')
    } finally {
      setIsLoading(false)
    }
  }, [lat, lng])

  // ---------- Initial load + Realtime subscription ----------
  useEffect(() => {
    fetchDeals()
  
    const channel = supabase
      .channel('deals-changes')
      // Listen to product updates (name, price, discount, sell_by)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          console.log('🔄 Product changed – refreshing deals')
          fetchDeals()
        }
      )
      // Listen to inventory updates (quantity, reserved)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory' },
        () => {
          console.log('🔄 Inventory changed – refreshing deals')
          fetchDeals()
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
      })
  
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDeals])

  // ---------- Loading / Error States ----------
  if (locationLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    
    <MotionWrapper className="min-h-screen bg-gray-50 p-4 pb-20">
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-700">Food Rescue</h1>
          <p className="text-sm text-gray-500">Fresh deals near you</p>
        </div>
        <div className="flex items-center space-x-3">
        <Link
  to="/free-food"
  className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
>
  🎁 Free Food
</Link>
          {subscriptionStatus !== 'SUBSCRIBED' && (
            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
              ⚠️ Updates delayed
            </span>
          )}
          <button
            onClick={signOut}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Logout
          </button>
          <button
      onClick={fetchDeals}
      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
    >
      🔄 Refresh
    </button>
        </div>
      </header>

      {locationError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ Could not get your location. Showing deals near Kathmandu (fallback).
        </div>
      )}

      {deals.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No deals available nearby right now.</p>
          <p className="text-sm text-gray-400">Check back later!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal,index) => (
            <motion.div
            key={deal.inventory_id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
          >
            <DealCard
              key={deal.inventory_id}
              product_name={deal.product_name}
              store_name={deal.store_name}
              original_price={deal.original_price}
              discount={deal.discount}
              discounted_price={deal.discounted_price}
              sell_by={deal.sell_by}
              inventory_id={deal.inventory_id}
              available={deal.available}
              distance_km={deal.distance_km}
            />
            </motion.div>
          ))}
          
        </div>
        
      )}
    </div>
    </MotionWrapper>
  )
}