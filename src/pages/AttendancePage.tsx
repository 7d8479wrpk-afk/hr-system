import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

type AttendanceStatus = 'present' | 'absent' | 'leave'
type AttendanceRecord = { status: AttendanceStatus; start_time: string | null }

const attMap: Record<'present' | 'absent' | 'leave' | 'empty', { text: string; class: string; fill: string }> = {
  present: { text: 'ح', class: 'bg-green-100 text-green-800', fill: 'FFBBF7D0' },
  absent: { text: 'غ', class: 'bg-red-100 text-red-800', fill: 'FFFECACA' },
  leave: { text: 'إ', class: 'bg-yellow-100 text-yellow-800', fill: 'FEF08A' },
  empty: { text: '', class: 'bg-gray-100 text-gray-400', fill: 'FFF1F5F9' },
}

export const AttendancePage = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [records, setRecords] = useState<Record<string, Record<string, AttendanceRecord>>>({})
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [editingCell, setEditingCell] = useState<{
    employeeId: string
    day: string
    status: AttendanceStatus
    startTime: string
  } | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const formatAMOnly = (date: Date) => {
    let h = date.getHours()
    const m = date.getMinutes().toString().padStart(2, '0')
    if (h >= 12) h = h - 12
    if (h === 0) h = 12
    return `${String(h).padStart(2, '0')}:${m}`
  }

  const toAMInput = (time?: string | null) => {
    if (!time) return formatAMOnly(new Date())
    const [hStr, m = '00'] = time.split(':')
    let h = Number(hStr)
    if (Number.isNaN(h)) return time
    if (h >= 12) h = h - 12
    if (h === 0) h = 12
    return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')}`
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

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, employee_no, status')
      .order('employee_no', { ascending: true })
    setEmployees((data as Employee[]) ?? [])
  }

  const loadAttendance = async () => {
    if (employees.length === 0) return
    setLoading(true)
    const start = new Date(`${month}-01T00:00:00`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    const ids =
      selectedIds.length === 0 ? employees.map((e) => e.id) : employees.filter((e) => selectedIds.includes(e.id)).map((e) => e.id)
    const { data } = await supabase
      .from('attendance_records')
      .select('employee_id, day, status, start_time')
      .in('employee_id', ids)
      .gte('day', start.toISOString().slice(0, 10))
      .lt('day', end.toISOString().slice(0, 10))
    const map: Record<string, Record<string, AttendanceRecord>> = {}
    ;(data ?? []).forEach((row: any) => {
      map[row.employee_id] = map[row.employee_id] || {}
      map[row.employee_id][row.day] = { status: row.status, start_time: row.start_time }
    })
    setRecords(map)
    setLoading(false)
  }

  useEffect(() => {
    let isMounted = true
    const start = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!isMounted) return
      if (session) {
        setSessionReady(true)
        loadEmployees()
      } else {
        setLoading(false)
      }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionReady(true)
        loadEmployees()
      }
    })
    start()
    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (sessionReady && month) loadAttendance()
  }, [selectedIds, month, employees.length, sessionReady])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const daysInMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }, [month])

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase()
    let list = employees
    if (selectedIds.length === 0) {
      list = employees.filter((e) => {
        const status = String((e as any).status ?? '').toLowerCase()
        return status !== 'resigned' && status !== 'terminated'
      })
    } else {
      list = employees.filter((e) => selectedIds.includes(e.id))
    }
    if (search) {
      list = list.filter(
        (e) => e.full_name.toLowerCase().includes(search),
      )
    }
    return list
  }, [employeeSearch, employees, selectedIds])

  const displayEmployees = filteredEmployees

  const exportXlsx = async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Attendance')
    const headers = ['No', 'Name', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))]
    ws.addRow(headers)
    displayEmployees.forEach((emp, idx) => {
      const rowValues: (string | number)[] = [
        emp.employee_no ?? `MSD-${idx + 1}`,
        emp.full_name,
      ]
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${month}-${String(i).padStart(2, '0')}`
        const status = records[emp.id]?.[dateStr]?.status as AttendanceStatus | undefined
        const att = status ? attMap[status] : attMap.empty
        rowValues.push(att.text)
      }
      const row = ws.addRow(rowValues)
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (colNumber > 2) {
          const idxDay = colNumber - 2
          const dateStr = `${month}-${String(idxDay).padStart(2, '0')}`
          const s = records[emp.id]?.[dateStr]?.status as AttendanceStatus | undefined
          const att = s ? attMap[s] : attMap.empty
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: att.fill },
          }
        }
      })
    })
    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf]), `attendance-${month}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Attendance</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Monthly sheet</h1>
            <a
              href="/attendance/take"
              className="text-sm font-semibold text-primary-700 hover:underline"
            >
              Daily attendance
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const [y, m] = month.split('-').map(Number)
              const d = new Date(y, m - 2, 1)
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            ◀ Prev
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              const [y, m] = month.split('-').map(Number)
              const d = new Date(y, m, 1)
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            Next ▶
          </button>
        </div>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((p) => !p)}
            className="flex min-w-[220px] items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <span className="truncate text-left">
              {selectedIds.length === 0
                ? 'All employees'
                : selectedIds.length === 1
                ? employees.find((e) => e.id === selectedIds[0])?.full_name ?? '1 selected'
                : `${selectedIds.length} selected`}
            </span>
            <span className="text-slate-500">▾</span>
          </button>
          {pickerOpen && (
            <div className="absolute left-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <input
                  type="text"
                  placeholder="Search employees"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                />
              </div>
              <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-1">
                {employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(e.id)}
                      onChange={(ev) => {
                        setSelectedIds((prev) =>
                          ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id),
                        )
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="truncate">{e.full_name}</span>
                  </label>
                ))}
                {employees.length === 0 && (
                  <div className="text-xs text-slate-500">No employees</div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary-700"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-600"
                  onClick={() => setPickerOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={exportXlsx}
          className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          Download XLSX
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Employee</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i} className="px-2 py-2 text-center font-mono text-[11px]">
                    {String(i + 1).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            {displayEmployees.map((emp, idx) => (
              <tr key={emp.id}>
                <td className="whitespace-nowrap px-3 py-2 text-left text-slate-800">{idx + 1}</td>
                <td className="whitespace-nowrap px-3 py-2 text-left text-slate-800">{emp.full_name}</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dateStr = `${month}-${String(i + 1).padStart(2, '0')}`
                  const status = records[emp.id]?.[dateStr]?.status as AttendanceStatus | undefined
                  const att = status ? attMap[status] : attMap.empty
                  return (
                    <td
                      key={i}
                      className="relative px-1 py-2 text-center"
                      onClick={() => {
                        const current = records[emp.id]?.[dateStr]
                        const defaultTime = formatAMOnly(new Date())
                        setEditingCell({
                          employeeId: emp.id,
                          day: dateStr,
                          status: current?.status ?? 'present',
                          startTime: toAMInput(current?.start_time ?? defaultTime),
                        })
                      }}
                    >
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] ${att.class} cursor-pointer`}>
                        {att.text}
                      </span>
                      {editingCell &&
                        editingCell.employeeId === emp.id &&
                        editingCell.day === dateStr && (
                          <div className="absolute left-1/2 z-10 mt-2 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
                            <div className="space-y-2 text-xs text-slate-700">
                              <div className="font-semibold">{emp.full_name}</div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCell((prev) => prev && { ...prev, status: 'present' })}
                                  className={`flex-1 rounded px-2 py-1 text-center ${editingCell.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCell((prev) => prev && { ...prev, status: 'leave' })}
                                  className={`flex-1 rounded px-2 py-1 text-center ${editingCell.status === 'leave' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100'}`}
                                >
                                  Leave
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCell((prev) => prev && { ...prev, status: 'absent' })}
                                  className={`flex-1 rounded px-2 py-1 text-center ${editingCell.status === 'absent' ? 'bg-red-100 text-red-800' : 'bg-slate-100'}`}
                                >
                                  Absent
                                </button>
                              </div>
                              {editingCell.status === 'present' && (
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-slate-600">Start time</label>
                                  <input
                                    type="time"
                                    value={editingCell.startTime}
                                    onChange={(e) =>
                                      setEditingCell((prev) => prev && { ...prev, startTime: e.target.value })
                                    }
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                  />
                                  <div className="text-[11px] text-slate-500">
                                    {formatAMLabel(editingCell.startTime)}
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                                  onClick={() => setEditingCell(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-primary-600 px-2 py-1 text-xs font-semibold text-white"
                                  onClick={async () => {
                                    if (!editingCell) return
                                    const start_time = editingCell.status === 'present' ? editingCell.startTime || null : null
                                    await supabase
                                      .from('attendance_records')
                                      .upsert(
                                        {
                                          employee_id: editingCell.employeeId,
                                          day: editingCell.day,
                                          status: editingCell.status,
                                          start_time,
                                        },
                                        { onConflict: 'employee_id,day' },
                                      )
                                    setRecords((prev) => {
                                      const next = { ...prev }
                                      next[editingCell.employeeId] = next[editingCell.employeeId] || {}
                                      next[editingCell.employeeId][editingCell.day] = {
                                        status: editingCell.status,
                                        start_time,
                                      }
                                      return next
                                    })
                                    setEditingCell(null)
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {displayEmployees.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={daysInMonth + 1}>
                  {loading ? 'Loading...' : 'No employees found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
