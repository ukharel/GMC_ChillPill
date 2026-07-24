import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import QRCode from 'react-qr-code'
import { LoadingPage } from './LoadingPage'

export const ReservationPage = () => {
  const { inventoryId } = useParams<{ inventoryId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState(false)
  const [reservation, setReservation] = useState<any>(null)
  const [product, setProduct] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState('')

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      if (!inventoryId) {
        toast.error('Invalid item')
        navigate('/deals')
        return
      }

      try {
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            id,
            quantity,
            reserved,
            products (
              id,
              name,
              original_price,
              current_discount,
              sell_by,
              stores (
                name,
                address
              )
            )
          `)
          .eq('id', inventoryId)
          .single()

        if (error) throw error
        if (!data) {
          toast.error('Item not found')
          navigate('/deals')
          return
        }

        // Safe extraction with fallbacks
        const prod = data.products as any
        const store = prod?.stores as any

        const available = (data.quantity || 0) - (data.reserved || 0)
        const originalPrice = prod?.original_price || 0
        const discount = prod?.current_discount || 0
        const discountedPrice = Math.max(originalPrice - discount, 0)

        setProduct({
          id: prod?.id,
          name: prod?.name || 'Unknown Product',
          store_name: store?.name || 'Unknown Store',
          store_address: store?.address || 'Address not provided',
          original_price: originalPrice,
          current_discount: discount,
          discounted_price: discountedPrice,
          sell_by: prod?.sell_by || new Date().toISOString(),
          available: available,
        })
      } catch (err: any) {
        console.error('Error fetching product:', err)
        toast.error(err.message || 'Failed to load product')
        navigate('/deals')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [inventoryId, navigate])
  const [paymentOption, setPaymentOption] = useState<string | null>(null)

  const handleEsewaPayment = () => {
    // Redirect to eSewa (we'll build this later)
    setPaymentOption('esewa')
    // Construct eSewa form and submit
  }
  
  const handleCashPayment = () => {
    setPaymentOption('cash')
    toast.info('Please pay in cash when you pick up the item.')
    // Optionally update payment_status to 'pending' (already default)
  }
  // Handle reservation
  const handleReserve = async () => {
    if (!user) {
      toast.error('Please login')
      navigate('/login')
      return
    }

    if (!inventoryId || !product || product.available < 1) {
      toast.error('Item is no longer available')
      return
    }

    setReserving(true)
    try {
      const { data, error } = await supabase.rpc('reserve_item', {
        p_inventory_id: inventoryId,
        p_user_id: user.id,
        p_quantity: 1,
      })

      if (error) {
        if (error.code === '23514') {
          toast.error('Sorry, this item was just reserved by someone else!')
        } else {
          toast.error(error.message || 'Reservation failed')
        }
        return
      }

      // Fetch the full reservation with nested product/store
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          id,
          pickup_code,
          reserved_at,
          expires_at,
          status,
          note,
          inventory (
            products (
              name,
              stores (
                name,
                address
              )
            )
          )
        `)
        .eq('id', data.reservation_id)
        .single()

      if (reservationError) throw reservationError

      setReservation(reservationData)
      toast.success('Reserved! Pick up within 1 hour.')
    } catch (err: any) {
      console.error('Reservation error:', err)
      toast.error(err.message || 'Something went wrong')
    } finally {
      setReserving(false)
    }
  }

  // Countdown timer
  useEffect(() => {
    if (!reservation?.expires_at) return

    const interval = setInterval(() => {
      const diff = new Date(reservation.expires_at).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        clearInterval(interval)
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${mins}m ${secs}s`)
    }, 1000)

    return () => clearInterval(interval)
  }, [reservation?.expires_at])

  // Loading
  if (loading) return <LoadingPage />

  // If product not found
  if (!product) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Item not found</p>
        <button onClick={() => navigate('/deals')} className="mt-4 px-4 py-2 bg-green-600 text-white rounded">
          Back to Deals
        </button>
      </div>
    )
  }

  // ----- Already reserved – show QR code -----
  if (reservation) {
    const inv = reservation.inventory as any
    const prod = inv?.products as any
    const store = prod?.stores as any
    

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="w-32 h-32 mx-auto bg-white p-2 border-2 border-gray-200 rounded-lg">
            <QRCode value={reservation.pickup_code} size={120} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
          </div>
          {reservation.note && (
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium">📝 Store Note:</p>
        <p>{reservation.note}</p>
      </div>
    )}
          <h2 className="text-xl font-bold mt-2">{prod?.name || 'Item'}</h2>
          <p className="text-gray-600">{store?.name || 'Store'}</p>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Pickup Code</p>
            <p className="text-2xl font-mono font-bold text-green-700">{reservation.pickup_code}</p>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Time remaining</p>
            <p className={`text-3xl font-bold ${timeLeft === 'Expired' ? 'text-red-600' : 'text-green-600'}`}>
              {timeLeft}
            </p>
          </div>
          <button onClick={() => navigate('/deals')} className="mt-6 w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition">
            Browse More
          </button>
        </div>
      </div>
    )
  }

  // ----- Not reserved yet – show Reserve button -----
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold">{product.name}</h2>
        <p className="text-gray-600">{product.store_name}</p>
        <p className="text-sm text-gray-500">{product.store_address}</p>

        <div className="mt-4 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-green-600">रू {product.discounted_price.toFixed(2)}</span>
          {product.current_discount > 0 && (
            <span className="text-sm text-gray-400 line-through">रू {product.original_price.toFixed(2)}</span>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-500">
          <p>🕐 {new Date(product.sell_by).toLocaleString()}</p>
          <p>📦 {product.available} left</p>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ Reserve now – you have 60 minutes to pick up.
        </div>
        {/* Payment Options */}
<div className="mt-6 border-t pt-4">
  <h3 className="font-semibold text-lg">Payment Options</h3>
  <div className="flex flex-col gap-2 mt-2">
    {/* Pay with eSewa */}
    <button
      onClick={handleEsewaPayment}
      className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
    >
      Pay with eSewa
    </button>
    {/* Pay at Store */}
    <button
      onClick={handleCashPayment}
      className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
    >
      Pay at Store (Cash)
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-2">
    {paymentOption === 'cash' ? 'You will pay when you pick up.' : 'You will be redirected to eSewa to complete payment.'}
  </p>
</div>

        <button
          onClick={handleReserve}
          disabled={reserving || product.available < 1}
          className={`mt-6 w-full py-3 rounded-lg font-medium text-white transition-colors ${
            reserving || product.available < 1 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {reserving ? 'Reserving...' : product.available < 1 ? 'Sold Out' : 'Reserve Now'}
        </button>

        <button onClick={() => navigate('/deals')} className="mt-3 w-full py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
          Back to Deals
        </button>
      </div>
    </div>
  )
}