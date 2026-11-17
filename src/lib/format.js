const pad = (n) => String(n).padStart(2, '0');

export const km = (m) => {
  const v = (m || 0) / 1000;
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
};
export const km1 = (m) => ((m || 0) / 1000).toFixed(1);
export const metres = (m) => Math.round(m || 0).toLocaleString('en-IN');
export const compact = (n) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

export function duration(s) {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function durationShort(s) {
  const m = Math.round((s || 0) / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

// Cycling reads better as km/h; everything on foot as min/km
export function paceOrSpeed(type, distM, durS) {
  if (type !== 'cycle') return { label: 'Pace', value: pace(distM, durS), unit: 'min / km' };
  if (!distM || distM < 100 || !durS) return { label: 'Speed', value: '–', unit: 'km/h' };
  return { label: 'Speed', value: (distM / 1000 / (durS / 3600)).toFixed(1), unit: 'km/h' };
}

export function pace(distM, durS) {
  if (!distM || distM < 100 || !durS) return '–';
  const total = Math.round(durS / (distM / 1000));
  if (total > 3600) return '–';
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function dateLabel(d, opts = { day: 'numeric', month: 'short' }) {
  return new Date(d).toLocaleDateString('en-IN', opts);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const TYPES = {
  walk: { label: 'Walk', icon: 'walk' },
  run: { label: 'Run', icon: 'bolt' },
  hike: { label: 'Hike', icon: 'mountain' },
  stairs: { label: 'Stairs', icon: 'stairs' },
  incline: { label: 'Incline', icon: 'incline' },
  cycle: { label: 'Cycling', icon: 'bike' },
  other: { label: 'Workout', icon: 'clock' },
};

export function initials(name = '?') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export function shareText(text, url) {
  if (navigator.share) return navigator.share({ text, url }).catch(() => {});
  const full = url ? `${text} ${url}` : text;
  window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, '_blank', 'noopener');
}
