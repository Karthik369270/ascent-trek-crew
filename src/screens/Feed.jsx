import { useEffect, useState } from 'react';
import { api } from '../lib/api/index.js';
import { useApp } from '../lib/hooks.js';
import { dateLabel, duration, km, metres, paceOrSpeed, timeAgo, TYPES } from '../lib/format.js';
import { MiniRoute } from '../components/Charts.jsx';
import { Avatar, Empty, Segmented } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import RouteMap from '../components/RouteMap.jsx';

export default function Feed() {
  const { activities, profile, go } = useApp();
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(20);
  const list = (filter === 'mine' ? activities.filter((a) => a.user_id === profile.id) : activities).slice(0, limit);

  // group by day label
  const groups = [];
  list.forEach((a) => {
    const label = dayLabel(a.started_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  });

  return (
    <div className="feed">
      <div className="feed-bar">
        <Segmented small value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Everyone' }, { value: 'mine', label: 'Just me' }]} />
        <button className="btn btn-lime btn-sm" onClick={() => go('track')}><Icon name="plus" size={16} /> Add</button>
      </div>
      {list.length === 0 && (
        <div className="card"><Empty icon="walk" title="Nothing here yet">Record a walk or log a stair session and it shows up here for the crew.</Empty></div>
      )}
      {groups.map((g) => (
        <div key={g.label} className="feed-day">
          <h4 className="feed-day-label">{g.label}</h4>
          {g.items.map((a) => <ActivityCard key={a.id} a={a} />)}
        </div>
      ))}
      {activities.length > limit && filter === 'all' && (
        <button className="btn btn-ghost btn-block" onClick={() => setLimit((l) => l + 20)}>Show more</button>
      )}
    </div>
  );
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return dateLabel(iso, { weekday: 'long', day: 'numeric', month: 'short' });
}

function ActivityCard({ a }) {
  const { memberById, profile, refresh, toast } = useApp();
  const who = memberById[a.user_id];
  const mineAct = a.user_id === profile.id;
  const hasKudos = a.kudos?.includes(profile.id);
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [optimistic, setOptimistic] = useState(null);
  const kudosCount = (a.kudos?.length || 0) + (optimistic === null ? 0 : optimistic ? 1 : -1);
  const kudosOn = optimistic === null ? hasKudos : optimistic;

  useEffect(() => { setOptimistic(null); }, [a.kudos]);

  async function kudos() {
    if (mineAct) return;
    setOptimistic(!kudosOn);
    try { await api.toggleKudos(a.id, profile.id, kudosOn); await refresh(); } catch (e) { setOptimistic(null); toast(e.message); }
  }

  async function remove() {
    if (!confirm('Delete this activity?')) return;
    try { await api.deleteActivity(a.id); await refresh(); toast('Deleted'); } catch (e) { toast(e.message); }
  }

  const kudosNames = (a.kudos || []).map((id) => memberById[id]?.name).filter(Boolean);

  return (
    <article className="card activity">
      <header className="act-head">
        <Avatar person={who} size={40} />
        <div className="grow">
          <strong>{who?.name || 'Someone'}</strong>
          <span className="muted small">{new Date(a.started_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {timeAgo(a.started_at)}</span>
        </div>
        <span className="pill pill-plain"><Icon name={TYPES[a.type]?.icon || 'clock'} size={14} /> {TYPES[a.type]?.label}</span>
        {mineAct && <button className="icon-btn" onClick={remove} aria-label="Delete"><Icon name="trash" size={18} /></button>}
      </header>
      {a.title && <h3 className="act-title">{a.title}</h3>}
      {a.note && <p className="act-note">{a.note}</p>}
      <div className="act-stats">
        {a.distance_m > 0 && <div><span>Distance</span><strong>{km(a.distance_m)} km</strong></div>}
        <div><span>Climb</span><strong>{metres(a.elevation_gain_m)} m</strong></div>
        <div><span>Time</span><strong>{duration(a.duration_s)}</strong></div>
        {a.distance_m > 0 && (() => { const p = paceOrSpeed(a.type, a.distance_m, a.duration_s); return <div><span>{p.label}</span><strong>{p.value}{a.type === 'cycle' && p.value !== '–' ? ' km/h' : ''}</strong></div>; })()}
      </div>
      {a.route && (
        showMap
          ? <div className="act-map"><RouteMap points={a.route} height={240} /></div>
          : <button className="act-route" onClick={() => setShowMap(true)} aria-label="Show map"><MiniRoute route={a.route} height={110} /><span className="pill pill-glass"><Icon name="map" size={13} /> Map</span></button>
      )}
      <footer className="act-foot">
        <button className={`act-btn${kudosOn ? ' on' : ''}`} onClick={kudos} disabled={mineAct} title={mineAct ? 'Your activity' : 'Give kudos'}>
          <Icon name={kudosOn ? 'heartFill' : 'heart'} size={18} /> {kudosCount || ''}
        </button>
        <button className="act-btn" onClick={() => setOpen((o) => !o)}>
          <Icon name="comment" size={18} /> {a.comment_count || ''}
        </button>
        {kudosNames.length > 0 && <span className="muted small kudos-names">{kudosNames.slice(0, 3).join(', ')}{kudosNames.length > 3 ? ` +${kudosNames.length - 3}` : ''}</span>}
      </footer>
      {open && <Comments activityId={a.id} />}
    </article>
  );
}

function Comments({ activityId }) {
  const { memberById, profile, refresh, toast } = useApp();
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');

  const load = () => api.getComments(activityId).then(setItems).catch((e) => toast(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activityId]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    try { await api.addComment(activityId, profile.id, body); await load(); refresh(); } catch (err) { toast(err.message); }
  }

  return (
    <div className="comments">
      {items === null ? <p className="muted small">Loading…</p> : items.length === 0 ? <p className="muted small">No comments yet.</p> : (
        items.map((c) => (
          <div key={c.id} className="comment">
            <Avatar person={memberById[c.user_id]} size={26} />
            <div><strong>{memberById[c.user_id]?.name || 'Someone'}</strong> {c.body}<span className="muted small"> · {timeAgo(c.created_at)}</span></div>
          </div>
        ))
      )}
      <form className="comment-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something nice…" maxLength={500} />
        <button className="icon-btn lime" aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
    </div>
  );
}
