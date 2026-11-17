import { useState } from 'react';
import { api } from '../lib/api/index.js';
import { useApp } from '../lib/hooks.js';
import { addDays, isoDate } from '../lib/stats.js';
import { Segmented } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

export default function Onboarding() {
  const { profile, setProfile, loadAll, signOut } = useApp();
  const [name, setName] = useState(profile?.name || '');
  const [mode, setMode] = useState('create');
  const [crew, setCrew] = useState('Chandrashila Crew');
  const [date, setDate] = useState(isoDate(addDays(new Date(), 30)));
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('join') || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (name.trim() && name.trim() !== profile.name) setProfile(await api.updateProfile(profile.id, { name: name.trim() }));
      if (mode === 'create') await api.createGroup({ name: crew.trim(), trek_date: date });
      else await api.joinGroup(code);
      history.replaceState(null, '', location.pathname);
      await loadAll();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboard">
      <form className="card onboard-card" onSubmit={submit}>
        <div className="brand"><img src="/icon.svg" alt="" width="36" height="36" /><span>Ascent</span></div>
        <h2>Set up your crew</h2>
        <p className="muted">One person creates the crew and shares the invite code. Everyone else joins with it.</p>
        <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Karthik" /></label>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'create', label: 'Create a crew', icon: 'plus' }, { value: 'join', label: 'Join with code', icon: 'crew' }]} />
        {mode === 'create' ? (
          <>
            <label>Crew name<input value={crew} onChange={(e) => setCrew(e.target.value)} required /></label>
            <label>Trek start date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          </>
        ) : (
          <label>Invite code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required placeholder="6 characters" maxLength={6} className="code-input" /></label>
        )}
        {err && <p className="form-msg">{err}</p>}
        <button className="btn btn-lime btn-block" disabled={busy}>{busy ? 'Please wait…' : mode === 'create' ? 'Create crew' : 'Join crew'} <Icon name="chevron" size={16} /></button>
        <button type="button" className="btn btn-text" onClick={signOut}>Sign out</button>
      </form>
    </div>
  );
}
