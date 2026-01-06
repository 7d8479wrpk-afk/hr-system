-- Ensure status column defaults to 'active' and allows current states
alter table public.employees
  alter column status set default 'active';

-- Drop old check constraint if present
do $$
begin
  alter table public.employees drop constraint if exists employees_status_check;
exception
  when undefined_object then null;
end $$;

-- Add new check constraint for lowercase statuses
alter table public.employees
  add constraint employees_status_check check (status in ('active','on_leave','inactive','resigned'));

-- Normalize any existing rows to a supported value
update public.employees
set status = 'active'
where status is null or status not in ('active','on_leave','inactive','resigned');
