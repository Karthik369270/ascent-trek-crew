import { useEffect, useRef, useState, createContext, useContext } from 'react';
import { GpsTracker, MAX_SPEED_CYCLE_MS } from './geo.js';
import { api } from './api/index.js';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ── Theme: light / dark / follow system ─────────────────────
export function useTheme() {
  const [pref, setPrefState] = useState(() => { try { return localStorage.getItem('ascent-theme') || 'system'; } catch { return 'system'; } });
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = (e) => setSysDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const theme = pref === 'system' ? (sysDark ? 'dark' : 'light') : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E100E' : '#ECEEEA');
  }, [theme]);
  const setPref = (p) => { try { localStorage.setItem('ascent-theme', p); } catch { /* ignore */ } setPrefState(p); };
  return { pref, theme, setPref };
}

// ── Keep the screen on while recording ──────────────────────
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock = null;
    const request = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed */ } };
    request();
    const onVis = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}); };
  }, [active]);
}

const RECOVERY_KEY = 'ascent-recording';

export function readRecovery() {
  try { return JSON.parse(localStorage.getItem(RECOVERY_KEY) || 'null'); } catch { return null; }
}
export function clearRecovery() {
  try { localStorage.removeItem(RECOVERY_KEY); } catch { /* ignore */ }
}

// ── GPS recording that survives tab switches inside the app ─
export function useTrackerController(profile, group) {
  const ref = useRef(null);
  const [state, setState] = useState(null);
  const [type, setType] = useState('walk');
  if (!ref.current) ref.current = new GpsTracker(setState);
  const t = ref.current;
  const status = state?.status ?? 'idle';
  // Cycling is faster, so allow bigger jumps between GPS fixes before treating them as glitches
  useEffect(() => { t.maxSpeed = type === 'cycle' ? MAX_SPEED_CYCLE_MS : 12; }, [type, t]);
  const [, tick] = useState(0);

  useEffect(() => {
    if (status !== 'tracking') return;
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Share last known position with the crew while recording (for trek day)
  useEffect(() => {
    if (!profile || !group || status !== 'tracking' || !profile.share_live) return;
    const push = () => { const p = t.position; if (p) api.pushLiveLocation(profile.id, group.id, p.lat, p.lng).catch(() => {}); };
    const first = setTimeout(push, 3000);
    const id = setInterval(push, 30000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [status, profile?.share_live, profile?.id, group?.id, t]);

  // Save a recovery copy every few seconds in case the phone kills the tab
  useEffect(() => {
    if (status === 'idle') return;
    const save = () => {
      try {
        localStorage.setItem(RECOVERY_KEY, JSON.stringify({
          type, started_at: t.startedAt?.toISOString(), duration_s: Math.round(t.elapsed), distance_m: Math.round(t.distance),
          elevation_gain_m: Math.round(t.gain), route: t.points.length > 1 ? t.points.slice(-1500) : null, saved_at: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
    };
    save();
    const id = setInterval(save, 5000);
    return () => clearInterval(id);
  }, [status, type, t]);

  // Warn before closing the tab mid-activity
  useEffect(() => {
    if (status === 'idle') return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [status]);

  useWakeLock(status === 'tracking' || status === 'paused');

  const snap = state ?? t.snapshot();
  return {
    ...snap,
    elapsed_s: t.elapsed,
    type,
    setType,
    warmUp: () => t.warmUp(),
    stopWatching: () => { if (t.status === 'idle') t.unwatch(); },
    start: () => t.start(),
    pause: () => t.pause(),
    resume: () => t.resume(),
    finish: () => {
      const s = t.finish();
      clearRecovery();
      if (profile) api.clearLiveLocation(profile.id).catch(() => {});
      return { ...s, type };
    },
    discard: () => {
      t.discard();
      clearRecovery();
      if (profile) api.clearLiveLocation(profile.id).catch(() => {});
    },
  };
}
