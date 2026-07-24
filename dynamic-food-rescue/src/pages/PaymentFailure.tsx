import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export const PaymentFailure = () => {
  const navigate = useNavigate()
  useEffect(() => {
    toast.error('Payment failed. Please try again.')
    setTimeout(() => navigate('/deals'), 3000)
  }, [])
  return <div className="p-4 text-center"><h1 className="text-2xl">❌ Payment Failed</h1></div>
}