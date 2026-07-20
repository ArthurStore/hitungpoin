import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Shield, ArrowLeft } from '@phosphor-icons/react';
import { api } from '../../utils/api';
import Button from '../../components/Button';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verifyPin = async () => {
    setError('');
    setLoading(true);
    try {
      await api.verifyAdminPin(pin);
      const data = await api.getAdminMetrics(pin);
      setMetrics(data);
      setVerified(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!verified) {
    return (
      <div className="mx-auto max-w-sm space-y-6 pt-12">
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={16} /> Back</Button>
        <div className="glass-panel rounded-2xl p-8 text-center">
          <Shield size={40} className="mx-auto text-gold" weight="duotone" />
          <h1 className="mt-4 text-xl font-bold text-white">Super Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">Enter PIN to access system metrics</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN Code"
            className="mt-6 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-center font-mono text-white focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
          />
          {error && <p className="mt-2 text-sm text-crimson">{error}</p>}
          <Button variant="gold" className="mt-4 w-full" onClick={verifyPin} loading={loading}>Verify PIN</Button>
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: metrics?.totalUsers },
    { label: 'Active Tournaments', value: metrics?.activeTournaments },
    { label: 'Total Scans', value: metrics?.totalScans },
    { label: 'Total Tournaments', value: metrics?.totalTournaments },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={16} /></Button>
        <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-panel rounded-2xl p-5">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white">{c.value ?? 0}</p>
          </div>
        ))}
      </div>

      {metrics?.chartData?.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="mb-4 font-bold text-white">Growth Chart (14 Days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="scans" stroke="#F59E0B" strokeWidth={2} />
                <Line type="monotone" dataKey="tournaments" stroke="#EF4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
