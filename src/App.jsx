import { Routes, Route } from 'react-router-dom'
import LandingPage from './components/landing/LandingPage'
import LoginPage from './components/auth/LoginPage'
import CheckoutPage from './components/cart/CheckoutPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { PlanProvider } from './lib/planContext'
import DashboardLayout from './components/dashboard/DashboardLayout'
import DashboardHome from './components/dashboard/DashboardHome'
import VacancyList from './components/vacancies/VacancyList'
import VacancyForm from './components/vacancies/VacancyForm'
import VacancyDetail from './components/vacancies/VacancyDetail'
import CandidateBank from './components/candidates/CandidateBank'
import CandidateProfile from './components/candidates/CandidateProfile'
import CursosList from './components/cursos/CursosList'
import AcademyDashboard from './components/academy/AcademyDashboard'
import ResourceViewer from './components/academy/ResourceViewer'
import CalendarView from './components/dashboard/CalendarView'
import SettingsPage from './components/dashboard/SettingsPage'
import AdminPanel from './components/dashboard/AdminPanel'
import SubscriptionsDashboard from './components/dashboard/SubscriptionsDashboard'
import MarcaVendeDashboard from './components/marca-vende/MarcaVendeDashboard'
import DiagnosticoPage from './components/marca-vende/DiagnosticoPage'
import PerfilProPage from './components/marca-vende/PerfilProPage'
import RecruiterToolsDashboard from './components/recruiter-tools/RecruiterToolsDashboard'
import PromptsGenerator from './components/recruiter-tools/PromptsGenerator'
import OutreachTemplates from './components/recruiter-tools/OutreachTemplates'
import SearchGuides from './components/recruiter-tools/SearchGuides'
import TrackingFormats from './components/recruiter-tools/TrackingFormats'
import ReportsGenerator from './components/recruiter-tools/ReportsGenerator'
import EntrevistaSimulador from './components/marca-vende/EntrevistaSimulador'
import VisibilidadStrategy from './components/marca-vende/VisibilidadStrategy'
import LiveSessionsPage from './components/academy/LiveSessionsPage'
import PlaybooksPage from './components/academy/PlaybooksPage'
import TalentDeskDashboard from './components/talent-desk/TalentDeskDashboard'
import TalentDeskDelivery from './components/talent-desk/TalentDeskDelivery'
import CandidatePortal from './components/candidate-portal/CandidatePortal'
import CandidateProfileBuilder from './components/candidate-portal/CandidateProfileBuilder'
import AcompanamientoDashboard from './components/marca-vende/AcompanamientoDashboard'
import ExtendedLibrary from './components/academy/ExtendedLibrary'
import EnterpriseDashboard from './components/enterprise/EnterpriseDashboard'
import StrategicConfig from './components/enterprise/StrategicConfig'
import BestPractices from './components/recruiter-tools/BestPractices'

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/candidate" element={<CandidatePortal />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/success" element={<CheckoutPage />} />

      {/* Dashboard (protected) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PlanProvider>
              <DashboardLayout />
            </PlanProvider>
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
        <Route path="academy" element={<AcademyDashboard />} />
        <Route path="academy/:resourceId" element={<ResourceViewer />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="subscriptions" element={<SubscriptionsDashboard />} />
        <Route path="marca-vende" element={<MarcaVendeDashboard />} />
        <Route path="marca-vende/diagnostico" element={<DiagnosticoPage />} />
        <Route path="marca-vende/perfil-pro" element={<PerfilProPage />} />
        <Route path="recruiter-tools" element={<RecruiterToolsDashboard />} />
        <Route path="recruiter-tools/prompts" element={<PromptsGenerator />} />
        <Route path="recruiter-tools/outreach" element={<OutreachTemplates />} />
        <Route path="recruiter-tools/search-guides" element={<SearchGuides />} />
        <Route path="recruiter-tools/tracking" element={<TrackingFormats />} />
        <Route path="recruiter-tools/reports" element={<ReportsGenerator />} />
        <Route path="marca-vende/entrevista" element={<EntrevistaSimulador />} />
        <Route path="marca-vende/visibilidad" element={<VisibilidadStrategy />} />
        <Route path="academy/live-sessions" element={<LiveSessionsPage />} />
        <Route path="academy/playbooks" element={<PlaybooksPage />} />
        <Route path="talent-desk" element={<TalentDeskDashboard />} />
        <Route path="talent-desk/delivery/:vacancyId" element={<TalentDeskDelivery />} />
        <Route path="candidate-profile" element={<CandidateProfileBuilder />} />
        <Route path="marca-vende/acompanamiento" element={<AcompanamientoDashboard />} />
        <Route path="enterprise" element={<EnterpriseDashboard />} />
        <Route path="enterprise/config" element={<StrategicConfig />} />
        <Route path="academy/library" element={<ExtendedLibrary />} />
        <Route path="recruiter-tools/best-practices" element={<BestPractices />} />
      </Route>
    </Routes>
  )
}

export default App
