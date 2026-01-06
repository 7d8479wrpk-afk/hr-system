import { useEffect, useState } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import logo from '../assets/msd-logo.png'

export const AuthPage = () => {
  const { signIn, signUp, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user && !loading) {
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/employees'
      navigate(redirectTo, { replace: true })
    }
  }, [user, loading, navigate, location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    const action = mode === 'login' ? signIn : signUp
    const { error, message } = await action(email.trim(), password.trim())
    if (error) setError(error)
    if (message) setMessage(message)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-slate-50 px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-primary-100/50">
        <div className="mb-6 text-center">
          <div className="mb-6 flex justify-center">
            <img src={logo} alt="MSD" className="h-20 w-auto object-contain md:h-24" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">HR Employee Console</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Sign in to admin' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Admin access is required to manage employees.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          {message && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary-600 px-3 py-2 font-semibold text-white shadow-md transition hover:bg-primary-700 disabled:opacity-70"
          >
            {submitting ? 'Submitting...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-600">
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <button className="font-semibold text-primary-700" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="font-semibold text-primary-700" onClick={() => setMode('login')}>
                Sign in
              </button>
            </>
          )}
        </div>
        {user && !profile?.is_admin && (
          <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
            You are signed in but not marked as an admin. Ask an existing admin to set <code>profiles.is_admin = true</code> for your user.
          </div>
        )}
      </div>
    </div>
  )
}
