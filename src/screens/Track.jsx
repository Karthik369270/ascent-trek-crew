import { useEffect, useState } from 'react';
import { api } from '../lib/api/index.js';
import { clearRecovery, readRecovery, useApp } from '../lib/hooks.js';
import { duration, km, metres, pace, timeAgo, TYPES } from '../lib/format.js';
import { Segmented, Sheet } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import RouteMap from '../components/RouteMap.jsx';

const GPS_TYPES = ['walk', 'run', 'hike'];

function defaultTitle(type, d = new Date()) {
  const h = d.getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  return `${part} ${TYPES[type].label.toLowerCase()}`;
}

function localInputValue(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 16);
}

export default function Track() {
  const { tracker: t } = useApp();
  const [mode, setMode] = useState('gps');
  const recording = t.status !== 'idle';
  return (
    <div className="track">
      {!recording && (
        <Segmented value={mode} onChange={setMode} options={[{ value: 'gps', label: 'Record with GPS', icon: 'locate' }, { value: 'manual', label: 'Log manually', icon: 'edit' }]} />
      )}
      {mode === 'gps' || recording ? <GpsRecorder /> : <ManualLog />}
    </div>
  );
}

function GpsRecorder() {
  const { tracker: t, profile, group, toast, go, refresh } = useApp();
  const [summary, setSummary] = useState(null);
  const [recovery, setRecovery] = useState(() => (t.status === 'idle' ? readRecovery() : null));

  useEffect(() => {
    t.warmUp();
    return () => t.stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => setSummary(t.finish());

  const gpsState = t.error
    ? { tone: 'warn', text: t.error }
    : t.accuracy == null
      ? { tone: 'muted', text: 'Finding your location…' }
      : t.accuracy > 35
        ? { tone: 'warn', text: `Weak GPS (±${Math.round(t.accuracy)} m). Waiting for a better fix before counting distance.` }
        : { tone: 'ok', text: `GPS good (±${Math.round(t.accuracy)} m)${t.status !== 'idle' && !t.altSeen ? ' · no altitude from this phone yet' : ''}` };

  return (
    <div className="bento">
      {recovery && (
        <section className="card span-12 recovery">
          <Icon name="info" />
          <div className="grow">
            <strong>Unsaved recording found</strong>
            <span className="muted small">{TYPES[recovery.type]?.label} · {km(recovery.distance_m)} km · {duration(recovery.duration_s)} · saved {timeAgo(recovery.saved_at)}</span>
          </div>
          <button className="btn btn-ink btn-sm" onClick={() => { setSummary({ ...recovery, altSeen: true }); setRecovery(null); }}>Save it</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { clearRecovery(); setRecovery(null); }}>Discard</button>
        </section>
      )}

      <section className="card span-7 map-card">
        <RouteMap points={t.points} position={t.position} follow={t.status === 'tracking'} height={380} />
        <div className={`gps-status ${gpsState.tone}`}><span className="dot" />{gpsState.text}</div>
      </section>

      <section className="card span-5 rec-panel">
        {t.status === 'idle' && (
          <div className="type-chips">
            {GPS_TYPES.map((ty) => (
              <button key={ty} className={`type-chip${t.type === ty ? ' on' : ''}`} onClick={() => t.setType(ty)}>
                <Icon name={TYPES[ty].icon} size={18} />{TYPES[ty].label}
              </button>
            ))}
          </div>
        )}
        {t.status !== 'idle' && (
          <div className="rec-state">
            <span className={`rec-dot${t.status === 'paused' ? ' paused' : ''}`} />
            {t.status === 'paused' ? 'Paused' : `Recording ${TYPES[t.type].label.toLowerCase()}`}
          </div>
        )}
        <div className="rec-time">{duration(t.elapsed_s)}</div>
        <div className="rec-stats">
          <div><span className="rec-val">{km(t.distance_m)}</span><span className="muted small">km</span></div>
          <div><span className="rec-val">{metres(t.elevation_gain_m)}</span><span className="muted small">m climbed</span></div>
          <div><span className="rec-val">{pace(t.distance_m, t.elapsed_s)}</span><span className="muted small">min / km</span></div>
        </div>

        <div className="rec-controls">
          {t.status === 'idle' && (
            <button className="big-btn lime" onClick={() => t.start()} aria-label="Start recording"><Icon name="play" size={34} /></button>
          )}
          {t.status === 'tracking' && (
            <>
              <button className="big-btn ghost" onClick={() => t.pause()} aria-label="Pause"><Icon name="pause" size={28} /></button>
              <button className="big-btn ink" onClick={finish} aria-label="Finish"><Icon name="stop" size={26} /></button>
            </>
          )}
          {t.status === 'paused' && (
            <>
              <button className="big-btn lime" onClick={() => t.resume()} aria-label="Resume"><Icon name="play" size={30} /></button>
              <button className="big-btn ink" onClick={finish} aria-label="Finish"><Icon name="stop" size={26} /></button>
            </>
          )}
        </div>
        <p className="muted small center">
          {t.status === 'idle'
            ? 'Keep this screen open while you move. The app keeps your screen awake while recording.'
            : profile.share_live ? 'Your crew can see your live position while you record.' : 'Live location sharing is off.'}
        </p>
        {t.status === 'paused' && <button className="btn btn-text danger" onClick={() => { if (confirm('Discard this recording?')) t.discard(); }}>Discard recording</button>}
      </section>

      <SaveSheet
        summary={summary}
        onClose={() => setSummary(null)}
        onSaved={async () => { setSummary(null); await refresh(); toast('Activity saved 🎉'); go('feed'); }}
        profile={profile}
        group={group}
      />
    </div>
  );
}

function SaveSheet({ summary, onClose, onSaved, profile, group }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [elev, setElev] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (summary) {
      setTitle(defaultTitle(summary.type || 'walk', new Date(summary.started_at)));
      setNote('');
      setElev(summary.elevation_gain_m || 0);
    }
  }, [summary]);

  if (!summary) return null;

  async function save() {
    setBusy(true);
    try {
      await api.addActivity({
        user_id: profile.id, group_id: group.id, type: summary.type || 'walk', title: title.trim() || null, note: note.trim() || null,
        started_at: summary.started_at, duration_s: summary.duration_s, distance_m: summary.distance_m,
        elevation_gain_m: Math.max(0, Number(elev) || 0), route: summary.route, source: 'gps',
      });
      clearRecovery();
      await onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open title="Save activity" onClose={onClose}>
      <div className="save-stats">
        <div><strong>{km(summary.distance_m)}</strong><span>km</span></div>
        <div><strong>{duration(summary.duration_s)}</strong><span>time</span></div>
        <div><strong>{pace(summary.distance_m, summary.duration_s)}</strong><span>/km</span></div>
      </div>
      <div className="form">
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></label>
        <label>
          Elevation gained (m)
          <input type="number" inputMode="numeric" min="0" value={elev} onChange={(e) => setElev(e.target.value)} />
          {!summary.altSeen && <span className="hint">Your phone didn’t report altitude. Add your climb here if you know it.</span>}
        </label>
        <label>Note<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="How did it feel?" /></label>
        <button className="btn btn-lime btn-block" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save to feed'}</button>
        <button className="btn btn-text danger" onClick={() => { if (confirm('Throw this activity away?')) { clearRecovery(); onClose(); } }}>Discard</button>
      </div>
    </Sheet>
  );
}

