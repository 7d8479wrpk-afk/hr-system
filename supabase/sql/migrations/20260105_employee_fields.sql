-- Migration: add employee_no and address fields plus constraints

alter table public.employees
  add column if not exists employee_no integer,
  add column if not exists address text,
  add column if not exists hire_date date;

-- Enforce NOT NULL where required
alter table public.employees
  alter column employee_no set not null,
  alter column full_name set not null,
  alter column national_number set not null,
  alter column id_number set not null,
  alter column address set not null,
  alter column hire_date set not null,
  alter column date_of_birth set not null,
  alter column phone_number set not null;

-- Positive employee number
do $$
begin
  alter table public.employees
    add constraint employees_employee_no_positive check (employee_no > 0);
exception
  when duplicate_object then null;
end $$;

-- Date of birth cannot be in the future
do $$
begin
  alter table public.employees
    add constraint employees_dob_not_future check (date_of_birth <= current_date);
exception
  when duplicate_object then null;
end $$;

-- Hire date cannot be before date of birth
do $$
begin
  alter table public.employees
    add constraint employees_hire_after_dob check (hire_date >= date_of_birth);
exception
  when duplicate_object then null;
end $$;

-- Unique constraints
do $$
begin
  alter table public.employees
    add constraint employees_employee_no_key unique (employee_no);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.employees
    add constraint employees_national_number_key unique (national_number);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.employees
    add constraint employees_id_number_key unique (id_number);
exception
  when duplicate_object then null;
end $$;

