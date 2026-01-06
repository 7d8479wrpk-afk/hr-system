import { useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Employee } from '../types'
import { computeAge } from '../utils/dates'

const employeeSchema = z
  .object({
    employee_no: z.string().min(1, 'No. is required'),
    full_name: z.string().min(1, 'Name is required'),
    national_id: z.string().min(1, 'National ID is required'),
    id_no: z.string().min(1, 'ID No is required'),
    employee_address: z.string().min(1, 'Address is required'),
    hire_date: z.string().min(1, 'Hire date is required'),
    birth_date: z.string().min(1, 'Birth date is required'),
    phone_number: z.string().min(9, 'Phone number must be at least 9 characters'),
  })
  .superRefine((data, ctx) => {
    const dob = new Date(data.birth_date)
    const hire = new Date(data.hire_date)
    const today = new Date()
    if (dob > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date_of_birth'],
        message: 'Birth date cannot be in the future',
      })
    }
    if (hire < dob) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hire_date'],
        message: 'Hire date cannot be before birth date',
      })
    }
  })

export type EmployeeFormValues = z.infer<typeof employeeSchema>

const toFormDefaults = (initial?: Partial<Employee>): EmployeeFormValues => ({
  employee_no: (initial?.employee_no as string | undefined) ?? '',
  full_name: initial?.full_name ?? '',
  national_id: (initial as any)?.national_id ?? (initial as any)?.national_number ?? '',
  id_no: (initial as any)?.id_no ?? '',
  employee_address: (initial as any)?.employee_address ?? (initial as any)?.address ?? '',
  hire_date: initial?.hire_date ?? '',
  birth_date: (initial as any)?.birth_date ?? '',
  phone_number: (initial as any)?.phone_number ?? '',
})

interface EmployeeFormProps {
  initial?: Partial<Employee>
  onSubmit: (values: EmployeeFormValues) => Promise<void> | void
  submitLabel?: string
  loading?: boolean
}

export const EmployeeForm = ({
  initial,
  onSubmit,
  submitLabel = 'Save employee',
  loading = false,
}: EmployeeFormProps) => {
  const formDefaults = useMemo(() => toFormDefaults(initial), [initial])
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    defaultValues: formDefaults,
    resolver: zodResolver(employeeSchema) as Resolver<EmployeeFormValues>,
  })

  const watchDob = watch('birth_date')
  const age = computeAge(watchDob)

  const submit = async (values: EmployeeFormValues) => {
    await onSubmit(values)
  }

  const renderFieldError = (field?: { message?: string }) =>
    field?.message ? <p className="text-xs text-rose-600">{field.message}</p> : null

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">No.</label>
            <input
              type="text"
              readOnly
              {...register('employee_no')}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.employee_no)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">NAME</label>
            <input
              {...register('full_name')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.full_name)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">National ID</label>
            <input
              {...register('national_id')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.national_id)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">ID No</label>
            <input
              {...register('id_no')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.id_no)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Employee Address</label>
            <input
              {...register('employee_address')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.employee_address)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">HIRE DATE</label>
            <input
              type="date"
              {...register('hire_date')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.hire_date)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Birth Date</label>
            <input
              type="date"
              {...register('birth_date')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.birth_date)}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Age</label>
            <input
              value={age ?? ''}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 shadow-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Phone Number</label>
            <input
              {...register('phone_number')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {renderFieldError(errors.phone_number)}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white shadow-md transition hover:bg-primary-700 disabled:opacity-70"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
