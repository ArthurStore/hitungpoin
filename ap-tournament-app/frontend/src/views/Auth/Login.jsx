import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald/20 text-lg font-bold text-emerald">AP</div>
          <h1 className="text-2xl font-bold text-white">Arthur Points</h1>
          <p className="mt-1 text-sm text-slate-400">Login untuk manage turnamen Free Fire</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:border-emerald/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:border-emerald/50 focus:outline-none" />
          </div>
          {error && <p className="text-sm text-crimson">{error}</p>}
          <Button type="submit" variant="success" className="w-full" loading={loading}>Login</Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun? <Link to="/register" className="text-emerald hover:underline">Register</Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-600">Demo: demo@ap.local / demo1234</p>
      </div>
    </div>
  );
}
