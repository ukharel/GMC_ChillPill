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
  notes: string
  status: string
  stores: { name: string; address: string }
}

export const FreeFoodPage = () => {
  const { user } = useAuth()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)

  // Fetch active donations
  const fetchDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select(`
          *,
          stores ( name, address )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDonations(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load free food listings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDonations()

    // Realtime: refresh on changes
    const channel = supabase
      .channel('free-food')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, fetchDonations)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Claim handler
  const handleClaim = async (donationId: string, storeId: string, productName: string) => {
    if (!user) {
      toast.error('Please login first')
      return
    }

    setClaiming(donationId)

    // Get vendor user_id from store_staff
    const { data: staff, error: staffErr } = await supabase
      .from('store_staff')
      .select('user_id')
      .eq('store_id', storeId)
      .limit(1)

    if (staffErr || !staff || staff.length === 0) {
      toast.error('Vendor not found for this donation.')
      setClaiming(null)
      return
    }
    const vendorId = staff[0].user_id

    try {
      // Update donation
      const { error: updateErr } = await supabase
        .from('donations')
        .update({
          status: 'claimed',
          claimed_by: user.id,
        })
        .eq('id', donationId)

      if (updateErr) throw updateErr

      // Notify vendor
      await supabase
        .from('notifications')
        .insert({
          user_id: vendorId,
          title: '📦 Donation Claimed',
          body: `Your donation of ${productName} has been claimed by a user.`,
          data: { donation_id: donationId },
        })

      toast.success('Donation claimed! Vendor will be notified.')
      fetchDonations() // refresh list
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim')
    } finally {
      setClaiming(null)
    }
  }

  if (loading) return <LoadingPage />

  return (
    <PageTransition className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
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
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>{d.stores?.address || 'No address'}</span>
                    </div>
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