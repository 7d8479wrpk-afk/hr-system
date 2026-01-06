import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmployeeForm, type EmployeeFormValues } from '../components/EmployeeForm'
import type { Employee } from '../types'
import { supabase } from '../lib/supabase'

export const EmployeeEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
      if (error) {
        setError(error.message)
      } else {
        setEmployee(data as Employee)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSubmit = async (values: EmployeeFormValues) => {
    if (!id) return
    setSaving(true)
    setError(null)

    const { data: duplicates, error: dupError } = await supabase
      .from('employees')
      .select('id')
      .neq('id', id)
      .or(`employee_no.eq.${values.employee_no},national_id.eq.${values.national_id},id_no.eq.${values.id_no}`)

    if (dupError) {
      setError(dupError.message)
      setSaving(false)
      return
    }

    if (duplicates && duplicates.length > 0) {
      setError('Duplicate detected: No., National ID, or ID No already exists.')
      setSaving(false)
      return
    }

    const payload = {
      ...values,
      national_id: values.national_id,
      id_no: values.id_no,
      employee_address: values.employee_address,
      birth_date: values.birth_date,
      hire_date: values.hire_date,
    }

    const { error: updateError } = await supabase.from('employees').update(payload).eq('id', id)
    if (updateError) {
      if (updateError.code === '23505') {
        if (updateError.message.includes('employee_no')) setError('No. is already used.')
        else if (updateError.message.includes('national_number')) setError('National ID is already used.')
        else if (updateError.message.includes('id_number')) setError('ID No is already used.')
        else setError('Duplicate value detected.')
      } else {
        setError(updateError.message)
      }
    } else {
      navigate(`/employees/${id}`)
    }
    setSaving(false)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Edit</p>
          <h1 className="text-2xl font-bold text-slate-900">Update employee</h1>
          <p className="text-sm text-slate-600">Modify details and save changes.</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <EmployeeForm initial={employee} onSubmit={handleSubmit} loading={saving} submitLabel="Save changes" />
    </div>
  )
}
