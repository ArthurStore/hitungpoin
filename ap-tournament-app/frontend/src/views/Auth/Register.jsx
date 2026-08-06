import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import ThemeToggle from '../../components/ThemeToggle';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[var(--ap-bg)] px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <h1 className="mb-6 text-2xl font-bold text-white light:text-slate-900">Register Organizer</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {['name', 'email', 'password'].map((field) => (
            <div key={field}>
              <label className="mb-2 block text-sm capitalize text-slate-300">{field === 'name' ? 'Nama' : field}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:outline-none light:border-slate-300 light:bg-white light:text-slate-900"
              />
            </div>
          ))}
          {error && <p className="text-sm text-crimson">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>Register</Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun? <Link to="/login" className="text-emerald hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
