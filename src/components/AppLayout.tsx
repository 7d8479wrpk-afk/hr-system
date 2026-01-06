import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import logo from '../assets/msd-logo.png'

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, profile } = useAuth()
  const location = useLocation()

  const navItems = [
    { to: '/employees', label: 'Employees' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/terminated', label: 'Terminated' },
  ]

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link to="/employees" className="flex items-center gap-2 text-lg font-semibold text-primary-700">
              <img src={logo} alt="MSD" className="h-8 w-auto" />
              HR Console
            </Link>
            <nav className="hidden gap-4 text-sm font-medium text-slate-600 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-md px-3 py-2 transition hover:text-primary-700 ${
                    location.pathname.startsWith(item.to)
                      ? 'bg-primary-50 text-primary-700'
                      : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="rounded-full bg-primary-50 px-3 py-1 text-primary-800">
              {profile?.is_admin ? 'Admin' : 'User'}
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
