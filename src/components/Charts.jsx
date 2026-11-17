import { useId } from 'react';
import { TREK } from '../lib/stats.js';
import { compact } from '../lib/format.js';

// Lollipop bars (like the reference "Indicators" card)
export function Lollipop({ data, height = 150, format = compact, labels }) {
  const W = 320, H = height, top = 34, bottom = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = W / data.length;
  const last = data.length - 1;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Weekly chart">
      {data.map((d, i) => {
        const x = step * i + step / 2;
        const y = H - bottom - ((H - top - bottom) * d.value) / max;
        const hi = i === last;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={H - bottom} y2={y} className={hi ? 'lp-line hi' : 'lp-line'} />
            <circle cx={x} cy={y} r={hi ? 6.5 : 5} className={hi ? 'lp-dot hi' : 'lp-dot'} />
            {hi && (
              <g transform={`translate(${Math.min(Math.max(x, 26), W - 26)} ${Math.max(y - 20, 12)})`}>
                <rect x="-24" y="-11" width="48" height="20" rx="10" className="lp-bubble" />
                <text y="3.5" textAnchor="middle" className="lp-bubble-text">{format(d.value)}</text>
              </g>
            )}
            {labels && <text x={x} y={H - 5} textAnchor="middle" className="axis-text">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Trek profile with the crew's progress on the current lap
export function MountainProfile({ lap = 0, height = 120, showLabels = true }) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = height, padT = 26, padB = 10;
  const maxKm = TREK.profile[TREK.profile.length - 1][0];
  const minA = 2550, maxA = 4050;
  const px = (k) => (k / maxKm) * (W - 24) + 12;
  const py = (a) => H - padB - ((a - minA) / (maxA - minA)) * (H - padT - padB);
  const pts = TREK.profile.map(([k, a]) => [px(k), py(a)]);
  // smooth path
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  const area = `${d} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;
  // marker position: lap is fraction of elevation gained, map it to km along profile
  const targetAlt = 2680 + lap * TREK.gain_m;
  let mk = 0;
  for (let i = 1; i < TREK.profile.length; i++) {
    const [k0, a0] = TREK.profile[i - 1], [k1, a1] = TREK.profile[i];
    if (targetAlt <= a1) { mk = k0 + ((targetAlt - a0) / (a1 - a0)) * (k1 - k0); break; }
    mk = k1;
  }
  const mx = px(mk), my = py(targetAlt);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trek elevation profile">
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--lime)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--lime)" stopOpacity=".15" />
        </linearGradient>
        <clipPath id={`c${id}`}><rect x="0" y="0" width={mx} height={H} /></clipPath>
      </defs>
      <path d={area} className="mp-area" />
      <path d={area} fill={`url(#g${id})`} clipPath={`url(#c${id})`} />
      <path d={d} className="mp-line" />
      {TREK.landmarks.map((l) => (
        <g key={l.name}>
          <circle cx={px(l.km)} cy={py(l.alt)} r="3.5" className="mp-landmark" />
          {showLabels && (
            <text x={px(l.km)} y={py(l.alt) - 9} textAnchor={l.km === 0 ? 'start' : l.km === maxKm ? 'end' : 'middle'} className="axis-text strong">
              {l.name}
            </text>
          )}
        </g>
      ))}
      <line x1={mx} x2={mx} y1={my} y2={H} className="mp-marker-line" />
      <circle cx={mx} cy={my} r="7" className="mp-marker" />
      <circle cx={mx} cy={my} r="2.5" className="mp-marker-core" />
    </svg>
  );
}

// Vertical pill slider (like the reference "Wow, Great!" card)
export function VPill({ value, target, label, unit, format = (v) => Math.round(v) }) {
  const pct = target ? Math.min(1, value / target) : 0;
  const done = pct >= 1;
  return (
    <div className={`vpill${done ? ' done' : ''}`}>
      <span className="vpill-value">{format(value)}<small>/{format(target)}</small></span>
      <div className="vpill-track">
        <div className="vpill-fill" style={{ height: `${Math.max(pct * 100, 14)}%` }}>
          <span className="vpill-knob" />
        </div>
      </div>
      <span className="vpill-label">{label}<small>{unit}</small></span>
    </div>
  );
}

// Thin bars for leaderboard-style comparisons
export function Sparkbars({ values, height = 36 }) {
  const max = Math.max(1, ...values);
  return (
    <div className="sparkbars" style={{ height }}>
      {values.map((v, i) => <span key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} className={i === values.length - 1 ? 'hi' : ''} />)}
    </div>
  );
}

// Tiny route thumbnail drawn as SVG (no map tiles needed)
export function MiniRoute({ route, height = 90 }) {
  if (!route || route.length < 2) return null;
  const lats = route.map((p) => p[0]), lngs = route.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = Math.max((maxLng - minLng) * k, 1e-6), h = Math.max(maxLat - minLat, 1e-6);
  const W = 200, H = 100, pad = 10;
  const s = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const pts = route.map(([la, ln]) => `${(ox + (ln - minLng) * k * s).toFixed(1)},${(oy + (maxLat - la) * s).toFixed(1)}`);
  const [sx, sy] = pts[0].split(','), [ex, ey] = pts[pts.length - 1].split(',');
  return (
    <svg className="mini-route" viewBox={`0 0 ${W} ${H}`} style={{ height }} aria-hidden="true">
      <polyline points={pts.join(' ')} className="mr-shadow" />
      <polyline points={pts.join(' ')} className="mr-line" />
      <circle cx={sx} cy={sy} r="4" className="mr-start" />
      <circle cx={ex} cy={ey} r="4" className="mr-end" />
    </svg>
  );
}
