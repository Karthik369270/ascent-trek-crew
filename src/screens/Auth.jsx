import { useState } from 'react';
import { api, getMode, hasSupabase, setMode } from '../lib/api/index.js';
import { useApp } from '../lib/hooks.js';
import Icon from '../components/Icon.jsx';
import { MountainProfile } from '../components/Charts.jsx';

export default function Auth() {
  const { toast, theme, setPref } = useApp();
  const [mode, setFormMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const demoOnly = getMode() === 'demo';

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signup') {
        const r = await api.signUp(email.trim(), password, name.trim());
        if (r.needsConfirm) { setMsg('Check your inbox and confirm your email, then sign in.'); setFormMode('signin'); }
      } else {
        await api.signIn(email.trim(), password);
      }
    } catch (err) {
      setMsg(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo() {
    if (getMode() === 'demo') { await api.signIn(); return; }
    setMode('demo');
    localStorage.setItem('ascent-demo-enter', '1');
    location.reload();
  }

  return (
    <div className="auth">
      <button className="icon-btn auth-theme" onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <section className="auth-hero card mint">
        <div className="brand"><img src="/icon.svg" alt="" width="40" height="40" /><span>Ascent</span></div>
        <h1>Train together.<br />Summit together.</h1>
        <p className="muted">A private tracker for your trek crew: log walks and stair climbs, keep streaks, and see who's ready for Chandrashila.</p>
        <div className="auth-profile"><MountainProfile lap={0.62} height={130} /></div>
      </section>

      <section className="auth-card card">
        {demoOnly && !hasSupabase ? (
          <>
            <h2>Preview mode</h2>
            <p className="muted">No backend is connected yet, so the app runs as a demo with a sample crew. Data stays on this device.</p>
            <button className="btn btn-lime btn-block" onClick={enterDemo}><Icon name="play" size={16} /> Enter the demo</button>
            <p className="muted small">To use it with your friends, connect Supabase. The README has the steps.</p>
          </>
        ) : (
          <>
            <div className="segmented">
              <button className={mode === 'signin' ? 'on' : ''} onClick={() => setFormMode('signin')} type="button">Sign in</button>
              <button className={mode === 'signup' ? 'on' : ''} onClick={() => setFormMode('signup')} type="button">Create account</button>
            </div>
            <form onSubmit={submit} className="form">
              {mode === 'signup' && (
                <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="What your friends call you" autoComplete="name" /></label>
              )}
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
              <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 6 characters" /></label>
              {msg && <p className="form-msg">{msg}</p>}
              <button className="btn btn-ink btn-block" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
            </form>
            <div className="divider"><span>or</span></div>
            <button className="btn btn-ghost btn-block" onClick={() => enterDemo().catch((e) => toast(e.message))}>Try the demo crew</button>
          </>
        )}
      </section>
    </div>
  );
}
