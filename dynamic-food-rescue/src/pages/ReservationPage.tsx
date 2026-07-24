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

  // Delivery states
  const [requestDelivery, setRequestDelivery] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [savingDelivery, setSavingDelivery] = useState(false)

  // ---------- Fetch product & existing reservation ----------
  useEffect(() => {
    const fetchData = async () => {
      if (!inventoryId) {
        toast.error('Invalid item')
        navigate('/deals')
        return
      }

      try {
        let existingReservation = null
        if (user) {
          const { data: existing, error: existErr } = await supabase
            .from('reservations')
            .select(`
              id,
              pickup_code,
              reserved_at,
              expires_at,
              status,
              payment_status,
              delivery_address,
              delivery_fee,
              delivery_status,
              inventory ( products ( name, stores ( name, address ) ) )
            `)
            .eq('user_id', user.id)
            .eq('inventory_id', inventoryId)
            .eq('status', 'active')
            .maybeSingle()
          if (!existErr && existing) existingReservation = existing
        }

        const { data: invData, error: invError } = await supabase
          .from('inventory')
          .select(`
            id,
            quantity,
            reserved,
            products ( id, name, original_price, current_discount, sell_by, stores ( name, address ) )
          `)
          .eq('id', inventoryId)
          .single()

        if (invError) throw invError
        if (!invData) {
          toast.error('Item not found')
          navigate('/deals')
          return
        }

        const prod = invData.products as any
        const store = prod?.stores as any
        const available = (invData.quantity || 0) - (invData.reserved || 0)
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

        if (existingReservation) {
          setReservation(existingReservation)
          // Pre-fill delivery details if any
          if (existingReservation.delivery_address) {
            setRequestDelivery(true)
            setDeliveryAddress(existingReservation.delivery_address)
          }
          toast.info('You already have a reservation for this item.')
        }
      } catch (err: any) {
        console.error('Error:', err)
        toast.error(err.message || 'Failed to load')
        navigate('/deals')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [inventoryId, user, navigate])

  // ---------- Reserve ----------
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

      // Fetch the full reservation
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          id,
          pickup_code,
          reserved_at,
          expires_at,
          status,
          payment_status,
          delivery_address,
          delivery_fee,
          delivery_status,
          inventory ( products ( name, stores ( name, address ) ) )
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

  // ---------- Delivery handler ----------
  const handleSaveDelivery = async () => {
    if (requestDelivery && !deliveryAddress.trim()) {
      toast.warning('Please enter a delivery address.')
      return
    }
    setSavingDelivery(true)
    try {
      const { error } = await supabase
        .from('reservations')
        .update({
          delivery_address: requestDelivery ? deliveryAddress : null,
          delivery_fee: requestDelivery ? 50 : 0,
          delivery_status: requestDelivery ? 'pending' : 'not_requested',
        })
        .eq('id', reservation.id)
      if (error) throw error
      toast.success('Delivery details saved!')
      setReservation({
        ...reservation,
        delivery_address: deliveryAddress,
        delivery_fee: requestDelivery ? 50 : 0,
        delivery_status: requestDelivery ? 'pending' : 'not_requested',
      })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingDelivery(false)
    }
  }

  // ---------- Countdown ----------
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

  // ---------- eSewa Payment ----------
  const initiateEsewaPayment = () => {
    if (!product || !reservation) {
      toast.error('Missing reservation data')
      return
    }

    const amount = product.discounted_price + (reservation.delivery_fee || 0)
    const merchantCode = import.meta.env.VITE_ESEWA_MERCHANT_CODE || 'EPAYTEST'
    const paymentUrl = import.meta.env.VITE_ESEWA_PAYMENT_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
    const successUrl = import.meta.env.VITE_ESEWA_SUCCESS_URL || window.location.origin + '/payment-success'
    const failureUrl = import.meta.env.VITE_ESEWA_FAILURE_URL || window.location.origin + '/payment-failure'

    const pid = `DR_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = paymentUrl
    form.target = '_blank'

    const fields = {
      amt: amount.toFixed(2),
      psc: '0',
      pdc: '0',
      txAmt: '0',
      tAmt: amount.toFixed(2),
      pid: pid,
      scd: merchantCode,
      su: successUrl,
      fu: failureUrl,
    }

    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = String(value)
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  // ---------- Loading ----------
  if (loading) return <LoadingPage />

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

  // ---------- Already reserved – show QR, payment, delivery ----------
  if (reservation) {
    const inv = reservation.inventory as any
    const prod = inv?.products as any
    const store = prod?.stores as any

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="w-32 h-32 mx-auto bg-white p-2 border-2 border-gray-200 rounded-lg">
            <QRCode value={reservation.pickup_code} size={120} />
          </div>
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
          {timeLeft === 'Expired' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-medium">Reservation expired!</p>
              <button onClick={() => navigate('/deals')} className="mt-2 px-4 py-2 bg-red-600 text-white rounded">
                Back to Deals
              </button>
            </div>
          )}

          {/* Payment Options */}
          {reservation.payment_status !== 'paid' && timeLeft !== 'Expired' && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold text-lg">Payment Options</h3>
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={initiateEsewaPayment}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  💳 Pay with eSewa
                </button>
                <button
                  onClick={() => toast.info('Please pay in cash when you pick up the item.')}
                  className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  💵 Pay at Store (Cash)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {reservation.payment_status === 'pending'
                  ? 'Payment not yet processed.'
                  : 'Payment already completed.'}
              </p>
            </div>
          )}

          {reservation.payment_status === 'paid' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700">✅ Payment completed</p>
            </div>
          )}

          {/* Delivery Option – Always shown */}
          {timeLeft !== 'Expired' && (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-semibold text-lg">🚚 Delivery Option</h3>
              <p className="text-sm text-gray-600">Have it delivered to your doorstep (₹50 extra).</p>
              <label className="flex items-center gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  checked={requestDelivery}
                  onChange={(e) => setRequestDelivery(e.target.checked)}
                />
                Request delivery
              </label>
              {requestDelivery && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Enter delivery address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
              <button
                onClick={handleSaveDelivery}
                disabled={savingDelivery || (requestDelivery && !deliveryAddress.trim())}
                className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {savingDelivery ? 'Saving...' : 'Save Delivery Details'}
              </button>
              {reservation.delivery_address && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>📍 Delivery to: {reservation.delivery_address}</p>
                  <p>Fee: ₹{reservation.delivery_fee}</p>
                  <p>Status: {reservation.delivery_status}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ---------- Not reserved yet – show reserve button ----------
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
        <button
          onClick={handleReserve}
          disabled={reserving || product.available < 1}
          className={`mt-6 w-full py-3 rounded-lg font-medium text-white transition-colors ${
            reserving || product.available < 1 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {reserving ? 'Reserving...' : product.available < 1 ? 'Sold Out' : 'Reserve Now'}
        </button>
        <button
          onClick={() => navigate('/deals')}
          className="mt-3 w-full py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
        >
          Back to Deals
        </button>
      </div>
    </div>
  )
}