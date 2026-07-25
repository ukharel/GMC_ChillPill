import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, CheckCircle } from 'lucide-react'
import { LoadingPage } from '@/pages/LoadingPage'

export const SubscriptionPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .limit(1)
          .maybeSingle()
        if (error) throw error
        setPlan(data)
      } catch (err) {
        console.error('Plan fetch error:', err)
        toast.error('Failed to load plan')
      } finally {
        setLoadingPlan(false)
      }
    }
    fetchPlan()
  }, [])

  const handleSubscribe = async () => {
    if (!user || !plan) {
      toast.error('No plan available')
      return
    }

    setLoading(true)
    const pid = `SUB_${user.id}_${Date.now()}`

    try {
      // 1. Check if the vendor already has a subscription
      const { data: existing, error: checkErr } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('vendor_id', user.id)
        .maybeSingle()

      if (checkErr) throw checkErr

      if (existing) {
        // 2. Update existing subscription (renew/upgrade)
        const { error: updateErr } = await supabase
          .from('subscriptions')
          .update({
            plan_id: plan.id,
            status: 'pending',
            payment_status: 'pending',
            transaction_id: pid,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', existing.id)
        if (updateErr) throw updateErr
      } else {
        // 3. Insert new subscription
        const { error: insertErr } = await supabase
          .from('subscriptions')
          .insert({
            vendor_id: user.id,
            plan_id: plan.id,
            status: 'pending',
            transaction_id: pid,
            payment_status: 'pending',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString(),
          })
        if (insertErr) {
          if (insertErr.code === '23505') {
            toast.error('You already have a pending or active subscription.')
            navigate('/vendor/dashboard')
            return
          }
          throw insertErr
        }
      }

      // 4. Initiate eSewa payment (same as before)
      const amount = plan.price
      const merchantCode = import.meta.env.VITE_ESEWA_MERCHANT_CODE || 'EPAYTEST'
      const paymentUrl = import.meta.env.VITE_ESEWA_PAYMENT_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
      const successUrl = import.meta.env.VITE_ESEWA_SUCCESS_URL || window.location.origin + '/payment-success'
      const failureUrl = import.meta.env.VITE_ESEWA_FAILURE_URL || window.location.origin + '/payment-failure'

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
    } catch (err: any) {
      console.error('Subscription error:', err)
      toast.error(err.message || 'Failed to initiate subscription')
      setLoading(false)
    }
  }

  if (loadingPlan) return <LoadingPage />

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500">No subscription plan available. Please contact support.</p>
          <button onClick={() => navigate('/vendor/dashboard')} className="mt-4 px-4 py-2 bg-green-600 text-white rounded">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
      >
        <div className="flex justify-center mb-4">
          <Crown className="w-16 h-16 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-green-700">Premium Plan</h2>
        <p className="text-gray-500 mt-1">Unlock all features and start selling</p>
        <div className="mt-6">
          <p className="text-4xl font-bold text-green-700">₹{plan.price}</p>
          <p className="text-sm text-gray-500">per {plan.duration_days} days</p>
        </div>
        <ul className="mt-6 space-y-2 text-left">
          {plan.features?.map((feature: string, i: number) => (
            <li key={i} className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="mt-8 w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
        >
          {loading ? 'Processing...' : 'Subscribe Now'}
        </button>
        <p className="text-xs text-gray-400 mt-4">You can cancel anytime.</p>
      </motion.div>
    </div>
  )
}