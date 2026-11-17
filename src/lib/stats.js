// All the fitness maths: totals, streaks, readiness, leaderboards, badges, plan, crew climb.
// Thresholds are tuned for the Chopta → Tungnath → Chandrashila trek; tweak them here.

const DAY = 864e5;

// Trek facts (approximate)
export const TREK = {
  gain_m: 1320, // Chopta ~2,680 m → Chandrashila ~4,000 m
  profile: [
    // [km from Chopta, altitude m]
    [0, 2680], [0.8, 2800], [1.6, 3010], [2.4, 3260], [3.0, 3480], [3.5, 3680], [4.0, 3790], [4.5, 3900], [5.0, 4000],
  ],
  landmarks: [
    { name: 'Chopta', km: 0, alt: 2680 },
    { name: 'Tungnath', km: 3.5, alt: 3680 },
    { name: 'Chandrashila', km: 5.0, alt: 4000 },
  ],
};

export const READINESS_TARGETS = {
  weeklyElev: 1000, // m climbed per week (avg of last 3 weeks)
  longestKm: 10,    // longest single outing
  biggestClimb: 400,// biggest single-session climb (m)
  activeDays: 12,   // active days in the last 21
};

export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};
export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7)); // Monday
}

export const mine = (acts, uid) => acts.filter((a) => a.user_id === uid);

// Kilometres that count toward distance targets, the distance board, "longest outing" and km badges.
// Cycling still counts for climb, minutes, active days and streaks, but a 10 km ride isn't a 10 km walk.
// To count cycling distance too, empty this list.
export const DISTANCE_EXCLUDES = ['cycle'];
export const footDistance = (a) => (DISTANCE_EXCLUDES.includes(a.type) ? 0 : a.distance_m || 0);

export function sumBetween(acts, from, to = new Date(8.64e15)) {
  const out = { distance_m: 0, elevation_gain_m: 0, minutes: 0, count: 0, days: 0 };
  const days = new Set();
  for (const a of acts) {
    const t = new Date(a.started_at);
    if (t >= from && t < to) {
      out.distance_m += footDistance(a);
      out.elevation_gain_m += a.elevation_gain_m || 0;
      out.minutes += (a.duration_s || 0) / 60;
      out.count++;
      days.add(dayKey(t));
    }
  }
  out.days = days.size;
  return out;
}

export function todayTotals(acts, uid) {
  const s = startOfDay();
  return sumBetween(mine(acts, uid), s, addDays(s, 1));
}

const daySet = (acts) => new Set(acts.map((a) => dayKey(a.started_at)));

export function streak(acts, uid) {
  const set = daySet(mine(acts, uid));
  let d = startOfDay();
  if (!set.has(dayKey(d))) d = addDays(d, -1); // today not logged yet doesn't break the streak
  let n = 0;
  while (set.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

export function bestStreak(acts) {
  const keys = [...daySet(acts)].map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }).sort((a, b) => a - b);
  let best = 0, cur = 0, prev = null;
  for (const t of keys) {
    cur = prev != null && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

export function weekDays(acts, uid) {
  const ws = startOfWeek();
  const my = mine(acts, uid);
  const todayK = dayKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const tot = sumBetween(my, d, addDays(d, 1));
    return { date: d, active: tot.count > 0, km: tot.distance_m / 1000, elev: tot.elevation_gain_m, isToday: dayKey(d) === todayK, future: d > new Date() && dayKey(d) !== todayK };
  });
}

export function weeklySeries(acts, uid, weeks = 8, field = 'elevation_gain_m') {
  const ws = startOfWeek();
  const my = uid ? mine(acts, uid) : acts;
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(ws, -7 * i);
    out.push({ from, value: sumBetween(my, from, addDays(from, 7))[field] });
  }
  return out;
}

export function readiness(acts, uid, now = new Date()) {
  const from = addDays(startOfDay(now), -20);
  const recent = mine(acts, uid).filter((a) => new Date(a.started_at) >= from);
  const T = READINESS_TARGETS;
  const total = recent.reduce((s, a) => s + (a.elevation_gain_m || 0), 0);
  const parts = [
    { key: 'elev', label: 'Weekly climbing', value: total / 3, target: T.weeklyElev, unit: 'm / week', weight: 40 },
    { key: 'dist', label: 'Longest outing', value: Math.max(0, ...recent.map((a) => footDistance(a) / 1000)), target: T.longestKm, unit: 'km', weight: 20 },
    { key: 'climb', label: 'Biggest single climb', value: Math.max(0, ...recent.map((a) => a.elevation_gain_m || 0)), target: T.biggestClimb, unit: 'm', weight: 20 },
    { key: 'days', label: 'Active days (3 weeks)', value: daySet(recent).size, target: T.activeDays, unit: 'days', weight: 20 },
  ];
  parts.forEach((p) => { p.pct = Math.min(1, p.value / p.target); p.points = p.pct * p.weight; });
  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  const label = score >= 75 ? 'Summit ready' : score >= 45 ? 'Getting there' : 'Needs work';
  const weakest = [...parts].sort((a, b) => a.pct - b.pct)[0];
  return { score, label, parts, weakest };
}

