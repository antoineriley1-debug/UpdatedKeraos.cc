'use client';
import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';

const T = {
  bg: '#1a1815',
  surface: '#221f1a',
  border: '#3a342d',
  bronze: '#c39248',
  bronzeDim: '#a87938',
  text: '#e8e4dc',
  textMute: '#a89e90',
  textDim: '#6b6358',
  red: '#c95a5a',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setSubmitting(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError('Network error — try again');
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px 11px 38px',
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 7, color: T.text, fontSize: 14,
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: '"Outfit", -apple-system, system-ui, sans-serif',
    }}>
      <form onSubmit={submit} style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 32,
        width: 'min(420px, 100%)',
        boxShadow: '0 24px 64px -16px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: `linear-gradient(135deg, ${T.bronze}, ${T.bronzeDim})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: `0 8px 24px -8px ${T.bronze}80`,
        }}>
          <Lock size={22} color={T.bg} strokeWidth={2.5} />
        </div>

        <div style={{
          textAlign: 'center', fontSize: 11, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: T.bronze, marginBottom: 6, fontWeight: 500,
        }}>
          MedStar Facilities
        </div>
        <h1 className="display" style={{
          textAlign: 'center', fontSize: 24, fontWeight: 500,
          color: T.text, margin: '0 0 28px',
        }}>
          Priority Tasks
        </h1>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.textDim }} />
          <input
            autoFocus
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle}
            required
          />
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.textDim }} />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
            required
          />
        </div>

        {error && (
          <div style={{
            padding: '9px 12px', borderRadius: 6,
            background: T.red + '15', border: `1px solid ${T.red}40`,
            color: T.red, fontSize: 12, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          style={{
            width: '100%', padding: '12px',
            background: T.bronze, color: T.bg,
            border: 'none', borderRadius: 7, cursor: (submitting || !email || !password) ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            opacity: (submitting || !email || !password) ? 0.5 : 1,
            boxShadow: `0 4px 16px -4px ${T.bronze}80`,
          }}
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>

        <div style={{
          marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}`,
          fontSize: 11, color: T.textDim, textAlign: 'center', lineHeight: 1.6,
        }}>
          Need an account? Ask your admin to add you to the user list.
        </div>
      </form>
    </div>
  );
}
