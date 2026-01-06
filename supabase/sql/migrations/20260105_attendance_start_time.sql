alter table public.attendance_records
  add column if not exists start_time time null;
