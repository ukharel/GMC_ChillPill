import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '../../@/components/ui/button'
import { Input } from '../../@/components/ui/input'
import { toast } from 'sonner'

const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    role: z.enum(['user', 'vendor']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type SignupFormData = z.infer<typeof signupSchema>

export const SignupPage = () => {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: 'user',
    },
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    try {
      await signUp(data.email, data.password, data.role)
      toast.success(
        data.role === 'vendor'
          ? 'Vendor account created! Please log in.'
          : 'Account created! Please log in.'
      )
      navigate('/login')
    } catch (error: any) {
      console.error('Signup error:', error)
      toast.error(error.message || 'Signup failed. Please check your details and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center text-green-700">Join Food Rescue</h2>
        <p className="text-center text-gray-600 mt-1">Save food, save money, save the planet 🌱</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input type="email" placeholder="Email" {...register('email')} />
            {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Input type="password" placeholder="Password" {...register('password')} />
            {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <Input type="password" placeholder="Confirm Password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-red-600 mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">I am a...</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="user"
                  {...register('role')}
                  className="text-green-600 focus:ring-green-500"
                />
                <span>Shopper (User)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="vendor"
                  {...register('role')}
                  className="text-green-600 focus:ring-green-500"
                />
                <span>Store Vendor</span>
              </label>
            </div>
            {errors.role && <p className="text-sm text-red-600">{errors.role.message}</p>}
          </div>

          {selectedRole === 'vendor' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              💼 You'll be able to add products, manage inventory, and track orders.
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-green-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}