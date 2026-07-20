import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './views/Auth/Login';
import Register from './views/Auth/Register';
import Dashboard from './views/Dashboard';
import AdminPanel from './views/Admin/AdminPanel';
import LiveStandings from './views/Public/LiveStandings';
import TournamentHub from './views/TournamentHub';
import SetupTab, { CreateTournamentPage } from './views/TournamentHub/SetupTab';
import TeamsTab from './views/TournamentHub/TeamsTab';
import MatchInputTab from './views/TournamentHub/MatchInputTab';
import LeaderboardTab from './views/TournamentHub/LeaderboardTab';
import CertificateTab from './views/TournamentHub/CertificateTab';

function AppLayout({ children }) {
  return (
    <div className="min-h-[100dvh] bg-slate-950">
      <header className="border-b border-white/5 bg-slate-950/80 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald/20 text-xs font-bold text-emerald">AP</div>
          <span className="font-bold text-white">Arthur Points</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/live/:tournamentId" element={<LiveStandings />} />

        <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminPanel /></AppLayout></ProtectedRoute>} />

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
  );
}
