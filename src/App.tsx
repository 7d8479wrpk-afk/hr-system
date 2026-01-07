import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './pages/AuthPage'
import { EmployeesListPage } from './pages/EmployeesListPage'
import { TerminatedEmployeesPage } from './pages/TerminatedEmployeesPage'
import { AttendancePage } from './pages/AttendancePage'
import { AttendanceTakePage } from './pages/AttendanceTakePage'
import { EmployeeCreatePage } from './pages/EmployeeCreatePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { EmployeeEditPage } from './pages/EmployeeEditPage'
import { EmailConfirmed } from './pages/EmailConfirmed'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'

const AdminShell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireAdmin>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
)

const App = () => {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/email-confirmed" element={<EmailConfirmed />} />
      <Route path="/auth/confirmed" element={<EmailConfirmed />} />
      <Route
        path="/employees"
        element={
          <AdminShell>
            <EmployeesListPage />
          </AdminShell>
        }
      />
      <Route
        path="/attendance"
        element={
          <AdminShell>
            <AttendancePage />
          </AdminShell>
        }
      />
      <Route
        path="/attendance/take"
        element={
          <AdminShell>
            <AttendanceTakePage />
          </AdminShell>
        }
      />
      <Route
        path="/terminated"
        element={
          <AdminShell>
            <TerminatedEmployeesPage />
          </AdminShell>
        }
      />
      <Route
        path="/employees/new"
        element={
          <AdminShell>
            <EmployeeCreatePage />
          </AdminShell>
        }
      />
      <Route
        path="/employees/:id"
        element={
          <AdminShell>
            <EmployeeProfilePage />
          </AdminShell>
        }
      />
      <Route
        path="/employees/:id/edit"
        element={
          <AdminShell>
            <EmployeeEditPage />
          </AdminShell>
        }
      />
      <Route path="/" element={<Navigate to="/employees" replace />} />
      <Route path="*" element={<Navigate to="/employees" replace />} />
    </Routes>
  )
}

export default App
