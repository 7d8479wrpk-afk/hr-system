-- HR Employee Info Web App schema
-- Run inside Supabase SQL editor or via migration tooling.

-- Extensions
create extension if not exists "pgcrypto";

-- Table: profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Table: employees
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique not null,
  full_name text not null,
  date_of_birth date not null,
  national_number text unique not null,
  id_number text unique not null,
  phone_number text not null,
  salary_basic numeric(12,3) not null check (salary_basic >= 0),
  transport_allowance numeric(12,3) not null default 0 check (transport_allowance >= 0),
  effective_date date not null,
  notice_period_days int not null default 30 check (notice_period_days >= 0),

  -- Employment details
  department text,
  job_title text,
  branch text,
  manager_name text,
  contract_type text not null default 'FULL_TIME' check (contract_type in ('FULL_TIME','PART_TIME','TEMP','INTERN','CONTRACT')),
  contract_end_date date,
  probation_end_date date,

  -- Payroll details
  payment_method text not null default 'CASH' check (payment_method in ('CASH','BANK_TRANSFER')),
  bank_name text,
  iban text,
  social_security_number text,
  social_security_enrolled boolean not null default false,

  -- Status
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RESIGNED','TERMINATED','ON_HOLD')),
  notes text,

  -- Separation (only when not ACTIVE)
  separation_type text check (separation_type in ('RESIGNED','TERMINATED')),
  separation_date date,
  separation_reason text,
  final_working_day date,
  notice_given boolean,
  notice_days_served int check (notice_days_served is null or notice_days_served >= 0),
  exit_interview_done boolean default false,
  clearance_done boolean default false,
  eligible_for_rehire boolean,

  -- Document tracker
  national_id_copy_received boolean default false,
  national_id_copy_received_date date,
  contract_signed boolean default false,
  contract_signed_date date,
  cv_received boolean default false,
  cv_received_date date,
  medical_check_done boolean default false,
  medical_check_done_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint separation_after_start check (separation_date is null or separation_date >= effective_date),
  constraint separation_requires_fields check (
    status <> 'RESIGNED' and status <> 'TERMINATED'
    or (separation_type is not null and separation_date is not null)
  )
);

-- Table: employee_status_history
create table if not exists public.employee_status_history (
  id uuid primary key default gen_random_uuid(),
  employee_uuid uuid not null references public.employees (id) on delete cascade,
  old_status text not null,
  new_status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id),
  note text
);

-- Trigger: updated_at
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row
execute function public.set_current_timestamp_updated_at();

-- Trigger: status history
create or replace function public.log_employee_status_change()
returns trigger as $$
begin
  if coalesce(old.status, '') <> coalesce(new.status, '') then
    insert into public.employee_status_history (employee_uuid, old_status, new_status, changed_by, note)
    values (old.id, old.status, new.status, auth.uid(), new.notes);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists employees_status_history_trigger on public.employees;
create trigger employees_status_history_trigger
after update on public.employees
for each row
when (old.status is distinct from new.status)
execute function public.log_employee_status_change();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.employee_status_history enable row level security;

-- Policies for profiles
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

-- Policies for employees (admins only)
drop policy if exists "Admins can read employees" on public.employees;
create policy "Admins can read employees"
on public.employees for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can insert employees" on public.employees;
create policy "Admins can insert employees"
on public.employees for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can update employees" on public.employees;
create policy "Admins can update employees"
on public.employees for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- Policies for employee_status_history (admins only)
drop policy if exists "Admins can manage status history" on public.employee_status_history;
create policy "Admins can manage status history"
on public.employee_status_history
for all
using (true)
with check (true);

-- No delete policies are defined beyond the above; deletes follow policy defaults.

-- RLS for employees (admin-only via profiles.is_admin)
alter table public.employees enable row level security;

drop policy if exists "Admins manage employees" on public.employees;
create policy "Admins manage employees"
on public.employees
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);
