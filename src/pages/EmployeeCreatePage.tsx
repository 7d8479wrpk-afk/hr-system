import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmployeeForm, type EmployeeFormValues } from '../components/EmployeeForm'
import { supabase } from '../lib/supabase'

const toISODate = (v: string | null | undefined) => {
  if (!v) return null
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  // Accept MM/DD/YYYY
  const mdY = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  if (mdY) {
    const [, mm, dd, yyyy] = mdY
    const iso = `${yyyy}-${mm}-${dd}`
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return iso
  }
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export const EmployeeCreatePage = () => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nextNo, setNextNo] = useState<string>('MSD-1')

  useEffect(() => {
    const loadNext = async () => {
      const { data, error } = await supabase.rpc('get_next_employee_no')
      if (error) {
        setError(error.message)
        return
      }
      if (data) setNextNo(data as string)
    }
    loadNext()
  }, [])

  const handleSubmit = async (values: EmployeeFormValues) => {
    setSubmitting(true)
    setError(null)

    try {
      const hireISO = toISODate(values.hire_date)
      const dobISO = toISODate(values.birth_date)
      if (!hireISO || !dobISO) {
        throw new Error('Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY.')
      }

      const { data: duplicates, error: dupError } = await supabase
        .from('employees')
        .select('id,employee_no,national_id,id_no')
        .or(`employee_no.eq.${values.employee_no},national_id.eq.${values.national_id},id_no.eq.${values.id_no}`)

      if (dupError) {
        throw new Error(dupError.message)
      }

      if (duplicates && duplicates.length > 0) {
        throw new Error('Duplicate detected: No., National ID, or ID No already exists.')
      }

      const payload = {
        employee_no: values.employee_no,
        full_name: values.full_name,
        national_id: values.national_id,
        id_no: values.id_no,
        employee_address: values.employee_address,
        phone_number: values.phone_number,
        hire_date: hireISO,
        initial_start_date: hireISO,
        birth_date: dobISO,
        is_active: true,
        status: 'active',
      }

      console.log('create employee payload', payload)

      const { error: insertError, data } = await supabase.from('employees').insert(payload).select('id').single()
      if (insertError) {
        throw new Error(insertError.message)
      }
      if (data?.id) {
        await supabase.from('employment_periods').insert({ employee_id: data.id, start_date: hireISO })
        navigate(`/employees/${data.id}`)
      }
    } catch (e: any) {
      console.error('Create employee error', e)
      setError(e?.message ?? 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Create</p>
          <h1 className="text-2xl font-bold text-slate-900">New employee</h1>
          <p className="text-sm text-slate-600">Add personal, employment, payroll, and document details.</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <EmployeeForm
        key={nextNo}
        initial={{ employee_no: nextNo }}
        onSubmit={handleSubmit}
        loading={submitting}
        submitLabel="Create employee"
      />
    </div>
  )
}
