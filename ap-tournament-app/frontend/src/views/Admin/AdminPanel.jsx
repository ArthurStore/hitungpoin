import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Shield, ArrowLeft, Warning, Trash, HardDrives, Lightning, Flask, Image as ImageIcon,
} from '@phosphor-icons/react';
import { api } from '../../utils/api';
import Button from '../../components/Button';
import Toast from '../../components/Toast';

function ConfirmModal({ open, title, message, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <Warning size={28} className="shrink-0 text-crimson" weight="fill" />
          <div>
            <h3 className="font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-400">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [geminiBusy, setGeminiBusy] = useState('');
  const [testResult, setTestResult] = useState(null);

  const refreshMetrics = async () => {
    const data = await api.getAdminMetrics(pin);
    setMetrics(data);
    return data;
  };

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

  const handleReset = async (type) => {
    setResetLoading(type);
    try {
      if (type === 'tournaments') {
        const res = await api.resetAllTournaments(pin);
        setToast({ message: res.message, type: 'success' });
      } else {
        const res = await api.resetMediaStorage(pin);
        setToast({ message: res.message, type: 'success' });
      }
      await refreshMetrics();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setResetLoading('');
      setConfirmAction(null);
    }
  };

  const saveGeminiKey = async () => {
    setGeminiBusy('save');
    try {
      const res = await api.updateGeminiKey(pin, geminiKeyInput);
      setToast({ message: res.configured ? 'Gemini API key saved' : 'API key cleared', type: 'success' });
      setGeminiKeyInput('');
      await refreshMetrics();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setGeminiBusy('');
    }
  };

  const runGeminiTest = async () => {
    setGeminiBusy('test');
    setTestResult(null);
    try {
      const res = await api.testGemini(pin, geminiKeyInput || undefined);
      setTestResult(res);
      setToast({ message: res.ok ? `Gemini OK (${res.latencyMs}ms)` : res.error, type: res.ok ? 'success' : 'error' });
      await refreshMetrics();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setGeminiBusy('');
    }
  };

  const runImageTest = async (file) => {
    if (!file) return;
    setGeminiBusy('image');
    setTestResult(null);
    try {
      const res = await api.testGeminiImage(pin, file);
      setTestResult(res);
      setToast({
        message: res.ok ? `Parsed ${res.results?.length || 0} rows (${res.latencyMs}ms)` : (res.error || 'Failed'),
        type: res.ok ? 'success' : 'error',
      });
      await refreshMetrics();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setGeminiBusy('');
    }
  };

  if (!verified) {
    return (
      <div className="mx-auto max-w-sm space-y-6 pt-12">
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={16} /> Back</Button>
        <div className="glass-panel rounded-2xl p-8 text-center">
          <Shield size={40} className="mx-auto text-gold" weight="duotone" />
          <h1 className="mt-4 font-display text-xl font-bold text-white">Super Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">Masukkan PIN (default: 1234)</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN Code"
            className="mt-6 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-center font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald/40"
            onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
          />
          {error && <p className="mt-2 text-sm text-crimson">{error}</p>}
          <Button variant="secondary" className="mt-4 w-full" onClick={verifyPin} loading={loading}>Verify PIN</Button>
        </div>
      </div>
    );
  }

  const g = metrics?.gemini || {};
  const cards = [
    { label: 'Total Users', value: metrics?.totalUsers },
    { label: 'Active Tournaments', value: metrics?.activeTournaments },
    { label: 'AI Scans', value: metrics?.scansAi },
    { label: 'Manual Scans', value: metrics?.scansManual },
  ];

  return (
    <div className="space-y-8">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        loading={!!resetLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => handleReset(confirmAction.type)}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={16} /></Button>
        <h1 className="font-display text-2xl font-bold text-white">Super Admin Dashboard</h1>
      </div>

      {/* Gemini status */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lightning size={22} className="text-gold" weight="fill" />
            <h2 className="font-bold text-white">Gemini Vision OCR</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            g.configured && g.lastStatus === 'ok' ? 'bg-emerald/20 text-emerald' :
            g.configured ? 'bg-gold/20 text-gold' : 'bg-crimson/20 text-crimson'
          }`}>
            {g.configured ? `Configured · ${g.lastStatus}` : 'API Key Missing'}
          </span>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Model</p>
            <p className="font-mono text-sm text-white">{g.model || 'gemini-2.0-flash'}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Key</p>
            <p className="font-mono text-sm text-white">{g.maskedKey || '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Daily Usage</p>
            <p className="font-mono text-sm text-white">{g.dailyUsage ?? 0}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Last Latency</p>
            <p className="font-mono text-sm text-white">{g.lastLatencyMs != null ? `${g.lastLatencyMs}ms` : '—'}</p>
          </div>
        </div>

        {g.lastError && <p className="mb-3 text-xs text-crimson">{g.lastError}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            placeholder="Paste GEMINI_API_KEY…"
            className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 font-mono text-sm text-white"
          />
          <Button variant="secondary" onClick={saveGeminiKey} loading={geminiBusy === 'save'}>Update Key</Button>
          <Button variant="ghost" onClick={runGeminiTest} loading={geminiBusy === 'test'}>
            <Flask size={16} /> Test Connection
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/10 p-4">
          <p className="mb-2 text-sm font-medium text-white">Gemini Image Match Tester</p>
          <p className="mb-3 text-xs text-slate-500">Upload Free Fire screenshot untuk uji parse rank/team/kills.</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
            <ImageIcon size={16} />
            {geminiBusy === 'image' ? 'Testing…' : 'Upload Test Image'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={geminiBusy === 'image'}
              onChange={(e) => runImageTest(e.target.files?.[0])}
            />
          </label>
          {testResult && (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-emerald/90">
              {JSON.stringify(testResult.results || testResult, null, 2)}
            </pre>
          )}
        </div>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="mb-4 font-bold text-white">Weekly Activity (Line)</h2>
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="mb-4 font-bold text-white">Tournaments Created (Bar)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} />
                  <Bar dataKey="tournaments" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-2 font-bold text-white">System Actions</h2>
        <p className="mb-4 text-sm text-slate-400">Tindakan destruktif — butuh konfirmasi.</p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            onClick={() => setConfirmAction({
              type: 'tournaments',
              title: 'Reset All Tournaments?',
              message: 'Semua turnamen, tim, dan match akan dihapus. User tetap ada.',
            })}
            loading={resetLoading === 'tournaments'}
          >
            <Trash size={16} /> Reset All Tournaments
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmAction({
              type: 'media',
              title: 'Clear Media Uploads?',
              message: 'Semua logo/template di server akan dihapus.',
            })}
            loading={resetLoading === 'media'}
          >
            <HardDrives size={16} /> Clear Media Uploads
          </Button>
        </div>
      </div>
    </div>
  );
}
