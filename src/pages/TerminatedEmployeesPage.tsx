import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Employee, EmployeeFilters } from '../types'

const normalizeEmployee = (emp: Employee): Employee => ({
  ...emp,
  salary_basic: Number(emp.salary_basic),
  transport_allowance: Number(emp.transport_allowance),
  notice_period_days: Number(emp.notice_period_days),
  notice_days_served: emp.notice_days_served === null ? null : Number(emp.notice_days_served),
})

export const TerminatedEmployeesPage = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<EmployeeFilters>({ search: '', sort: 'employee_no' })
  const [sessionReady, setSessionReady] = useState(false)

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
      if (session) setSessionReady(true)
    })
    start()
    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    const load = async () => {
      setLoading(true)
      setError(null)
      let query = supabase
        .from('employees')
        .select('*')
        .or('status.eq.resigned,status.eq.terminated,status.eq.RESIGNED,status.eq.TERMINATED')
      if (filters.search) {
        const search = filters.search.trim()
        query = query.or(
          `full_name.ilike.%${search}%,employee_no.ilike.%${search}%,phone_number.ilike.%${search}%`,
        )
      }
      const { data, error } = await query
      if (error) {
        setError(error.message)
        setEmployees([])
      } else {
        const normalized = (data as Employee[]).map(normalizeEmployee)
        console.log('Terminated/resigned employees loaded:', normalized.length)
        setEmployees(normalized)
      }
      setLoading(false)
    }
    load()
  }, [filters, sessionReady])

  const statusClass = (status?: string) => {
    const key = (status ?? '').toLowerCase()
    if (key === 'terminated' || key === 'resigned') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Employees</p>
          <h1 className="text-2xl font-bold text-slate-900">Terminated / inactive</h1>
        </div>
        <div className="md:w-64 w-full">
          <input
            type="text"
            placeholder="Search name / No / phone"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
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
                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{no}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{emp.full_name}</td>
                    <td className="px-4 py-3 text-slate-700">{emp.hire_date}</td>
                    <td className="px-4 py-3 text-slate-700">{emp.phone_number}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(emp.status)}`}>
                        {emp.status}
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
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                    No inactive employees found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error && <div className="border-t border-slate-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
      </div>
    </div>
  )
}
