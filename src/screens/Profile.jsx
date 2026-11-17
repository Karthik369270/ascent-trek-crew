import { useState } from 'react';
import { api } from '../lib/api/index.js';
import { useApp } from '../lib/hooks.js';
import { badges, mine, sumBetween } from '../lib/stats.js';
import { km1, metres } from '../lib/format.js';
import { Avatar, CardHead, Segmented } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

const COLORS = ['#CFE6D6', '#E6F46A', '#F2D3B3', '#C9D6F2', '#E8C6E0', '#BFE3E0', '#F4C7C0'];

export default function Profile() {
  const { profile, setProfile, group, setGroup, activities, pref, setPref, signOut, toast, isDemo } = useApp();
  const [form, setForm] = useState({ name: profile.name, target_km: profile.target_km, target_elev_m: profile.target_elev_m, target_minutes: profile.target_minutes });
  const [g, setG] = useState({ name: group.name, trek_date: group.trek_date || '', trek_name: group.trek_name, climb_goal_m: group.climb_goal_m });
  const [busy, setBusy] = useState(false);
  const all = sumBetween(mine(activities, profile.id), new Date(0));
  const b = badges(activities, profile.id);

  async function saveMe(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setProfile(await api.updateProfile(profile.id, {
        name: form.name.trim() || profile.name, target_km: Number(form.target_km) || 0, target_elev_m: Math.round(Number(form.target_elev_m) || 0), target_minutes: Math.round(Number(form.target_minutes) || 0),
      }));
      toast('Saved');
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  }

  async function saveGroup(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setGroup(await api.updateGroup(group.id, { name: g.name.trim() || group.name, trek_date: g.trek_date || null, trek_name: g.trek_name.trim() || group.trek_name, climb_goal_m: Math.max(1000, Math.round(Number(g.climb_goal_m) || 13200)) }));
      toast('Crew updated');
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  }

  async function patch(p) {
    try { setProfile(await api.updateProfile(profile.id, p)); } catch (err) { toast(err.message); }
  }

  return (
    <div className="bento">
      <section className="card mint span-4 me-card">
        <Avatar person={profile} size={72} />
        <h2>{profile.name}</h2>
        <p className="muted small">{group.name}</p>
        <div className="me-stats">
          <div><strong>{all.count}</strong><span>activities</span></div>
          <div><strong>{km1(all.distance_m)}</strong><span>km</span></div>
          <div><strong>{metres(all.elevation_gain_m)}</strong><span>m climbed</span></div>
        </div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={`swatch${profile.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => patch({ color: c })} aria-label="Pick avatar colour" />
          ))}
        </div>
      </section>

      <section className="card span-8">
        <CardHead title="Badges" sub={`${b.filter((x) => x.earned).length} of ${b.length} earned`} />
        <div className="badges">
          {b.map((x) => (
            <div key={x.id} className={`badge${x.earned ? ' on' : ''}`}>
              <span className="badge-icon"><Icon name={x.icon} size={22} /></span>
              <strong>{x.label}</strong>
              <span className="muted small">{x.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <form className="card span-6 form" onSubmit={saveMe}>
        <h3>Daily targets</h3>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <div className="form-grid three">
          <label>Distance (km)<input type="number" inputMode="decimal" step="0.5" min="0" value={form.target_km} onChange={(e) => setForm({ ...form, target_km: e.target.value })} /></label>
          <label>Climb (m)<input type="number" inputMode="numeric" min="0" value={form.target_elev_m} onChange={(e) => setForm({ ...form, target_elev_m: e.target.value })} /></label>
          <label>Active (min)<input type="number" inputMode="numeric" min="0" value={form.target_minutes} onChange={(e) => setForm({ ...form, target_minutes: e.target.value })} /></label>
        </div>
        <button className="btn btn-ink" disabled={busy}>Save targets</button>
      </form>

      <section className="card span-6 form">
        <h3>Appearance & privacy</h3>
        <label>Theme</label>
        <Segmented value={pref} onChange={setPref} options={[{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'system', label: 'Auto', icon: 'system' }]} />
        <label className="switch-row">
          <span className="grow"><strong>Share live location while recording</strong><span className="muted small">Your crew sees where you are only while you record an activity.</span></span>
          <input type="checkbox" className="switch" checked={profile.share_live} onChange={(e) => patch({ share_live: e.target.checked })} />
        </label>
        <button type="button" className="btn btn-ghost" onClick={signOut}><Icon name="logout" size={16} /> Sign out</button>
        {isDemo && (
          <button type="button" className="btn btn-text danger" onClick={async () => { await api.resetDemo(); location.reload(); }}>Reset demo data</button>
        )}
      </section>

      <form className="card span-12 form" onSubmit={saveGroup}>
        <h3>Crew settings</h3>
        <div className="form-grid">
          <label>Crew name<input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></label>
          <label>Trek start date<input type="date" value={g.trek_date} onChange={(e) => setG({ ...g, trek_date: e.target.value })} /></label>
          <label>Trek name<input value={g.trek_name} onChange={(e) => setG({ ...g, trek_name: e.target.value })} /></label>
          <label>Crew climb goal (m)<input type="number" min="1000" step="100" value={g.climb_goal_m} onChange={(e) => setG({ ...g, climb_goal_m: e.target.value })} />
            <span className="hint">One Chopta → Chandrashila climb is about 1,320 m. Default 13,200 m = 10 summits.</span>
          </label>
        </div>
        <div className="row-gap">
          <button className="btn btn-ink" disabled={busy}>Save crew</button>
          <span className="muted small">Invite code: <strong>{group.invite_code}</strong></span>
        </div>
      </form>
    </div>
  );
}
