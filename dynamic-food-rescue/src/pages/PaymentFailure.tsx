import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, CheckCircle, Zap } from 'lucide-react'
import { LoadingPage } from '@/pages/LoadingPage'

interface Plan {
  id: string
  name: string
  price: number
  duration_days: number
  features: string[]
}

export const SubscriptionPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price', { ascending: true })
      if (error) {
        console.error('Error fetching plans:', error)
        toast.error('Failed to load plans')
      } else {
        setPlans(data || [])
      }
      setLoadingPlans(false)
    }
    fetchPlans()
  }, [])

  const handleSubscribe = async (planId: string) => {
    if (!user || !planId) {
      toast.error('Please select a plan')
      return
    }

    const selected = plans.find(p => p.id === planId)
    if (!selected) return

    setLoading(true)

    const pid = `SUB_${user.id}_${Date.now()}`

    try {
      const { error: insertErr } = await supabase
        .from('subscriptions')
        .insert({
          vendor_id: user.id,
          plan_id: planId,
          status: 'pending',
          transaction_id: pid,
          payment_status: 'pending',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + selected.duration_days * 24 * 60 * 60 * 1000).toISOString(),
        })

      if (insertErr) {
        if (insertErr.code === '23505') {
          toast.error('You already have a pending or active subscription.')
          navigate('/vendor/dashboard')
          return
        }
        throw insertErr
      }

      const amount = selected.price
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

  if (loadingPlans) return <LoadingPage />

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center items-center gap-2 mb-2">
            <Crown className="w-10 h-10 text-green-600" />
            <h1 className="text-4xl font-bold text-green-700">Subscription</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the perfect plan for your store. Start with a <span className="font-semibold text-green-600">10‑day free trial</span>.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`bg-white rounded-2xl shadow-xl overflow-hidden border-2 transition ${
                selectedPlan === plan.id
                  ? 'border-green-500 shadow-2xl'
                  : 'border-transparent hover:shadow-2xl'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800">{plan.name}</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-4xl font-bold text-green-600">₹{plan.price}</span>
                  <span className="ml-2 text-gray-500">/ {plan.duration_days} days</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {plan.duration_days === 30 ? 'Monthly' : 'Custom'} plan
                </p>
              </div>
              <div className="px-6 pb-6">
                <ul className="space-y-2">
                  {plan.features?.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-6 pb-6">
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    selectedPlan === plan.id && !loading
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : selectedPlan === plan.id && loading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 cursor-pointer hover:bg-gray-200'
                  }`}
                >
                  {loading ? 'Processing...' : selectedPlan === plan.id ? 'Subscribe Now' : 'Select Plan'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-8">
          By subscribing, you agree to our terms. You can cancel anytime.
        </p>
      </div>
    </div>
  )
}