function ManualLog() {
  const { profile, group, toast, go, refresh } = useApp();
  const [type, setType] = useState('stairs');
  const [when, setWhen] = useState(localInputValue());
  const [minutes, setMinutes] = useState(20);
  const [floors, setFloors] = useState(30);
  const [dist, setDist] = useState(3);
  const [incline, setIncline] = useState(8);
  const [elev, setElev] = useState(0);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const FLOOR_M = 3;
  const computed = type === 'stairs' ? Number(floors) * FLOOR_M
    : type === 'incline' ? Math.round(Number(dist) * 1000 * (Number(incline) / 100))
      : Number(elev);
  const distance = type === 'stairs' ? 0 : Math.round(Number(dist) * 1000);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.addActivity({
        user_id: profile.id, group_id: group.id, type, title: title.trim() || defaultTitle(type, new Date(when)), note: null,
        started_at: new Date(when).toISOString(), duration_s: Math.round(Number(minutes) * 60), distance_m: Math.max(0, distance),
        elevation_gain_m: Math.max(0, computed || 0), route: null, source: 'manual',
      });
      await refresh();
      toast('Logged 💪');
      go('feed');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bento">
      <form className="card span-7 form" onSubmit={save}>
        <h3>What did you do?</h3>
        <div className="type-chips wrap">
          {['stairs', 'incline', 'walk', 'run', 'hike', 'other'].map((ty) => (
            <button type="button" key={ty} className={`type-chip${type === ty ? ' on' : ''}`} onClick={() => setType(ty)}>
              <Icon name={TYPES[ty].icon} size={18} />{TYPES[ty].label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>When<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required max={localInputValue()} /></label>
          <label>Duration (min)<input type="number" inputMode="numeric" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} required /></label>
          {type === 'stairs' && (
            <label>Floors climbed<input type="number" inputMode="numeric" min="1" value={floors} onChange={(e) => setFloors(e.target.value)} required />
              <span className="hint">Counted as about {FLOOR_M} m per floor. Going up and down 10 floors 5 times = 50 floors.</span>
            </label>
          )}
          {type !== 'stairs' && (
            <label>Distance (km)<input type="number" inputMode="decimal" step="0.1" min="0" value={dist} onChange={(e) => setDist(e.target.value)} /></label>
          )}
          {type === 'incline' && (
            <label>Incline (%)<input type="number" inputMode="decimal" step="0.5" min="0" max="40" value={incline} onChange={(e) => setIncline(e.target.value)} /></label>
          )}
          {!['stairs', 'incline'].includes(type) && (
            <label>Elevation gained (m)<input type="number" inputMode="numeric" min="0" value={elev} onChange={(e) => setElev(e.target.value)} /></label>
          )}
          <label className="span-all">Title (optional)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle(type, new Date(when))} maxLength={60} /></label>
        </div>
        <button className="btn btn-lime btn-block" disabled={busy}>{busy ? 'Saving…' : 'Log activity'}</button>
      </form>
      <section className="card lime span-5 manual-summary">
        <h3>This counts as</h3>
        <div className="ms-row"><span className="big-num">{metres(computed || 0)}<small> m</small></span><span className="small ink-2">climbed</span></div>
        <div className="ms-row"><span className="big-num">{km(distance)}<small> km</small></span><span className="small ink-2">distance</span></div>
        <div className="ms-row"><span className="big-num">{Math.round(minutes || 0)}<small> min</small></span><span className="small ink-2">active</span></div>
        <p className="small ink-2">Chandrashila is about 1,320 m above Chopta. That’s roughly {Math.round(1320 / FLOOR_M)} floors of stairs.</p>
      </section>
    </div>
  );
}
