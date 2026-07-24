import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '../../@/components/ui/button'
import { Input } from '../../@/components/ui/input'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export const LoginPage = () => {
  const { signIn, user, profile } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await signIn(data.email, data.password)
      toast.success('Welcome back!')

      // Wait a moment for the auth state to update
      // The profile may not be available immediately, so we use a small delay
      // Alternatively, we can use the user_metadata from the session
      await new Promise(resolve => setTimeout(resolve, 500))

      // Determine redirect based on role from user metadata or profile
      const role = profile?.role || user?.user_metadata?.role || 'user'

      if (role === 'vendor') {
        navigate('/vendor/dashboard')
      } else if (role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/dashboard') // user dashboard
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center text-green-700">Food Rescue</h2>
        <p className="text-center text-gray-600 mt-1">Save food, save money 🌱</p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input type="email" placeholder="Email" {...register('email')} />
            {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Input type="password" placeholder="Password" {...register('password')} />
            {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account? <Link to="/signup" className="text-green-600 font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}