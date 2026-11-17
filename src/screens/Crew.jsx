import { useState } from 'react';
import { useApp } from '../lib/hooks.js';
import { addDays, lastActive, leaderboard, METRICS, mine, readiness, startOfDay, startOfWeek, streak, weeklySeries } from '../lib/stats.js';
import { km1, metres, shareText, timeAgo } from '../lib/format.js';
import { Avatar, CardHead, Empty, Pill, Progress, Segmented } from '../components/bits.jsx';
import { Sparkbars } from '../components/Charts.jsx';
import Icon from '../components/Icon.jsx';
import RouteMap from '../components/RouteMap.jsx';

export default function Crew() {
  const [view, setView] = useState('board');
  return (
    <div className="crew">
      <Segmented value={view} onChange={setView} options={[
        { value: 'board', label: 'Leaderboard', icon: 'trophy' },
        { value: 'ready', label: 'Readiness', icon: 'target' },
        { value: 'live', label: 'Live map', icon: 'pin' },
      ]} />
      {view === 'board' && <Board />}
      {view === 'ready' && <Readiness />}
      {view === 'live' && <Live />}
      <Invite />
    </div>
  );
}

function fmtMetric(metric, v) {
  if (metric === 'distance') return `${v.toFixed(1)} km`;
  if (metric === 'elevation') return `${metres(v)} m`;
  return `${v} ${v === 1 ? 'day' : 'days'}`;
}

function Board() {
  const { activities, members, profile } = useApp();
  const [metric, setMetric] = useState('elevation');
  const [period, setPeriod] = useState('week');
  const from = period === 'week' ? startOfWeek() : addDays(startOfDay(), -29);
  const rows = leaderboard(activities, members, metric, from);
  const max = Math.max(1e-9, ...rows.map((r) => r.value));
  const seriesField = metric === 'distance' ? 'distance_m' : metric === 'elevation' ? 'elevation_gain_m' : 'days';

  return (
    <section className="card">
      <div className="board-controls">
        <Segmented small value={metric} onChange={setMetric} options={Object.entries(METRICS).map(([k, m]) => ({ value: k, label: m.label }))} />
        <Segmented small value={period} onChange={setPeriod} options={[{ value: 'week', label: 'This week' }, { value: 'month', label: '30 days' }]} />
      </div>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={r.member.id} className={`board-row${r.member.id === profile.id ? ' me' : ''}`}>
            <span className={`rank rank-${i + 1}`}>{i + 1}</span>
            <Avatar person={r.member} size={38} />
            <div className="grow">
              <div className="board-line">
                <strong>{r.member.name}{r.member.id === profile.id && <span className="muted"> (you)</span>}</strong>
                <span className="board-val">{fmtMetric(metric, r.value)}</span>
              </div>
              <Progress pct={r.value / max} tone={i === 0 ? 'lime' : 'ink'} />
            </div>
            <Sparkbars values={weeklySeries(activities, r.member.id, 6, seriesField).map((s) => s.value)} height={30} />
          </li>
        ))}
      </ol>
      <p className="muted small">Separate boards for climb, distance and consistency, so one strong runner can’t win everything.</p>
    </section>
  );
}

function Readiness() {
  const { activities, members } = useApp();
  const rows = members.map((m) => ({ m, r: readiness(activities, m.id), st: streak(activities, m.id), last: lastActive(activities, m.id) })).sort((a, b) => b.r.score - a.r.score);
  const avg = Math.round(rows.reduce((s, x) => s + x.r.score, 0) / Math.max(1, rows.length));
  return (
    <>
      <section className="card lime crew-ready-head">
        <div>
          <h3>Crew readiness</h3>
          <p className="small ink-2">Average across {members.length} people. 75+ means summit ready.</p>
        </div>
        <span className="big-num">{avg}<small>/100</small></span>
      </section>
      <div className="ready-grid">
        {rows.map(({ m, r, st, last }) => (
          <section key={m.id} className="card ready-card">
            <div className="ready-top">
              <Avatar person={m} size={42} />
              <div className="grow">
                <strong>{m.name}</strong>
                <span className="muted small">{last ? `Active ${timeAgo(last.toISOString())}` : 'No activity yet'} · <Icon name="flame" size={12} /> {st}</span>
              </div>
              <div className="ready-score">
                <span className="big-num sm">{r.score}</span>
                <Pill tone={r.score >= 75 ? 'lime' : r.score >= 45 ? 'mint' : 'warn'}>{r.label}</Pill>
              </div>
            </div>
            <ul className="ready-parts">
              {r.parts.map((p) => (
                <li key={p.key}>
                  <div className="rp-line"><span>{p.label}</span><span className="muted">{p.key === 'dist' ? p.value.toFixed(1) : Math.round(p.value)} / {p.target} {p.unit}</span></div>
                  <Progress pct={p.pct} tone={p.pct >= 1 ? 'lime' : 'ink'} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="muted small center">Score = weekly climbing (40) + longest outing (20) + biggest single climb (20) + active days (20), over the last 3 weeks.</p>
    </>
  );
}

function Live() {
  const { live, memberById, activities, profile } = useApp();
  const fresh = live.filter((l) => Date.now() - new Date(l.updated_at).getTime() < 3 * 3600e3);
  const people = fresh.map((l) => ({ ...memberById[l.user_id], lat: l.lat, lng: l.lng, label: `${memberById[l.user_id]?.name || '?'} · ${timeAgo(l.updated_at)}` })).filter((p) => p.id);
  const today = mine(activities, profile.id);
  return (
    <section className="card">
      <CardHead title="Where's everyone?" sub="Shows people who are recording right now (updated every 30 s)" right={<Pill tone={people.length ? 'lime' : 'plain'}>{people.length} live</Pill>} />
      {people.length ? (
        <>
          <div className="map-card"><RouteMap people={people} height={400} /></div>
          <ul className="list">
            {people.map((p) => (
              <li key={p.id} className="list-row">
                <Avatar person={p} size={32} />
                <div className="grow"><strong>{p.name}</strong><span className="muted small">{p.label.split(' · ')[1]}</span></div>
                <a className="pill pill-plain" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer"><Icon name="map" size={13} /> Open</a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty icon="pin" title="Nobody is recording right now">
          On trek day, everyone taps Record at Chopta, and you’ll all show up here. {today.length === 0 ? '' : 'Location is only shared while recording.'}
        </Empty>
      )}
    </section>
  );
}

function Invite() {
  const { group, toast } = useApp();
  const link = `${location.origin}/?join=${group.invite_code}`;
  async function copy() {
    try { await navigator.clipboard.writeText(group.invite_code); toast('Invite code copied'); } catch { toast(group.invite_code); }
  }
  return (
    <section className="card mint invite">
      <div className="grow">
        <h3>Invite your friends</h3>
        <p className="muted small">Share the link, or ask them to enter this code after signing up.</p>
      </div>
      <button className="code-chip" onClick={copy} title="Copy code">{group.invite_code} <Icon name="copy" size={15} /></button>
      <button className="btn btn-ink" onClick={() => shareText(`Join our trek crew "${group.name}" on Ascent. Code: ${group.invite_code}`, link)}><Icon name="share" size={16} /> Share link</button>
    </section>
  );
}
