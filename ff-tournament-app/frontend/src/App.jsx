import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar, { MobileSidebarOverlay } from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import CreateTournament from './views/CreateTournament';
import MatchInput from './views/MatchInput';
import Leaderboard from './views/Leaderboard';
import CertificateGenerator from './views/CertificateGenerator';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950">
      <Navbar onMenuToggle={() => setSidebarOpen(true)} />

      <div className="flex flex-1">
        <div className="hidden w-64 shrink-0 lg:block">
          <Sidebar />
        </div>

        <MobileSidebarOverlay open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </MobileSidebarOverlay>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/create" element={<CreateTournament />} />
              <Route path="/match" element={<MatchInput />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/certificates" element={<CertificateGenerator />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
