import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Trophy,
  Scan,
  CurrencyCircleDollar,
  TrendUp,
} from '@phosphor-icons/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../utils/api';

const metrics = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'text-emerald', bg: 'bg-emerald/10' },
  { key: 'totalTournaments', label: 'Total Turnamen', icon: Trophy, color: 'text-crimson', bg: 'bg-crimson/10' },
  { key: 'totalScans', label: 'AI Scan Diproses', icon: Scan, color: 'text-gold', bg: 'bg-gold/10' },
  { key: 'estimatedRevenue', label: 'Estimasi Revenue', icon: CurrencyCircleDollar, color: 'text-emerald', bg: 'bg-emerald/10' },
];

function formatRevenue(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-800" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Analytics Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Metrik sistem GridPlay FF Edition
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ key, label, icon: Icon, color, bg }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="glass-panel rounded-2xl p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 font-mono text-2xl font-bold text-white">
                  {key === 'estimatedRevenue'
                    ? formatRevenue(data?.[key] || 0)
                    : (data?.[key] ?? 0).toLocaleString('id-ID')}
                </p>
              </div>
              <div className={`rounded-xl p-2.5 ${bg}`}>
                <Icon size={22} weight="duotone" className={color} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="glass-panel rounded-2xl p-6"
      >
        <div className="mb-6 flex items-center gap-2">
          <TrendUp size={20} className="text-emerald" weight="duotone" />
          <h2 className="text-lg font-bold text-white">Aktivitas 14 Hari Terakhir</h2>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="users"
                name="Active Users"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="scans"
                name="OCR Scans"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="tournaments"
                name="Turnamen Baru"
                stroke="#EF4444"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
