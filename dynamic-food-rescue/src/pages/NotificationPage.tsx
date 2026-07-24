import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from './LoadingPage'
import { Bell, CheckCircle, Clock } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  data: any
  read_at: string | null
  created_at: string
}

export const NotificationsPage = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        setNotifications(data || [])
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()

    // Real‑time subscription for new notifications
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
          toast.info('New notification', { description: payload.new.title })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    } catch (err: any) {
      toast.error('Failed to mark as read')
    }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <Bell className="mr-2" /> Notifications
        </h1>
        {notifications.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`bg-white rounded-lg shadow p-4 transition ${
                  n.read_at ? 'opacity-75' : 'border-l-4 border-blue-500'
                }`}
                onClick={() => !n.read_at && markAsRead(n.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{n.title}</h3>
                    <p className="text-gray-600 text-sm">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {n.read_at ? (
                    <CheckCircle className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                {n.data?.reservation_id && (
                  <button
                    onClick={() => window.location.href = `/reserve/${n.data.reservation_id}`}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    View reservation
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}