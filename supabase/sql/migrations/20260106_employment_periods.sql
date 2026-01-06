-- Employment periods table for hire/rehire history
create table if not exists public.employment_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date null,
  separation_type text null,
  separation_reason text null,
  eligible_for_rehire boolean not null default true,
  notice_days integer null,
  created_at timestamptz not null default now()
);

create index if not exists idx_employment_periods_employee on public.employment_periods(employee_id);

-- Only one open period per employee
create unique index if not exists ux_employment_periods_open
  on public.employment_periods(employee_id)
  where end_date is null;

-- Backfill a period for employees missing one
insert into public.employment_periods (employee_id, start_date, end_date)
select e.id, e.hire_date, null
from public.employees e
where not exists (
  select 1 from public.employment_periods p where p.employee_id = e.id
);
