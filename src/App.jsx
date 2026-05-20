import { Routes, Route } from 'react-router-dom'
import LandingPage from './components/landing/LandingPage'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import DashboardLayout from './components/dashboard/DashboardLayout'
import DashboardHome from './components/dashboard/DashboardHome'
import VacancyList from './components/vacancies/VacancyList'
import VacancyForm from './components/vacancies/VacancyForm'
import VacancyDetail from './components/vacancies/VacancyDetail'
import CandidateBank from './components/candidates/CandidateBank'
import CandidateProfile from './components/candidates/CandidateProfile'
import CursosList from './components/cursos/CursosList'
import CalendarView from './components/dashboard/CalendarView'
import SettingsPage from './components/dashboard/SettingsPage'

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard (protected) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="vacancies" element={<VacancyList />} />
        <Route path="vacancies/new" element={<VacancyForm />} />
        <Route path="vacancies/:id" element={<VacancyDetail />} />
        <Route path="candidates" element={<CandidateBank />} />
        <Route path="candidates/:id" element={<CandidateProfile />} />
        <Route path="cursos" element={<CursosList />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
