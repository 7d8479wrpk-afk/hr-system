-- Attendance records table
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  day date not null,
  status text not null check (status in ('present','absent','leave')),
  created_at timestamptz default now(),
  unique (employee_id, day)
);

alter table public.attendance_records enable row level security;

-- Allow authenticated users to select/insert/update
drop policy if exists "authenticated select attendance" on public.attendance_records;
create policy "authenticated select attendance"
  on public.attendance_records for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated insert attendance" on public.attendance_records;
create policy "authenticated insert attendance"
  on public.attendance_records for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated update attendance" on public.attendance_records;
create policy "authenticated update attendance"
  on public.attendance_records for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
