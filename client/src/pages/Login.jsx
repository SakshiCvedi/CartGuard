import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api, setToken } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('demo@cartguard.dev');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.demoEmail().then((d) => {
      if (d.demoEmail) setEmail(d.demoEmail);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.login(email, password);
      setToken(data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--ink)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <ShieldCheck size={26} style={{ color: 'var(--amber)' }} strokeWidth={2} />
          <span className="font-display font-semibold text-xl" style={{ color: 'var(--paper)' }}>CartGuard</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg p-6 border"
          style={{ background: 'var(--panel)', borderColor: 'var(--panel-2)' }}
        >
          <h1 className="font-display text-lg mb-1" style={{ color: 'var(--paper)' }}>Store owner login</h1>
          <p className="text-[13px] mb-5" style={{ color: 'var(--steel)' }}>Demo credentials are pre-filled — just sign in.</p>

          <label className="block text-[12px] mb-1.5" style={{ color: 'var(--steel)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md px-3 py-2 mb-4 text-[14px] outline-none"
            style={{ background: 'var(--panel-2)', color: 'var(--paper)', border: '1px solid transparent' }}
            required
          />

          <label className="block text-[12px] mb-1.5" style={{ color: 'var(--steel)' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md px-3 py-2 mb-5 text-[14px] outline-none"
            style={{ background: 'var(--panel-2)', color: 'var(--paper)', border: '1px solid transparent' }}
            required
          />

          {error && (
            <div className="text-[13px] mb-4 px-3 py-2 rounded-md" style={{ color: 'var(--clay)', background: 'rgba(193,85,58,0.12)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md py-2 text-[14px] font-medium transition-opacity disabled:opacity-60"
            style={{ background: 'var(--amber)', color: 'var(--ink)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
