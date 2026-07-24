import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export const Withdraw = () => {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [esewaAccount, setEsewaAccount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!esewaAccount) {
      toast.error('Enter eSewa account number')
      return
    }

    setLoading(true)
    try {
      // Get store_id
      const { data: staff } = await supabase
        .from('store_staff')
        .select('store_id')
        .eq('user_id', user?.id)
        .single()
      if (!staff) throw new Error('No store found')

      const { error } = await supabase
        .from('withdrawals')
        .insert({
          store_id: staff.store_id,
          amount: parseFloat(amount),
          esewa_account: esewaAccount,
        })
      if (error) throw error

      toast.success('Withdrawal request submitted. It will be processed within 24 hours.')
      setAmount('')
      setEsewaAccount('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 mt-10">
      <h1 className="text-2xl font-bold text-green-700">Withdraw to eSewa</h1>
      <div className="bg-white rounded-xl shadow p-6 mt-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Amount (NPR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">eSewa Account Number</label>
            <input
              type="text"
              value={esewaAccount}
              onChange={(e) => setEsewaAccount(e.target.value)}
              placeholder="e.g. 9801234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  )
}