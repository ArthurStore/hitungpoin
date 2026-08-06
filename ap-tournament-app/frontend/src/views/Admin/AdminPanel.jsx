import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Shield, ArrowLeft, Warning, Trash, HardDrives, Lightning, Flask, Image as ImageIcon,
} from '@phosphor-icons/react';
import { api } from '../../utils/api';
import { calcMatchPoints } from '../../utils/pointsCalc';
import Button from '../../components/Button';
import Toast from '../../components/Toast';

function AnalyserPreview({ result }) {
  if (!result) return null;

  const rawRows = result.results || [];
  const rows = calcMatchPoints(
    rawRows.map((r) => ({
      placement: r.placement || r.rank,
      rank: r.rank || r.placement,
      teamName: r.teamName || r.team_name || '',
      nickname: r.nickname || r.teamName || r.team_name || '',
      kills: r.kills ?? 0,
      players: r.players || [],
    })),
    'cr_biasa'
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span>Model: <span className="font-mono text-white">{result.model || '—'}</span></span>
        <span>Key slot: <span className="font-mono text-white">{result.keySlot || '—'}</span></span>
        <span>Latency: <span className="font-mono text-white">{result.latencyMs != null ? `${result.latencyMs}ms` : '—'}</span></span>
        <span className={result.ok || result.success ? 'text-emerald' : 'text-crimson'}>
          {result.ok || result.success ? `OK · ${rows.length} baris` : (result.error || 'Gagal')}
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-slate-800/80 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Tim</th>
                <th className="px-3 py-2">Nick</th>
                <th className="px-3 py-2">4 Players</th>
                <th className="px-3 py-2 text-right">Kills</th>
                <th className="px-3 py-2 text-right">Poin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const players = rawRows[i]?.players || [];
                return (
                  <tr key={r.placement} className="border-t border-white/5 text-slate-200 align-top">
                    <td className="px-3 py-2 font-mono text-gold">{r.placement}</td>
                    <td className="px-3 py-2 font-medium text-white">{r.teamName}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{r.nickname}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-400">
                      {players.length ? players.map((p) => `${p.nickname} (${p.kills ?? 0})`).join(' · ') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.kills}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald">{r.totalPoints}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-crimson/10 px-3 py-2 text-xs text-crimson">
          Tidak ada baris ter-parse. Coba screenshot scoreboard yang lebih jelas.
        </p>
      )}

      {(result.rawPreview || result.text || result.raw) && (
        <details className="rounded-lg bg-black/40">
          <summary className="cursor-pointer px-3 py-2 text-[11px] text-slate-500">Raw response</summary>
          <pre className="max-h-40 overflow-auto px-3 pb-3 font-mono text-[10px] text-emerald/80">
            {typeof (result.rawPreview || result.text || result.raw) === 'string'
              ? (result.rawPreview || result.text || result.raw)
              : JSON.stringify(result.results ?? result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

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
  const [geminiKeys, setGeminiKeys] = useState(['', '', '']);
  const [geminiBusy, setGeminiBusy] = useState('');
  const [testResult, setTestResult] = useState(null);

  const refreshMetrics = async () => {
    const data = await api.getAdminMetrics(pin);
    setMetrics(data);
    if (data?.gemini?.keys) {
      setGeminiKeys([
        data.gemini.keys[0] || '',
        data.gemini.keys[1] || '',
        data.gemini.keys[2] || '',
      ]);
    }
    return data;
  };

  const verifyPin = async () => {
    setError('');
    setLoading(true);
    try {
      await api.verifyAdminPin(pin);
      await refreshMetrics();
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
      const res = await api.updateGeminiKey(pin, { keys: geminiKeys });
      setToast({
        message: res.configured
          ? `Saved ${res.activeSlots?.length || 0} API key slot(s)`
          : 'All API keys cleared',
        type: 'success',
      });
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
      const firstFilled = geminiKeys.find((k) => k.trim());
      const res = await api.testGemini(pin, firstFilled || undefined);
      setTestResult(res);
      setToast({ message: res.ok ? `Gemini OK key#${res.keySlot || '?'} (${res.latencyMs}ms)` : res.error, type: res.ok ? 'success' : 'error' });
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
            <p className="font-mono text-sm text-white">{g.model || 'gemini-flash-latest'}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Active Slots</p>
            <p className="font-mono text-sm text-white">{(g.activeSlots || []).join(', ') || '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Last Key Used</p>
            <p className="font-mono text-sm text-white">{g.lastKeySlot != null ? `#${g.lastKeySlot}` : '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Daily / Latency</p>
            <p className="font-mono text-sm text-white">{g.dailyUsage ?? 0} · {g.lastLatencyMs != null ? `${g.lastLatencyMs}ms` : '—'}</p>
          </div>
        </div>

        {g.lastError && <p className="mb-3 text-xs text-crimson">{g.lastError}</p>}

        <div className="mb-3 space-y-2">
          <p className="text-sm font-medium text-white">API Key Switcher (3 slots · Round-Robin + Fallback)</p>
          <p className="text-xs text-slate-500">Key tampil plaintext. OCR memilih key bergantian; jika limit/error → fallback key berikutnya.</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-bold text-gold">Key {i + 1}</span>
              <input
                type="text"
                value={geminiKeys[i]}
                onChange={(e) => {
                  const next = [...geminiKeys];
                  next[i] = e.target.value;
                  setGeminiKeys(next);
                }}
                placeholder={`Paste GEMINI_API_KEY ${i + 1}…`}
                className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 font-mono text-sm text-white"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={saveGeminiKey} loading={geminiBusy === 'save'}>Save All Keys</Button>
            <Button variant="ghost" onClick={runGeminiTest} loading={geminiBusy === 'test'}>
              <Flask size={16} /> Test Connection
            </Button>
          </div>
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
          {testResult && <AnalyserPreview result={testResult} />}
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
