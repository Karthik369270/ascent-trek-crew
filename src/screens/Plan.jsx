import { useState } from 'react';
import { api } from '../lib/api/index.js';
import { useApp } from '../lib/hooks.js';
import { daysUntil, weeklyPlan } from '../lib/stats.js';
import { dateLabel, km1, metres } from '../lib/format.js';
import { AvatarStack, CardHead, Empty, Progress } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

export default function Plan() {
  const { group, activities, profile, go } = useApp();
  const weeks = weeklyPlan(group.trek_date, activities, profile.id);
  const left = daysUntil(group.trek_date);

  return (
    <div className="bento">
      <section className="span-7 plan-col">
        <div className="card lime plan-head">
          <div>
            <h3>4-week build-up</h3>
            <p className="small ink-2">A gentle plan that peaks a week before the trek, then lets your legs recover.</p>
          </div>
          {left != null && left >= 0 && <span className="big-num">{left}<small> days</small></span>}
        </div>
        {weeks.length === 0 ? (
          <div className="card"><Empty icon="plan" title="No trek date yet">Add the trek date in your profile to get a plan. <button className="btn btn-text" onClick={() => go('profile')}>Add date</button></Empty></div>
        ) : weeks.map((w) => (
          <article key={w.index} className={`card plan-week ${w.status}`}>
            <div className="pw-top">
              <span className="pw-num">W{w.index + 1}</span>
              <div className="grow">
                <h3>{w.title}</h3>
                <span className="muted small">{dateLabel(w.from)} – {dateLabel(w.to)}{w.status === 'current' ? ' · this week' : w.status === 'past' ? ' · done' : ''}</span>
              </div>
              {w.status !== 'upcoming' && <span className="pw-pct">{Math.round(w.progress * 100)}%</span>}
            </div>
            <p className="pw-focus">{w.focus}</p>
            <div className="pw-targets">
              <Target label="Active days" have={w.done.days} need={w.days} fmt={(v) => v} show={w.status !== 'upcoming'} />
              <Target label="Distance" have={w.done.distance_m / 1000} need={w.km} fmt={(v) => `${km1(v * 1000)}`} unit="km" show={w.status !== 'upcoming'} />
              <Target label="Climb" have={w.done.elevation_gain_m} need={w.elev} fmt={metres} unit="m" show={w.status !== 'upcoming'} />
            </div>
            <p className="pw-key"><Icon name="target" size={15} /> Key session: {w.key}</p>
          </article>
        ))}
        <p className="muted small">General fitness guidance only. If anyone has a heart, lung or knee condition, they should check with a doctor before ramping up.</p>
      </section>
      <section className="span-5">
        <Checklist />
      </section>
    </div>
  );
}

function Target({ label, have, need, fmt, unit = '', show }) {
  return (
    <div className="pw-target">
      <span className="muted small">{label}</span>
      <strong>{show ? `${fmt(have)} / ` : ''}{fmt(need)}{unit && <small> {unit}</small>}</strong>
      {show && <Progress pct={have / need} tone={have >= need ? 'lime' : 'ink'} />}
    </div>
  );
}

function Checklist() {
  const { checklist, profile, group, members, memberById, refresh, toast } = useApp();
  const [label, setLabel] = useState('');
  const myTicks = new Set(checklist.ticks.filter((t) => t.user_id === profile.id).map((t) => t.item_id));
  const done = checklist.items.filter((i) => myTicks.has(i.id)).length;

  async function toggle(id) {
    try { await api.toggleTick(id, profile.id, myTicks.has(id)); await refresh(); } catch (e) { toast(e.message); }
  }
  async function add(e) {
    e.preventDefault();
    const v = label.trim();
    if (!v) return;
    setLabel('');
    try { await api.addChecklistItem(group.id, v, profile.id); await refresh(); } catch (err) { toast(err.message); }
  }
  async function remove(id) {
    if (!confirm('Remove this item for everyone?')) return;
    try { await api.deleteChecklistItem(id); await refresh(); } catch (e) { toast(e.message); }
  }

  return (
    <div className="card checklist">
      <CardHead title="Packing checklist" sub="Shared list; everyone ticks their own" right={<span className="pill pill-ink">{done}/{checklist.items.length}</span>} />
      <Progress pct={checklist.items.length ? done / checklist.items.length : 0} tone="lime" />
      <ul className="check-list">
        {checklist.items.map((it) => {
          const who = checklist.ticks.filter((t) => t.item_id === it.id).map((t) => memberById[t.user_id]).filter(Boolean);
          const on = myTicks.has(it.id);
          return (
            <li key={it.id} className={on ? 'on' : ''}>
              <button className="check-box" onClick={() => toggle(it.id)} aria-pressed={on} aria-label={`Packed ${it.label}`}>
                {on && <Icon name="check" size={15} strokeWidth={2.6} />}
              </button>
              <span className="grow check-label">{it.label}</span>
              {who.length > 0 && <span title={who.map((w) => w.name).join(', ')}><AvatarStack people={who} size={22} max={3} /></span>}
              <span className="muted small">{who.length}/{members.length}</span>
              <button className="icon-btn subtle" onClick={() => remove(it.id)} aria-label="Remove item"><Icon name="x" size={15} /></button>
            </li>
          );
        })}
      </ul>
      {checklist.items.length === 0 && <Empty icon="backpack" title="Empty list">Add things like a down jacket, gloves, head torch, ID.</Empty>}
      <form className="comment-form" onSubmit={add}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item for the crew…" maxLength={80} />
        <button className="icon-btn lime" aria-label="Add"><Icon name="plus" size={18} /></button>
      </form>
    </div>
  );
}
