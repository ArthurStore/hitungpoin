import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trophy, SignOut, LinkSimple } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { api, resolveAssetUrl } from '../utils/api';
import Button from '../components/Button';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyTournaments().then(setTournaments).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Tournaments</h1>
          <p className="text-sm text-slate-400">Halo, {user?.name}. Kelola turnamen Free Fire kamu.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/admin')}>Admin</Button>
          <Button variant="success" onClick={() => navigate('/tournament/new')}>
            <Plus size={18} /> Buat Turnamen
          </Button>
          <Button variant="ghost" onClick={logout}><SignOut size={18} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-800" />)}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Trophy size={48} className="mx-auto text-slate-600" weight="duotone" />
          <p className="mt-4 text-slate-400">Belum ada turnamen. Buat turnamen pertama kamu!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <div key={t._id} className="glass-panel group rounded-2xl p-5 transition hover:border-emerald/20">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white">{t.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{t.format} | {t.totalMatches} matches</p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${t.status === 'active' ? 'bg-emerald/20 text-emerald' : 'bg-slate-700 text-slate-400'}`}>
                    {t.status}
                  </span>
                </div>
                {t.logo && <img src={resolveAssetUrl(t.logo)} alt="" className="h-10 w-10 rounded-lg object-cover" />}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="primary" size="sm" className="flex-1" onClick={() => navigate(`/tournament/${t._id}`)}>
                  Open Hub
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(`/live/${t._id}`, '_blank')} title="Public Live Link">
                  <LinkSimple size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
