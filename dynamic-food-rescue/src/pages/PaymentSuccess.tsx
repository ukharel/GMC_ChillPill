import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export const PaymentSuccess = () => {
  const navigate = useNavigate()
  useEffect(() => {
    toast.success('Payment successful!')
    setTimeout(() => navigate('/deals'), 3000)
  }, [])
  return <div className="p-4 text-center"><h1 className="text-2xl">✅ Payment Successful</h1></div>
}