export const METRICS = {
  elevation: { label: 'Climb', unit: 'm', get: (t) => t.elevation_gain_m },
  distance: { label: 'Distance', unit: 'km', get: (t) => t.distance_m / 1000 },
  days: { label: 'Active days', unit: 'days', get: (t) => t.days },
};

export function leaderboard(acts, members, metric = 'elevation', from = startOfWeek()) {
  const m = METRICS[metric];
  return members
    .map((member) => ({ member, value: m.get(sumBetween(mine(acts, member.id), from)) }))
    .sort((a, b) => b.value - a.value);
}

export function lastActive(acts, uid) {
  const a = acts.find((x) => x.user_id === uid); // acts are newest-first
  return a ? new Date(a.started_at) : null;
}

export function inactiveMembers(members, acts, days = 3, exceptId) {
  const cutoff = Date.now() - days * DAY;
  return members
    .filter((m) => m.id !== exceptId)
    .map((m) => ({ member: m, last: lastActive(acts, m.id) }))
    .filter((x) => !x.last || x.last.getTime() < cutoff)
    .map((x) => ({ ...x, daysSince: x.last ? Math.floor((Date.now() - x.last.getTime()) / DAY) : null }));
}

export function groupClimb(acts, goal = 13200) {
  const total = acts.reduce((s, a) => s + (a.elevation_gain_m || 0), 0);
  const summits = total / TREK.gain_m;
  return { total, goal, summits, lap: summits % 1, fullSummits: Math.floor(summits), pct: Math.min(1, total / goal) };
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - startOfDay()) / DAY);
}

export const BADGES = [
  { id: 'first', label: 'First steps', desc: 'Log your first activity', icon: 'walk', test: (s) => s.count >= 1 },
  { id: 'ten', label: 'Double digits', desc: '10 km in one go', icon: 'route', test: (s) => s.longest >= 10000 },
  { id: 'vweek', label: 'Vertical week', desc: '1,000 m climbed in a week', icon: 'stairs', test: (s) => s.bestWeekElev >= 1000 },
  { id: 'streak7', label: 'Seven straight', desc: '7-day streak', icon: 'flame', test: (s) => s.bestStreak >= 7 },
  { id: 'early', label: 'Early riser', desc: 'Start before 6 AM', icon: 'sun', test: (s) => s.early },
  { id: 'fifty', label: 'Fifty club', desc: '50 km total', icon: 'trophy', test: (s) => s.totalKm >= 50 },
  { id: 'half', label: 'Half Everest', desc: '4,425 m climbed in total', icon: 'mountain', test: (s) => s.totalElev >= 4425 },
  { id: 'summit', label: 'Chandrashila in one go', desc: '1,320 m in a single session', icon: 'target', test: (s) => s.biggestClimb >= TREK.gain_m },
];

export function badges(acts, uid) {
  const my = mine(acts, uid);
  const weeks = {};
  my.forEach((a) => { const k = startOfWeek(new Date(a.started_at)).getTime(); weeks[k] = (weeks[k] || 0) + (a.elevation_gain_m || 0); });
  const s = {
    count: my.length,
    longest: Math.max(0, ...my.map(footDistance)),
    biggestClimb: Math.max(0, ...my.map((a) => a.elevation_gain_m || 0)),
    bestWeekElev: Math.max(0, ...Object.values(weeks)),
    bestStreak: bestStreak(my),
    early: my.some((a) => new Date(a.started_at).getHours() < 6),
    totalKm: my.reduce((t, a) => t + footDistance(a), 0) / 1000,
    totalElev: my.reduce((t, a) => t + (a.elevation_gain_m || 0), 0),
  };
  return BADGES.map((b) => ({ ...b, earned: b.test(s) }));
}

// 4-week build-up that ends the day before the trek
export const PLAN = [
  { title: 'Build the base', focus: 'Easy walks most days. Find a staircase you can use.', days: 3, km: 12, elev: 300, key: 'One 5 km walk' },
  { title: 'Add the climb', focus: 'Stairs twice a week. Keep a steady pace, nose-breathing if you can.', days: 4, km: 18, elev: 600, key: 'One 7 km walk' },
  { title: 'Peak week', focus: 'Your longest walk, with a loaded day-pack (5–6 kg).', days: 4, km: 24, elev: 900, key: 'One 9–10 km walk with backpack' },
  { title: 'Taper & pack', focus: 'Back off. Short easy walks, good sleep, finish packing.', days: 3, km: 12, elev: 300, key: 'Nothing hard — stay fresh' },
];

export function weeklyPlan(trekDate, acts, uid) {
  if (!trekDate) return [];
  const [y, m, d] = trekDate.split('-').map(Number);
  const trek = new Date(y, m - 1, d);
  const today = startOfDay();
  const my = mine(acts, uid);
  return PLAN.map((p, i) => {
    const from = addDays(trek, -7 * (4 - i));
    const to = addDays(from, 7);
    const done = sumBetween(my, from, to);
    const status = today >= to ? 'past' : today >= from ? 'current' : 'upcoming';
    const progress = (Math.min(1, done.days / p.days) + Math.min(1, done.distance_m / 1000 / p.km) + Math.min(1, done.elevation_gain_m / p.elev)) / 3;
    return { ...p, index: i, from, to: addDays(to, -1), done, status, progress };
  });
}

// Local calendar date as YYYY-MM-DD (toISOString would shift to UTC)
export function isoDate(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
