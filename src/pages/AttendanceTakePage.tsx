import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types'
import { format } from 'date-fns'

type AttendanceStatus = 'present' | 'absent' | 'leave'

const statusMap: Record<AttendanceStatus, { text: string; className: string }> = {
  present: { text: 'ح', className: 'bg-green-100 text-green-800 hover:bg-green-200' },
  absent: { text: 'غ', className: 'bg-red-100 text-red-800 hover:bg-red-200' },
  leave: { text: 'إ', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
}

export const AttendanceTakePage = () => {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; start_time: string | null }>>({})
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [bulkTime, setBulkTime] = useState(() => {
    let h = new Date().getHours()
    const m = new Date().getMinutes().toString().padStart(2, '0')
    if (h >= 12) h = h - 12
    if (h === 0) h = 12
    return `${String(h).padStart(2, '0')}:${m}`
  })
  const [bulkModal, setBulkModal] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatAMOnly = (date: Date) => {
    let h = date.getHours()
    const m = date.getMinutes().toString().padStart(2, '0')
    if (h >= 12) h = h - 12
    if (h === 0) h = 12
    return `${String(h).padStart(2, '0')}:${m}`
  }

  const formatAMLabel = (time?: string | null) => {
    if (!time) return '—'
    const [hStr, m = '00'] = time.split(':')
    let h = Number(hStr)
    if (Number.isNaN(h)) return time
    if (h >= 12) h = h - 12
    if (h === 0) h = 12
    return `${h}:${m.padStart(2, '0')} AM`
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const normalizeTime = (value?: string | null) => {
    if (!value) return null
    const [h = '', m = '', s = '00'] = value.split(':')
    if (!h || !m) return null
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, status')
        .not('status', 'in', '("resigned","terminated")')
        .order('employee_no', { ascending: true })
      if (error) {
        console.error(error.message)
        setErrorMessage(error.message)
        return
      }
      setEmployees((data as Employee[]) ?? [])
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to load employees.')
    }
  }

  const loadAttendanceForDate = async (d: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('employee_id, status, start_time')
        .eq('day', d)
      if (error) {
        console.error(error.message)
        setErrorMessage(error.message)
        return
      }
      const map: Record<string, { status: AttendanceStatus; start_time: string | null }> = {}
      ;(data ?? []).forEach((row: any) => {
        map[row.employee_id] = { status: row.status, start_time: row.start_time }
      })
      setAttendance(map)
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to load attendance.')
    }
  }

  useEffect(() => {
    let isMounted = true
    const start = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (!isMounted) return
        if (error) {
          console.error(error.message)
          setErrorMessage(error.message)
          return
        }
        if (session) {
          setSessionReady(true)
          loadEmployees()
        }
      } catch (err) {
        console.error(err)
        setErrorMessage('Failed to load session.')
      }
    }
    let sub = { subscription: { unsubscribe: () => {} } }
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setSessionReady(true)
          loadEmployees()
        }
      })
      sub = data
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to subscribe to auth changes.')
    }
    start()
    return () => {
      isMounted = false
      if ('subscription' in sub) {
        sub.subscription.unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    if (sessionReady) loadAttendanceForDate(date)
  }, [date, sessionReady])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => e.full_name.toLowerCase().includes(q))
  }, [employees, search])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(searchInput)
    }, 200)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchInput])

  const saveAttendance = async (
    employeeId: string,
    status: AttendanceStatus,
    start_time: string | null = null,
  ) => {
    setAttendance((prev) => ({ ...prev, [employeeId]: { status, start_time } }))
    setIsSaving(true)
    try {
      const normalizedTime = normalizeTime(start_time)
      const { error } = await supabase
        .from('attendance_records')
        .upsert(
          { employee_id: employeeId, day: date, status, start_time: normalizedTime },
          { onConflict: 'employee_id,day' },
        )
      if (error) {
        console.error(error.message)
        setErrorMessage(error.message)
        showToast('Error saving')
      } else {
        showToast('Saved')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to save attendance.')
      showToast('Error saving')
    } finally {
      setIsSaving(false)
    }
  }

  const markAllPresent = async () => {
    const time = bulkTime || null
    const normalizedTime = normalizeTime(time)
    const rows = (employees ?? []).map((e) => ({
      employee_id: e.id,
      day: date,
      status: 'present' as AttendanceStatus,
      start_time: normalizedTime,
    }))
    // optimistic
    const newState: Record<string, { status: AttendanceStatus; start_time: string | null }> = { ...attendance }
    ;(employees ?? []).forEach((e) => {
      newState[e.id] = { status: 'present', start_time: time }
    })
    setAttendance(newState)
    setIsSaving(true)
    try {
      const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'employee_id,day' })
      if (error) {
        console.error(error.message)
        setErrorMessage(error.message)
        showToast('Error saving')
      } else {
        showToast('All marked present')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to save attendance.')
      showToast('Error saving')
    } finally {
      setIsSaving(false)
    }
    setBulkModal(false)
  }

  const roundedNow = () => {
    const now = new Date()
    const mins = Math.round(now.getMinutes() / 5) * 5
    now.setMinutes(mins)
    return formatAMOnly(now)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Attendance</p>
          <h1 className="text-2xl font-bold text-slate-900">Daily attendance</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name"
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              setBulkTime(roundedNow())
              setBulkModal(true)
            }}
            disabled={isSaving}
            className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
          >
            Mark all Present
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Start time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(filteredEmployees ?? []).map((emp, idx) => {
              const att = attendance[emp.id]
              const currentStatus = att?.status
              const presentSelected = currentStatus === 'present'
              const timeValue = att?.start_time ?? ''
              const timeValueForInput = timeValue ? timeValue.slice(0, 5) : ''
              return (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{emp.full_name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {(['present', 'leave', 'absent'] as AttendanceStatus[]).map((s) => {
                        const cfg = statusMap[s]
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              if (s === 'present') {
                                saveAttendance(emp.id, 'present', timeValue || roundedNow())
                              } else {
                                saveAttendance(emp.id, s, null)
                              }
                            }}
                            disabled={isSaving}
                            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition ${cfg.className} ${
                              currentStatus === s ? 'ring-2 ring-primary-400' : ''
                            }`}
                          >
                            {cfg.text}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={timeValueForInput}
                      onFocus={(e) => {
                        if (!e.target.value) e.target.value = roundedNow()
                      }}
                      onChange={(e) => {
                        const val = e.target.value
                        if (presentSelected) {
                          saveAttendance(emp.id, 'present', val)
                        } else {
                          setAttendance((prev) => ({
                            ...prev,
                            [emp.id]: { status: 'present', start_time: val },
                          }))
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value && !presentSelected) {
                          saveAttendance(emp.id, 'present', e.target.value)
                        }
                      }}
                      disabled={isSaving}
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <div className="text-xs text-slate-500">{formatAMLabel(timeValue)}</div>
                  </td>
                </tr>
              )
            })}
            {filteredEmployees.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-center text-sm text-slate-500" colSpan={4}>
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {bulkModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Mark all present</h3>
            <p className="mt-1 text-sm text-slate-600">Set start time for all active employees.</p>
            <div className="mt-3">
              <label className="text-sm font-medium text-slate-700">Start time</label>
              <input
                type="time"
                value={bulkTime}
                onChange={(e) => setBulkTime(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setBulkModal(false)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={markAllPresent}
                disabled={isSaving}
                className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
