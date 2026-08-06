import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import APLogo from './components/APLogo';
import ThemeToggle from './components/ThemeToggle';
import Login from './views/Auth/Login';
import Register from './views/Auth/Register';
import Dashboard from './views/Dashboard';
import AdminPanel from './views/Admin/AdminPanel';
import LiveStandings from './views/Public/LiveStandings';
import ObsOverlay from './views/Public/ObsOverlay';
import TournamentHub from './views/TournamentHub';
import SetupTab, { CreateTournamentPage } from './views/TournamentHub/SetupTab';
import TeamsTab from './views/TournamentHub/TeamsTab';
import MatchInputTab from './views/TournamentHub/MatchInputTab';
import LeaderboardTab from './views/TournamentHub/LeaderboardTab';
import CertificateTab from './views/TournamentHub/CertificateTab';

function AppLayout({ children }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--ap-bg)]">
      <header className="border-b border-[var(--ap-border)] bg-[var(--ap-bg)]/80 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <APLogo size="sm" />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/live/:tournamentId" element={<LiveStandings />} />
          <Route path="/overlay/:tournamentSlug" element={<ObsOverlay />} />

          <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />

          <Route path="/admin" element={<AppLayout><AdminPanel /></AppLayout>} />

          <Route path="/tournament/new" element={
            <ProtectedRoute><AppLayout><CreateTournamentPage /></AppLayout></ProtectedRoute>
          } />

          <Route path="/tournament/:id" element={
            <ProtectedRoute><AppLayout><TournamentHub /></AppLayout></ProtectedRoute>
          }>
            <Route index element={<Navigate to="match" replace />} />
            <Route path="setup" element={<SetupTab />} />
            <Route path="teams" element={<TeamsTab />} />
            <Route path="match" element={<MatchInputTab />} />
            <Route path="leaderboard" element={<LeaderboardTab />} />
            <Route path="certificates" element={<CertificateTab />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
