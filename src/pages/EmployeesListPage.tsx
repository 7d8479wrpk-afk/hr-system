import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Employee, EmployeeFilters } from '../types'
import { exportEmployeesCsv } from '../utils/csv'

const normalizeEmployee = (emp: Employee): Employee => ({
  ...emp,
  // keep employee_no as-is (string like MSD-1)
  salary_basic: Number(emp.salary_basic),
  transport_allowance: Number(emp.transport_allowance),
  notice_period_days: Number(emp.notice_period_days),
  notice_days_served: emp.notice_days_served === null ? null : Number(emp.notice_days_served),
})

export const EmployeesListPage = () => {
  const [filters, setFilters] = useState<EmployeeFilters>({
    search: '',
    status: 'ALL',
    sort: 'employee_no',
  })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [lastLoad, setLastLoad] = useState<() => Promise<void>>(() => async () => {})
  const cacheRef = useRef<{ filters: EmployeeFilters; data: Employee[] } | null>(null)

  useEffect(() => {
    let isMounted = true
    const start = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!isMounted) return
      if (session) {
        setSessionReady(true)
      } else {
        setLoading(false)
      }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionReady(true)
      }
    })
    start()
    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    // Serve cached data if filters match
    if (cacheRef.current && JSON.stringify(cacheRef.current.filters) === JSON.stringify(filters)) {
      setEmployees(cacheRef.current.data)
      return
    }
    const load = async () => {
      setLoading(true)
      setError(null)
      const baseSelect = supabase
        .from('employees')
        .select('id, employee_no, full_name, hire_date, phone_number, status')
        .order('employee_no', { ascending: true })
        .range(0, 49)
        .or('status.is.null,status.not.in.(resigned,terminated)')
      let query = baseSelect

      if (filters.search) {
        const search = filters.search.trim()
        query = query.or(
          `full_name.ilike.%${search}%,employee_no.ilike.%${search}%,phone_number.ilike.%${search}%`,
        )
      }
      if (filters.status && filters.status !== 'ALL') {
        const targetStatus = filters.status.toLowerCase()
        if (targetStatus === 'resigned' || targetStatus === 'terminated') {
          window.location.href = '/terminated'
          return
        }
        query = query.eq('status', targetStatus)
      }

      const { data, error } = await query
      console.log('employees data length', data?.length, 'error', error?.message ?? null)

      if (error) {
        setError(error.message)
        setEmployees([])
      } else {
        const normalized = (data as Employee[]).map(normalizeEmployee)
        console.log('Employees loaded:', normalized.length)
        const withIndex = normalized.map((emp, idx) => ({ emp, idx }))
        const getNo = (emp: Employee, idx: number) =>
          (emp as any).employee_no ??
          (emp as any).employee_no_text ??
          (emp as any).employee_number ??
          (emp as any).no ??
          (emp as any).code ??
          `MSD-${idx + 1}`

        withIndex.sort((a, b) => {
          if (filters.sort === 'name') return a.emp.full_name.localeCompare(b.emp.full_name)
          const extract = (v: string) => Number((v || '').match(/\\d+/)?.[0] ?? 0)
          const aNo = extract(getNo(a.emp, a.idx) as string)
          const bNo = extract(getNo(b.emp, b.idx) as string)
          return aNo - bNo
        })
        setEmployees(withIndex.map((item) => item.emp))
        cacheRef.current = { filters, data: withIndex.map((item) => item.emp) }
      }
      setLoading(false)
    }
    setLastLoad(() => load)
    load()
  }, [filters, sessionReady])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Employees</p>
          <h1 className="text-2xl font-bold text-slate-900">Directory & status</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportEmployeesCsv(employees)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Export CSV
          </button>
          <Link
            to="/employees/new"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700"
          >
            Add Employee
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Search</label>
          <input
            type="text"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Name, No., Phone"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
          <select
            value={filters.status ?? 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as EmployeeFilters['status'] }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Sort</label>
          <select
            value={filters.sort ?? 'employee_no'}
            onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value as EmployeeFilters['sort'] }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="employee_no">No. (asc)</option>
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Hire Date</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp, index) => {
                const no =
                  (emp as any).employee_no ??
                  (emp as any).employee_no_text ??
                  (emp as any).employee_number ??
                  (emp as any).no ??
                  (emp as any).code ??
                  `MSD-${index + 1}`
                const statusMap: Record<string, { label: string; class: string }> = {
                  active: { label: 'ACTIVE', class: 'bg-green-100 text-green-800' },
                  on_hold: { label: 'ON_HOLD', class: 'bg-yellow-100 text-yellow-800' },
                  resigned: { label: 'RESIGNED', class: 'bg-amber-100 text-amber-800' },
                  terminated: { label: 'TERMINATED', class: 'bg-rose-100 text-rose-800' },
                }
                const statusKey = (emp.status ?? 'active').toLowerCase()
                const s = statusMap[statusKey] ?? statusMap.active
                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-700">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{no}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{emp.full_name}</td>
                    <td className="px-4 py-3 text-slate-700">{emp.hire_date}</td>
                    <td className="px-4 py-3 text-slate-700">{emp.phone_number}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${s.class}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/employees/${emp.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {!loading && employees.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={8}>
                    No employees found with the current filters.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={8}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-500" />
                      <span>Loading employees...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            <span>{error}</span>
            <button
              onClick={() => lastLoad()}
              className="rounded border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
