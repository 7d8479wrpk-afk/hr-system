export type EmployeeStatus = 'ACTIVE' | 'RESIGNED' | 'TERMINATED' | 'ON_HOLD'
export type ContractType = 'FULL_TIME' | 'PART_TIME' | 'TEMP' | 'INTERN' | 'CONTRACT'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER'

export interface Employee {
  id: string
  employee_no: string
  employee_id: string
  full_name: string
  birth_date: string
  hire_date: string
  national_id?: string
  id_no?: string
  employee_address?: string
  phone_number?: string
  salary_basic?: number
  transport_allowance?: number
  effective_date?: string
  notice_period_days: number
  department: string | null
  job_title: string | null
  branch: string | null
  manager_name: string | null
  contract_type: ContractType
  contract_end_date: string | null
  probation_end_date: string | null
  payment_method: PaymentMethod
  bank_name: string | null
  iban: string | null
  social_security_number: string | null
  social_security_enrolled: boolean
  status: EmployeeStatus
  notes: string | null
  separation_type: 'RESIGNED' | 'TERMINATED' | null
  separation_date: string | null
  separation_reason: string | null
  final_working_day: string | null
  notice_given: boolean | null
  notice_days_served: number | null
  exit_interview_done: boolean
  clearance_done: boolean
  eligible_for_rehire: boolean | null
  national_id_copy_received: boolean
  national_id_copy_received_date: string | null
  contract_signed: boolean
  contract_signed_date: string | null
  cv_received: boolean
  cv_received_date: string | null
  medical_check_done: boolean
  medical_check_done_date: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeStatusHistory {
  id: string
  employee_uuid?: string
  employee_id?: string
  old_status: EmployeeStatus
  new_status: EmployeeStatus
  changed_at: string
  changed_by: string | null
  note: string | null
  separation_date?: string | null
  final_working_day?: string | null
  reason?: string | null
  eligible_for_rehire?: boolean | null
  notice_given?: boolean | null
  notice_days_served?: number | null
  exit_interview_done?: boolean | null
  clearance_done?: boolean | null
  clearance_amount?: number | null
  clearance_cheque_number?: string | null
}

export interface Profile {
  id: string
  is_admin: boolean
  can_terminate?: boolean | null
  created_at: string
}

export interface SeparationPayload {
  separation_type: 'RESIGNED' | 'TERMINATED'
  separation_date: string
  separation_reason?: string
  final_working_day?: string
  eligible_for_rehire?: boolean
  notice_given?: boolean
  notice_days_served?: number | null
  exit_interview_done?: boolean
  clearance_done?: boolean
  clearance_amount?: number | null
  clearance_cheque_number?: string | null
}

export interface EmployeeFilters {
  search?: string
  status?: EmployeeStatus | 'ALL'
  department?: string
  branch?: string
  sort?: 'newest' | 'name' | 'employee_no'
}
