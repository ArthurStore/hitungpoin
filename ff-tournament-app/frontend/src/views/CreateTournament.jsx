import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Upload, MapPin, Users, CheckCircle } from '@phosphor-icons/react';
import Button from '../components/Button';
import { useTournament } from '../context/TournamentContext';
import { FORMATS, MAPS } from '../utils/pointsCalc';

const STEPS = ['Info Dasar', 'Format & Match', 'Roster Tim'];

export default function CreateTournament() {
  const navigate = useNavigate();
  const { createTournament, loading } = useTournament();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    logo: '',
    format: 'One Day',
    targetPoints: 80,
    totalMatches: 6,
    matchConfigs: [],
    rosterText: '',
  });

  const selectedFormat = FORMATS.find((f) => f.id === form.format);

  useEffect(() => {
    if (form.matchConfigs.length === 0 && selectedFormat) {
      setForm((prev) => ({
        ...prev,
        matchConfigs: Array.from({ length: selectedFormat.matches }, (_, i) => ({
          matchNumber: i + 1,
          map: MAPS[i % MAPS.length],
        })),
      }));
    }
  }, [form.matchConfigs.length, selectedFormat]);

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'format') {
        const fmt = FORMATS.find((f) => f.id === value);
        next.totalMatches = fmt?.matches || 6;
        next.matchConfigs = Array.from({ length: next.totalMatches }, (_, i) => ({
          matchNumber: i + 1,
          map: MAPS[i % MAPS.length],
        }));
      }
      return next;
    });
  };

  const updateMap = (matchNumber, map) => {
    setForm((prev) => ({
      ...prev,
      matchConfigs: prev.matchConfigs.map((m) =>
        m.matchNumber === matchNumber ? { ...m, map } : m
      ),
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    try {
      await createTournament(form);
      navigate('/match');
    } catch {
      /* error handled in context */
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Buat Turnamen Baru</h1>
        <p className="mt-1 text-sm text-slate-400">Wizard setup turnamen Free Fire</p>
      </div>

      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= step ? 'bg-crimson text-white' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {i < step ? <CheckCircle size={16} weight="fill" /> : i + 1}
            </div>
            <span className={`hidden text-xs sm:block ${i <= step ? 'text-white' : 'text-slate-500'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="hidden h-px flex-1 bg-slate-700 sm:block" />}
          </div>
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass-panel rounded-2xl p-6"
      >
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Nama Turnamen</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Contoh: FF Pro League Season 3"
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white placeholder:text-slate-500 focus:border-crimson/50 focus:outline-none focus:ring-1 focus:ring-crimson/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Logo Turnamen</label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-slate-800/30 px-6 py-8 transition hover:border-crimson/30">
                {form.logo ? (
                  <img src={form.logo} alt="Logo preview" className="h-20 w-20 rounded-xl object-cover" />
                ) : (
                  <>
                    <Upload size={28} className="text-slate-500" />
                    <span className="mt-2 text-sm text-slate-400">Upload logo turnamen</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-300">Format Turnamen</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => update('format', fmt.id)}
                    className={`rounded-xl border p-4 text-left transition active:scale-[0.98] ${
                      form.format === fmt.id
                        ? 'border-crimson/50 bg-crimson/10 glow-crimson'
                        : 'border-white/10 bg-slate-800/30 hover:border-white/20'
                    }`}
                  >
                    <p className="font-semibold text-white">{fmt.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{fmt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.format === 'Champions Rush' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Target Poin (Booyah + {form.targetPoints} pts)
                </label>
                <input
                  type="number"
                  value={form.targetPoints}
                  onChange={(e) => update('targetPoints', parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-mono text-white focus:border-gold/50 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                <MapPin size={16} /> Konfigurasi Map per Match
              </label>
              <div className="space-y-2">
                {(form.matchConfigs.length
                  ? form.matchConfigs
                  : Array.from({ length: selectedFormat?.matches || 6 }, (_, i) => ({
                      matchNumber: i + 1,
                      map: MAPS[i % MAPS.length],
                    }))
                ).map((mc) => (
                  <div key={mc.matchNumber} className="flex items-center gap-3 rounded-xl bg-slate-800/40 px-4 py-2.5">
                    <span className="w-20 font-mono text-sm text-gold">Match {mc.matchNumber}</span>
                    <select
                      value={mc.map}
                      onChange={(e) => updateMap(mc.matchNumber, e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {MAPS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Users size={16} /> Roster Tim
              </label>
              <p className="mb-3 text-xs text-slate-500">
                Format: Team Alpha | Player1 // Player2 // Player3 // Player4
              </p>
              <textarea
                value={form.rosterText}
                onChange={(e) => update('rosterText', e.target.value)}
                rows={10}
                placeholder={`Evos Reborn | RebornX // ShadowK // Flame99 // AcePro\nRRQ Hoshi | Lemon // R7 // Xynnn // Clay\nONIC Esports | Butsss // CW // Sanz // Kell`}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-mono text-sm text-white placeholder:text-slate-600 focus:border-emerald/50 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Kembali
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !form.name}>
              Lanjut
            </Button>
          ) : (
            <Button variant="success" onClick={handleSubmit} loading={loading}>
              Buat Turnamen
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
