import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      // App login route handles role home; still navigate as fallback
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-slate-950 text-white p-12">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-amber-400">CoreTech WMS</div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">
            Warehouse
            <br />
            Packing System
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Scan boxes, pallets, and products with role-based access for admins, PO clerks, and floor workers.
          </p>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <Package /> Box · Pallet · SKU workflows
        </div>
      </div>
      <div className="grid place-items-center p-8 bg-slate-50">
        <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">Use your warehouse credentials.</p>
          <label className="block mt-6 text-sm font-medium">Username</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <label className="block mt-4 text-sm font-medium">Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            disabled={busy}
            className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Login'}
          </button>
          <p className="mt-4 text-xs text-slate-400">
            Demo: admin / admin123 · worker / worker123 · poclerk / poclerk123
          </p>
        </form>
      </div>
    </div>
  );
}
