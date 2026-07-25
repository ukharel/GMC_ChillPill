import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import { PageTransition } from '@/components/PageTransition'
import { Gift, MapPin, Clock } from 'lucide-react'

interface Donation {
  id: string
  product_name: string
  quantity: number
  unit: string
  expiry_date: string
  pickup_deadline: string
  notes: string | null
  status: string
  store_id: string
  stores: {
    name: string
    address: string
  } | null
}

export const FreeFoodPage = () => {
  const { user } = useAuth()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)

  const fetchDonations = async () => {
    try {
      // Fetch donations and store names separately
      const { data: donationsData, error: donationsErr } = await supabase
        .from('donations')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
  
      if (donationsErr) throw donationsErr
  
      // Fetch store names for each donation
      const storeIds = donationsData?.map(d => d.store_id).filter(Boolean) || []
      let storeMap: Record<string, { name: string; address: string }> = {}
      if (storeIds.length) {
        const { data: storesData, error: storesErr } = await supabase
          .from('stores')
          .select('id, name, address')
          .in('id', storeIds)
        if (!storesErr) {
          storesData?.forEach(s => {
            storeMap[s.id] = { name: s.name, address: s.address }
          })
        }
      }
  
      const mapped = donationsData?.map((d: any) => ({
        ...d,
        stores: storeMap[d.store_id] || { name: 'Unknown Store', address: 'No address' },
      })) || []
  
      setDonations(mapped)
    } catch (err) {
      console.error(err)
      toast.error('Could not load free food listings.')
    } finally {
      setLoading(false)
    }
  }
       

  useEffect(() => {
    fetchDonations()
    const channel = supabase
      .channel('free-food-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, fetchDonations)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleClaim = async (donationId: string, storeId: string, productName: string) => {
    if (!user) {
      toast.error('Please login first')
      return
    }

    setClaiming(donationId)

    try {
      const { data: staff, error: staffErr } = await supabase
        .from('store_staff')
        .select('user_id')
        .eq('store_id', storeId)
        .maybeSingle()

      if (staffErr) throw staffErr
      if (!staff) {
        toast.error('Vendor not found for this donation.')
        return
      }
      const vendorId = staff.user_id

      const { error: updateErr } = await supabase
        .from('donations')
        .update({
          status: 'claimed',
          claimed_by: user.id,
        })
        .eq('id', donationId)

      if (updateErr) throw updateErr

      await supabase
        .from('notifications')
        .insert({
          user_id: vendorId,
          title: '📦 Donation Claimed',
          body: `Your donation of ${productName} has been claimed by a user.`,
          data: { donation_id: donationId },
        })

      toast.success('Donation claimed! Vendor will be notified.')
      fetchDonations()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to claim donation')
    } finally {
      setClaiming(null)
    }
  }

  if (loading) return <LoadingPage />

  return (
    <PageTransition className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-8 h-8 text-green-600" />
          <h1 className="text-3xl font-bold text-green-700">Free Food</h1>
        </div>
        <p className="text-gray-600 mb-6">Surplus food donated by local stores. Claim it for free!</p>

        {donations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <Gift className="w-16 h-16 text-gray-300 mx-auto" />
            <p className="text-gray-500 mt-3">No free food available right now.</p>
            <p className="text-sm text-gray-400">Check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {donations.map((d) => (
              <div key={d.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="p-4 border-l-4 border-green-500">
                  <h3 className="font-semibold text-lg">{d.product_name}</h3>
                  <div className="mt-1 space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Quantity:</span> {d.quantity} {d.unit}
                    </p>
                    <p>
                      <span className="font-medium">Store:</span> {d.stores?.name || 'Unknown'}
                    </p>
                    {d.stores?.address && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <MapPin className="w-4 h-4" />
                        <span>{d.stores.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>Expires: {new Date(d.expiry_date).toLocaleDateString()}</span>
                    </div>
                    {d.notes && (
                      <p className="text-gray-500 italic mt-1">📝 {d.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleClaim(d.id, d.store_id, d.product_name)}
                    disabled={claiming === d.id}
                    className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {claiming === d.id ? 'Claiming...' : 'Claim for Free'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}