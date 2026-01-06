## HR Employee Info Web App

React + Vite + TypeScript + Tailwind frontend with Supabase Postgres/Auth for managing employee records (create, edit, view, search/filter/sort, CSV export, separation tracking).

### Prerequisites
- Node.js 18+
- Supabase project (URL + anon key)

### Setup
1) Install deps
```bash
npm install
```

2) Create environment file
```
VITE_SUPABASE_URL=https://flqfcbhqlzosojbryaxy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ilR2Q1GtGBSqj_ZhG03L8A_AHxz_ajr
```

3) Apply database schema in Supabase SQL editor
- File: `supabase/sql/schema.sql` (tables, constraints, triggers, RLS policies)

4) Run dev server
```bash
npm run dev
```

### Auth & Admin
- Email/password auth via Supabase Auth (`/auth` route).
- After signup, insert your profile row automatically; mark yourself admin:
```sql
update profiles set is_admin = true where id = '<your-user-id>';
```
- Only admins can view/manage employees due to RLS.

### Routes
- `/auth` login/signup
- `/employees` list with search (name/employee_id/phone/national_number), filters (status/department/branch), sort (newest/name/employee_id), CSV export, add.
- `/employees/new` create (personal, employment, payroll, separation, documents, notes)
- `/employees/:id` profile + status change actions + history timeline
- `/employees/:id/edit` edit employee

### CSV Export
- Uses current filtered list; includes computed Age column (client-side).

### Status changes
- Buttons for Active/On Hold.
- Resign/Terminate opens modal to capture separation date/reason/final day/rehire eligibility/notice/exit/clearance and writes to `employee_status_history` via trigger.

