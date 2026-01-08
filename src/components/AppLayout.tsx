import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import logo from '../assets/msd-logo.png'

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const desktopNavItems = [
    { to: '/employees', label: 'Employees' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/terminated', label: 'Terminated' },
  ]
  const mobileNavItems = [
    { to: '/employees', label: 'Employees' },
    { to: '/employees/new', label: 'Add Employee', exact: true },
    { to: '/attendance', label: 'Attendance' },
    { to: '/attendance/take', label: 'Take Attendance', exact: true },
    { to: '/terminated', label: 'Terminated', exact: true },
  ]

  const isActive = (item: { to: string; exact?: boolean }) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

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
              {desktopNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-md px-3 py-2 transition hover:text-primary-700 ${
                    isActive(item) ? 'bg-primary-50 text-primary-700' : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:block rounded-full bg-primary-50 px-3 py-1 text-primary-800">
              {profile?.is_admin ? 'Admin' : 'User'}
            </div>
            <div className="hidden sm:block">
              <button
                onClick={() => signOut()}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 sm:hidden"
              aria-controls="mobile-menu"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="flex flex-col gap-1" aria-hidden="true">
                <span className="h-0.5 w-5 rounded bg-slate-700" />
                <span className="h-0.5 w-5 rounded bg-slate-700" />
                <span className="h-0.5 w-5 rounded bg-slate-700" />
              </span>
            </button>
          </div>
        </div>
        <div
          ref={menuRef}
          id="mobile-menu"
          className={`sm:hidden ${menuOpen ? 'block' : 'hidden'} border-t border-slate-200 bg-white shadow-md`}
        >
          <nav className="flex flex-col gap-1 px-4 py-3 text-sm font-medium text-slate-700">
            {mobileNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-3 py-2 transition hover:bg-primary-50 hover:text-primary-700 ${
                  isActive(item) ? 'bg-primary-50 text-primary-700' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-md bg-primary-50 px-3 py-2">
              <span className="text-primary-800">{profile?.is_admin ? 'Admin' : 'User'}</span>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                }}
                className="rounded border border-primary-100 px-2 py-1 text-primary-700 transition hover:bg-primary-100"
              >
                Sign out
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
