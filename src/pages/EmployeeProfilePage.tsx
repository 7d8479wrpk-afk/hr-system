import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Employee, EmployeeStatus, EmployeeStatusHistory, SeparationPayload } from '../types'
import { computeAge } from '../utils/dates'
import { StatusChangeModal } from '../components/StatusChangeModal'
import { format } from 'date-fns'
import { useAuth } from '../lib/auth'

const statusColors: Record<EmployeeStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  RESIGNED: 'bg-amber-100 text-amber-800',
  TERMINATED: 'bg-rose-100 text-rose-800',
  ON_HOLD: 'bg-slate-100 text-slate-700',
}

export const EmployeeProfilePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [history, setHistory] = useState<EmployeeStatusHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusModal, setStatusModal] = useState<'RESIGNED' | 'TERMINATED' | null>(null)
  const [, setUpdating] = useState(false)
  const [attSummary, setAttSummary] = useState<{ present: number; absent: number; leave: number }>({
    present: 0,
    absent: 0,
    leave: 0,
  })
  const [presentModalOpen, setPresentModalOpen] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [activePeriod, setActivePeriod] = useState<any | null>(null)
  const [lastClosedPeriod, setLastClosedPeriod] = useState<any | null>(null)
  const [separationHistory, setSeparationHistory] = useState<EmployeeStatusHistory | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const loadingRef = useRef(false)

  const logStatusChange = useCallback(
    async (oldStatus: string | null, newStatus: string) => {
      if (!id) return
      try {
        const { error: historyError } = await supabase.from('employee_status_history').insert({
          employee_id: id,
          old_status: oldStatus,
          new_status: newStatus,
        })
        if (historyError) {
          console.error('Status history insert failed:', historyError.message)
        }
      } catch (err: any) {
        console.error('Status history insert failed:', err?.message ?? err)
      }
    },
    [id],
  )

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const [empResponse, historyResponse, openPeriodResponse, closedPeriodResponse] = await Promise.all([
        supabase.from('employees').select('*, employee_address').eq('id', id).single(),
        supabase
          .from('employee_status_history')
          .select('*')
          .eq('employee_id', id)
          .order('changed_at', { ascending: false }),
        supabase
          .from('employment_periods')
          .select('*')
          .eq('employee_id', id)
          .is('end_date', null)
          .limit(1)
          .single(),
        supabase
          .from('employment_periods')
          .select('*')
          .eq('employee_id', id)
          .not('end_date', 'is', null)
          .order('end_date', { ascending: false })
          .limit(1)
          .single(),
      ])

      if (empResponse.error) {
        setError(empResponse.error.message)
        setEmployee(null)
      } else {
        setEmployee((empResponse.data ?? null) as Employee | null)
      }

      if (historyResponse.error) {
        console.error(historyResponse.error.message)
        setSeparationHistory(null)
      } else {
        const historyData = (historyResponse.data as EmployeeStatusHistory[]) ?? []
        setHistory(historyData)
        const latestSeparation = historyData.find((item) => {
          const newStatus = String(item.new_status ?? '').toLowerCase()
          return newStatus === 'resigned' || newStatus === 'terminated' || item.clearance_done
        })
        setSeparationHistory(latestSeparation ?? null)
      }

      setActivePeriod(openPeriodResponse.data ?? null)
      setLastClosedPeriod(closedPeriodResponse.data ?? null)
    } catch (e: any) {
      console.error('Load employee error', e?.message ?? e)
      setError(e?.message ?? 'Failed to load employee')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const loadAttendanceSummary = async () => {
      if (!id) return
      const start = new Date()
      start.setDate(1)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      const { data, error } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('employee_id', id)
        .gte('day', format(start, 'yyyy-MM-dd'))
        .lt('day', format(end, 'yyyy-MM-dd'))
      if (error || !data) return
      const counts = { present: 0, absent: 0, leave: 0 }
      ;(data as any[]).forEach((r) => {
        if (r.status === 'present') counts.present++
        else if (r.status === 'absent') counts.absent++
        else if (r.status === 'leave') counts.leave++
      })
      setAttSummary(counts)
    }
    loadAttendanceSummary()
  }, [id])

  const updateStatus = async (status: EmployeeStatus) => {
    if (!id) return
    setUpdating(true)
    setError(null)
    const oldStatus = String(employee?.status ?? '').toLowerCase() || null
    const targetStatus = String(status).toLowerCase()
    const baseUpdate: Partial<Employee> = { status: targetStatus as any }
    if (status === 'ACTIVE' || status === 'ON_HOLD') {
      Object.assign(baseUpdate, {
        separation_type: null,
        separation_date: null,
        separation_reason: null,
        final_working_day: null,
        eligible_for_rehire: null,
        notice_given: null,
        notice_days_served: null,
        exit_interview_done: false,
        clearance_done: false,
      })
    }
    const { error } = await supabase.from('employees').update(baseUpdate).eq('id', id)
    if (error) {
      setError(error.message)
      setUpdating(false)
      return
    }

    await logStatusChange(oldStatus, targetStatus)

    // Rehire: open a new employment period if none is open
    if (targetStatus === 'active') {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: open } = await supabase
        .from('employment_periods')
        .select('id')
        .eq('employee_id', id)
        .is('end_date', null)
        .maybeSingle()
      if (!open) {
        await supabase.from('employment_periods').insert({ employee_id: id, start_date: today })
      }
    }

    await load()
    setUpdating(false)
  }

  const handleSeparationSubmit = async (payload: SeparationPayload) => {
    if (!id || !statusModal || !employee) return
    setUpdating(true)
    setError(null)
    const targetStatus = statusModal.toLowerCase()
    try {
      const updatePayload = {
        status: targetStatus as any,
        separation_type: payload.separation_type,
        separation_date: payload.separation_date,
        separation_reason: payload.separation_reason ?? null,
        final_working_day: payload.final_working_day ?? null,
        eligible_for_rehire: payload.eligible_for_rehire ?? null,
        notice_given: payload.notice_given ?? null,
        notice_days_served: payload.notice_days_served,
        exit_interview_done: payload.exit_interview_done ?? false,
        clearance_done: payload.clearance_done ?? false,
      }
      console.log('Updating employee status...', updatePayload)
      const { error: updateError } = await supabase.from('employees').update(updatePayload).eq('id', id)
      if (updateError) {
        throw new Error(updateError.message)
      }

      const endDate =
        payload.final_working_day ??
        payload.separation_date ??
        format(new Date(), 'yyyy-MM-dd')

      console.log('Checking open employment period...')
      const { data: open, error: openErr } = await supabase
        .from('employment_periods')
        .select('*')
        .eq('employee_id', id)
        .is('end_date', null)
        .maybeSingle()
      if (openErr) {
        throw new Error(openErr.message)
      }
      if (open) {
        console.log('Closing employment period...')
        const { error: closeErr } = await supabase
          .from('employment_periods')
          .update({
            end_date: endDate,
            separation_type: payload.separation_type,
            separation_reason: payload.separation_reason ?? null,
            eligible_for_rehire: payload.eligible_for_rehire ?? null,
            notice_days: payload.notice_days_served ?? null,
          })
          .eq('id', (open as any).id)
        if (closeErr) {
          throw new Error(closeErr.message)
        }
      }

      console.log('Logging status history...')
      const { error: historyError } = await supabase.from('employee_status_history').insert({
        employee_id: id,
        old_status: (employee as any).status ?? null,
        new_status: targetStatus,
        separation_date: payload.separation_date,
        final_working_day: payload.final_working_day ?? null,
        reason: payload.separation_reason ?? null,
        eligible_for_rehire: payload.eligible_for_rehire ?? null,
        notice_given: payload.notice_given ?? null,
        notice_days_served: payload.notice_days_served ?? null,
        exit_interview_done: payload.exit_interview_done ?? false,
        clearance_done: payload.clearance_done ?? false,
        clearance_amount: payload.clearance_done ? payload.clearance_amount ?? null : null,
        clearance_cheque_number: payload.clearance_done ? payload.clearance_cheque_number ?? null : null,
      })
      if (historyError) {
        throw new Error(historyError.message)
      }

      setStatusModal(null)
      console.log('Reloading employee...')
      await load()
    } catch (e: any) {
      console.error(e)
      setError(e?.message ?? 'Failed to update status')
      throw e
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-600">Loading employee...</div>
  }

  if (error) {
    return <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Error: {error}</div>
  }

  if (!employee) {
    return <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">Employee not found.</div>
  }

  const age = computeAge((employee as any).birth_date)
  const nationalId = (employee as any).national_id ?? '—'
  const idNo = (employee as any).id_no ?? '—'
  const address = (employee as any).employee_address ?? '—'
  const birthDate = (employee as any).birth_date ?? '—'
  const ageValue = age ?? '—'
  const phoneValue = (employee as any).phone_number ?? '—'
  const hireDateValue = (employee as any).hire_date ?? '—'
  const effectiveDate = activePeriod?.start_date ?? hireDateValue
  const separationSource = separationHistory ?? lastClosedPeriod
  const normalizedStatus = String(employee.status ?? '').toUpperCase() as EmployeeStatus
  const separationReason =
    separationHistory?.reason ??
    separationSource?.separation_reason ??
    employee.separation_reason ??
    '—'
  const eligibleForRehire =
    separationHistory?.eligible_for_rehire ??
    separationSource?.eligible_for_rehire ??
    employee.eligible_for_rehire
  const noticeServed =
    separationHistory?.notice_days_served ??
    separationSource?.notice_days ??
    employee.notice_days_served

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Employee</p>
          <h1 className="text-2xl font-bold text-slate-900">{employee.full_name}</h1>
          <p className="text-sm text-slate-600">
            {employee.job_title ? `${employee.job_title} • ` : ''}
            {employee.department ?? 'No department'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[normalizedStatus]}`}>
              {normalizedStatus}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              No.: {employee.employee_no}
            </span>
            {age !== null && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Age: {age}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/employees')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back
          </button>
          <div className="relative inline-block">
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-haspopup="true"
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((prev) => !prev)}
            >
              Take action
              <span className="ml-2 text-xs">▾</span>
            </button>
            <div
              className={`absolute right-0 z-10 mt-2 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg ${actionsOpen ? '' : 'hidden'}`}
              role="menu"
              tabIndex={-1}
            >
              <button
                onClick={() => {
                  setActionsOpen(false)
                  navigate(`/employees/${employee.id}/edit`)
                }}
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                role="menuitem"
              >
                Edit
              </button>
              {normalizedStatus === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => {
                      setActionsOpen(false)
                      updateStatus('ON_HOLD')
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    Put On Hold
                  </button>
                  {profile?.can_terminate && (
                    <>
                      <button
                        onClick={() => {
                          setActionsOpen(false)
                          setStatusModal('RESIGNED')
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        role="menuitem"
                      >
                        Resign
                      </button>
                      <button
                        onClick={() => {
                          setActionsOpen(false)
                          setStatusModal('TERMINATED')
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        role="menuitem"
                      >
                        Terminate
                      </button>
                    </>
                  )}
                </>
              )}
              {normalizedStatus === 'ON_HOLD' && (
                <>
                  <button
                    onClick={() => {
                      setActionsOpen(false)
                      updateStatus('ACTIVE')
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    Reactivate
                  </button>
                  {profile?.can_terminate && (
                    <button
                      onClick={() => {
                        setActionsOpen(false)
                        setStatusModal('TERMINATED')
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      role="menuitem"
                    >
                      Terminate
                    </button>
                  )}
                </>
              )}
              {(normalizedStatus === 'RESIGNED' || normalizedStatus === 'TERMINATED') && (
                <button
                  onClick={() => {
                    setActionsOpen(false)
                    updateStatus('ACTIVE')
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  role="menuitem"
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Attendance (today)</h3>
          <div className="space-x-2">
            <button
              onClick={() => setPresentModalOpen(true)}
              className="rounded-md bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"
            >
              Present
            </button>
            <button
              onClick={async () => {
                if (!id) return
                await supabase
                  .from('attendance_records')
                  .upsert(
                    { employee_id: id, day: format(new Date(), 'yyyy-MM-dd'), status: 'leave', start_time: null },
                    { onConflict: 'employee_id,day' },
                  )
                setAttSummary((prev) => ({ ...prev, leave: prev.leave + 1 }))
              }}
              className="rounded-md bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800"
            >
              Leave
            </button>
            <button
              onClick={async () => {
                if (!id) return
                await supabase
                  .from('attendance_records')
                  .upsert(
                    { employee_id: id, day: format(new Date(), 'yyyy-MM-dd'), status: 'absent', start_time: null },
                    { onConflict: 'employee_id,day' },
                  )
                setAttSummary((prev) => ({ ...prev, absent: prev.absent + 1 }))
              }}
              className="rounded-md bg-red-100 px-3 py-1 text-sm font-semibold text-red-800"
            >
              Absent
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-sm text-slate-700">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1">
            Present: <strong>{attSummary.present}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1">
            Absent: <strong>{attSummary.absent}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1">
            Leave: <strong>{attSummary.leave}</strong>
          </span>
        </div>
      </div>

      {presentModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Mark Present</h3>
            <p className="mt-1 text-sm text-slate-600">Add start time for today.</p>
            <div className="mt-3">
              <label className="text-sm font-medium text-slate-700">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPresentModalOpen(false)
                  setStartTime('')
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!id) return
                  await supabase
                    .from('attendance_records')
                    .upsert(
                      { employee_id: id, day: format(new Date(), 'yyyy-MM-dd'), status: 'present', start_time: startTime || null },
                      { onConflict: 'employee_id,day' },
                    )
                  setAttSummary((prev) => ({ ...prev, present: prev.present + 1 }))
                  setPresentModalOpen(false)
                  setStartTime('')
                }}
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {normalizedStatus !== 'ACTIVE' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-amber-900">Separation details</h3>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Type</p>
              <p className="text-sm text-amber-900">{employee.separation_type ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Separation date</p>
              <p className="text-sm text-amber-900">{employee.separation_date ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Final working day</p>
              <p className="text-sm text-amber-900">{employee.final_working_day ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Reason</p>
              <p className="text-sm text-amber-900">{separationReason}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Eligible for rehire</p>
              <p className="text-sm text-amber-900">
                {eligibleForRehire === null || eligibleForRehire === undefined
                  ? '—'
                  : eligibleForRehire
                  ? 'Yes'
                  : 'No'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Notice served</p>
              <p className="text-sm text-amber-900">
                {noticeServed !== null && noticeServed !== undefined ? `${noticeServed} days` : '—'}
              </p>
            </div>
            {separationHistory?.clearance_done && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-700">Clearance amount</p>
                  <p className="text-sm text-amber-900">
                    {separationHistory.clearance_amount ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-700">Cheque number</p>
                  <p className="text-sm text-amber-900">
                    {separationHistory.clearance_cheque_number ?? '—'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Personal info</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">National ID</dt>
              <dd className="font-medium text-slate-900">{nationalId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">ID No</dt>
              <dd className="font-medium text-slate-900">{idNo}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="font-medium text-slate-900">{address}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Birth Date</dt>
              <dd className="font-medium text-slate-900">{birthDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Age</dt>
              <dd className="font-medium text-slate-900">{ageValue}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{phoneValue}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Employment</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Hire date</dt>
              <dd className="font-medium text-slate-900">{hireDateValue}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Effective date</dt>
              <dd className="font-medium text-slate-900">{effectiveDate ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Notice period</dt>
              <dd className="font-medium text-slate-900">{employee.notice_period_days} days</dd>
            </div>
            <div>
              <dt className="text-slate-500">Contract type</dt>
              <dd className="font-medium text-slate-900">{employee.contract_type}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Contract end</dt>
              <dd className="font-medium text-slate-900">{employee.contract_end_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Probation end</dt>
              <dd className="font-medium text-slate-900">{employee.probation_end_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Notes</dt>
              <dd className="font-medium text-slate-900">{employee.notes ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Payroll</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Salary basic</dt>
              <dd className="font-medium text-slate-900">{employee.salary_basic}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Transport allowance</dt>
              <dd className="font-medium text-slate-900">{employee.transport_allowance}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Payment method</dt>
              <dd className="font-medium text-slate-900">{employee.payment_method}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Bank name</dt>
              <dd className="font-medium text-slate-900">{employee.bank_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">IBAN</dt>
              <dd className="font-medium text-slate-900">{employee.iban ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Social security</dt>
              <dd className="font-medium text-slate-900">
                {employee.social_security_enrolled ? 'Enrolled' : 'Not enrolled'} {employee.social_security_number && `(${employee.social_security_number})`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Documents</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">National ID copy</dt>
              <dd className="font-medium text-slate-900">
                {employee.national_id_copy_received ? 'Received' : 'Pending'}{' '}
                {employee.national_id_copy_received_date && `(${employee.national_id_copy_received_date})`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Contract signed</dt>
              <dd className="font-medium text-slate-900">
                {employee.contract_signed ? 'Yes' : 'No'} {employee.contract_signed_date && `(${employee.contract_signed_date})`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">CV received</dt>
              <dd className="font-medium text-slate-900">
                {employee.cv_received ? 'Yes' : 'No'} {employee.cv_received_date && `(${employee.cv_received_date})`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Medical check</dt>
              <dd className="font-medium text-slate-900">
                {employee.medical_check_done ? 'Completed' : 'Pending'}{' '}
                {employee.medical_check_done_date && `(${employee.medical_check_done_date})`}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Status history</h3>
          <span className="text-xs text-slate-500">Automatic log from trigger</span>
        </div>
        <ol className="mt-4 space-y-3">
          {history.length === 0 && <p className="text-sm text-slate-600">No history yet.</p>}
          {history.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {item.old_status} → {item.new_status}
                </p>
                <p className="text-xs text-slate-600">{new Date(item.changed_at).toLocaleString()}</p>
                {item.note && <p className="text-xs text-slate-700">Note: {item.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <StatusChangeModal
        open={Boolean(statusModal)}
        targetStatus={statusModal}
        onClose={() => setStatusModal(null)}
        onConfirm={handleSeparationSubmit}
      />
    </div>
  )
}
