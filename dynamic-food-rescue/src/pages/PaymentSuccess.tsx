import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { PageTransition } from '@/components/PageTransition'

export const PaymentSuccess = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [processing, setProcessing] = useState(true)

  useEffect(() => {
    const handleSuccess = async () => {
      const pid = searchParams.get('pid')
      if (!pid) {
        toast.error('Invalid payment response')
        setProcessing(false)
        return
      }

      if (pid.startsWith('SUB_')) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            payment_status: 'completed',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('transaction_id', pid)
          .eq('payment_status', 'pending')

        if (error) {
          console.error('Subscription update error:', error)
          toast.error('Failed to activate subscription. Please contact support.')
        } else {
          toast.success('Subscription activated! Welcome to the premium plan.')
        }
        setProcessing(false)
        setTimeout(() => navigate('/vendor/dashboard'), 3000)
        return
      }

      toast.success('Payment successful!')
      setProcessing(false)
      setTimeout(() => navigate('/deals'), 3000)
    }

    handleSuccess()
  }, [searchParams, navigate])

  return (
    <PageTransition className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mt-4">
          {processing ? 'Processing...' : 'Payment Successful!'}
        </h1>
        <p className="text-gray-500 mt-2">
          {processing ? 'Please wait...' : 'You will be redirected shortly.'}
        </p>
      </div>
    </PageTransition>
  )
}