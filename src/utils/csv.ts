import type { Employee } from '../types'
import { computeAge } from './dates'

const escapeCsv = (value: unknown) => {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const exportEmployeesCsv = (employees: Employee[]) => {
  const headers = [
    'No.',
    'Name',
    'National ID',
    'ID No',
    'Address',
    'Hire Date',
    'Birth Date',
    'Age',
    'Phone Number',
  ]

  const rows = employees.map((emp) => [
    emp.employee_no,
    emp.full_name,
    emp.national_id,
    emp.id_no,
    emp.employee_address,
    emp.hire_date,
    emp.birth_date,
    computeAge(emp.birth_date) ?? '',
    emp.phone_number,
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'employees.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
