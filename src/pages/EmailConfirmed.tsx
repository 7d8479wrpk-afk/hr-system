import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export const EmailConfirmed = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Session check error', error.message)
        navigate('/auth', { replace: true })
        return
      }
      if (data.session) {
        navigate('/employees', { replace: true })
      } else {
        navigate('/auth', { replace: true })
      }
    }
    checkSession()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-md">
        <h1 className="text-2xl font-bold text-green-600">✅ Email Confirmed</h1>
        <p className="mt-3 text-gray-600">Your email has been successfully verified.</p>
        <p className="mt-1 text-sm text-gray-500">Redirecting you to your account…</p>
      </div>
    </div>
  )
}
