import { useApp } from '../lib/hooks.js';
import {
  daysUntil, groupClimb, weeklyPlan, inactiveMembers, leaderboard, mine, readiness, startOfWeek, streak, sumBetween, todayTotals, weekDays, weeklySeries,
} from '../lib/stats.js';
import { compact, dateLabel, durationShort, greeting, km, km1, metres, shareText, timeAgo, TYPES } from '../lib/format.js';
import { Lollipop, MiniRoute, MountainProfile, VPill } from '../components/Charts.jsx';
import { Avatar, AvatarStack, CardHead, Empty, Pill, Progress } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

export default function Home() {
  const { profile, group, members, memberById, activities, go } = useApp();
  const uid = profile.id;
  const today = todayTotals(activities, uid);
  const days = weekDays(activities, uid);
  const st = streak(activities, uid);
  const ready = readiness(activities, uid);
  const series = weeklySeries(activities, uid, 8, 'elevation_gain_m');
  const climb = groupClimb(activities, group.climb_goal_m);
  const week = sumBetween(mine(activities, uid), startOfWeek());
  const board = leaderboard(activities, members, 'elevation', startOfWeek());
  const rank = board.findIndex((r) => r.member.id === uid) + 1;
  const left = daysUntil(group.trek_date);
  const quiet = inactiveMembers(members, activities, 3, uid);
  const recent = activities.slice(0, 4);
  const activeDays = days.filter((d) => d.active).length;
  const allDone = today.distance_m / 1000 >= profile.target_km && today.elevation_gain_m >= profile.target_elev_m && today.minutes >= profile.target_minutes;
  const planWeek = weeklyPlan(group.trek_date, activities, uid);
  const curPlan = planWeek.find((w) => w.status === 'current');
  const firstName = profile.name.split(' ')[0];

  return (
    <div className="bento">
      {/* Hero / countdown */}
      <section className="card hero mint span-5">
        <div className="hero-top">
          <Pill tone="glass" icon="mountain">{group.trek_name}</Pill>
          <AvatarStack people={members} size={28} />
        </div>
        <div className="hero-body">
          <p className="hero-greet">{greeting()}, {firstName}</p>
          {left == null ? (
            <>
              <h2 className="hero-title">Set your trek date</h2>
              <button className="btn btn-ink" onClick={() => go('profile')}>Add date</button>
            </>
          ) : left > 0 ? (
            <h2 className="hero-big"><span>{left}</span> {left === 1 ? 'day' : 'days'} to go</h2>
          ) : left === 0 ? (
            <h2 className="hero-big"><span>Today</span> is trek day</h2>
          ) : (
            <h2 className="hero-title">Hope the summit was worth it 🏔️</h2>
          )}
          {group.trek_date && <p className="muted small">Trek starts {dateLabel(group.trek_date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
        </div>
        <div className="hero-actions">
          <button className="btn btn-ink" onClick={() => go('track')}><Icon name="play" size={16} /> Start activity</button>
          <button className="btn btn-glass" onClick={() => go('plan')}>This week's plan</button>
        </div>
        <svg className="hero-art" viewBox="0 0 300 160" aria-hidden="true">
          <path d="M0 160 70 70l40 45 55-85 50 70 35-30 50 90z" className="ridge-back" />
          <path d="M0 160 55 105l45 30 60-60 55 50 40-20 45 55z" className="ridge-front" />
          <path d="M160 30 175 52l-9-4-6 8-6-7-9 4z" className="ridge-snow" />
        </svg>
      </section>

      {/* Week calendar */}
      <section className="card lime span-3 week-card" onClick={() => go('plan')} role="button" tabIndex={0}>
        <div className="card-head">
          <div><h3>This week</h3><p className="small ink-2">{activeDays} of 7 days active</p></div>
          <span className="streak"><Icon name="flame" size={16} />{st}</span>
        </div>
        <div className="week-grid">
          {days.map((d, i) => (
            <div key={i} className="wk-col">
              <span className="wk-letter">{'MTWTFSS'[i]}</span>
              <span className={`wk-dot${d.active ? ' on' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`}>
                {d.active ? <Icon name="check" size={14} strokeWidth={2.4} /> : d.date.getDate()}
              </span>
            </div>
          ))}
        </div>
        <div className="ruler">
          {days.map((d, i) => (
            <div key={i} className="ruler-cell">
              <div className="ruler-ticks">{Array.from({ length: 4 }, (_, j) => <i key={j} className={j === 0 ? 'major' : ''} />)}</div>
              <span className={d.isToday ? 'on' : ''}>{d.km ? d.km.toFixed(1) : d.elev ? `${Math.round(d.elev)}m` : '–'}</span>
            </div>
          ))}
        </div>
        <p className="small ink-2 week-foot">km per day · climb shown for stair days</p>
        <div className="week-plan">
          {curPlan ? (
            <><span className="small ink-2">Plan · W{curPlan.index + 1} {curPlan.title}</span><strong>{curPlan.days} days · {curPlan.km} km · {curPlan.elev} m</strong></>
          ) : planWeek[0] && planWeek[0].status === 'upcoming' ? (
            <><span className="small ink-2">4-week plan starts</span><strong>{dateLabel(planWeek[0].from, { weekday: 'short', day: 'numeric', month: 'short' })}</strong></>
          ) : (
            <><span className="small ink-2">Keep moving</span><strong>Every day counts</strong></>
          )}
        </div>
      </section>

      {/* Readiness */}
      <section className="card span-4 clickable" onClick={() => go('crew')} role="button" tabIndex={0}>
        <CardHead title="Trek readiness" sub="Based on your last 3 weeks" right={<Pill tone={ready.score >= 75 ? 'lime' : ready.score >= 45 ? 'mint' : 'warn'}>{ready.label}</Pill>} />
        <div className="score-row">
          <span className="big-num">{ready.score}<small>/100</small></span>
          <span className="muted small score-hint">Work on: <strong>{ready.weakest.label.toLowerCase()}</strong></span>
        </div>
        <Lollipop data={series} format={(v) => `${compact(v)}m`} labels={series.map((s, i) => (i === series.length - 1 ? 'now' : `${dateLabel(s.from, { day: 'numeric' })}`))} />
        <p className="muted small">Weekly climbing, last 8 weeks</p>
      </section>

      {/* Today's targets */}
      <section className="card span-4 targets-card">
        <CardHead title={allDone ? 'Wow, all done!' : "Today's targets"} sub={allDone ? 'Every target hit today' : 'Tap Record when you head out'} right={<button className="pill pill-plain" onClick={() => go('profile')}><Icon name="edit" size={13} /> Edit</button>} />
        <div className="vpills">
          <VPill label="Distance" unit="km" value={today.distance_m / 1000} target={profile.target_km} format={(v) => (Math.round(v * 10) / 10).toString()} />
          <VPill label="Climb" unit="m" value={today.elevation_gain_m} target={profile.target_elev_m} />
          <VPill label="Active" unit="min" value={today.minutes} target={profile.target_minutes} />
        </div>
      </section>

      {/* Crew climb */}
      <section className="card span-5 climb-card clickable" onClick={() => go('crew')} role="button" tabIndex={0}>
        <CardHead title="Crew climb" sub="Every metre anyone climbs counts toward the crew total" right={<Pill tone="ink">{climb.summits.toFixed(1)} summits</Pill>} />
        <div className="climb-num">
          <span className="big-num">{metres(climb.total)}<small> m</small></span>
          <span className="muted small">of {metres(climb.goal)} m goal</span>
        </div>
        <MountainProfile lap={climb.lap} />
        <Progress pct={climb.pct} tone="lime" />
        <p className="muted small">Lap {climb.fullSummits + 1}: {Math.round(climb.lap * 100)}% of the way from Chopta to Chandrashila</p>
      </section>

      {/* Small tiles */}
      <section className="span-3 tiles">
        <div className="card tile">
          <span className="tile-label">This week</span>
          <span className="tile-num">{km1(week.distance_m)}<small>km</small></span>
          <span className="tile-icon"><Icon name="route" size={16} /></span>
        </div>
        <div className="card tile mint">
          <span className="tile-label">Climbed</span>
          <span className="tile-num">{compact(week.elevation_gain_m)}<small>m</small></span>
          <span className="tile-icon"><Icon name="stairs" size={16} /></span>
        </div>
        <div className="card tile">
          <span className="tile-label">Streak</span>
          <span className="tile-num">{st}<small>{st === 1 ? 'day' : 'days'}</small></span>
          <span className="tile-icon"><Icon name="flame" size={16} /></span>
        </div>
        <div className="card tile ink">
          <span className="tile-label">Climb rank</span>
          <span className="tile-num">#{rank || '–'}<small>of {members.length}</small></span>
          <span className="tile-icon"><Icon name="trophy" size={16} /></span>
        </div>
      </section>

      {/* Recent */}
      <section className="card span-8">
        <CardHead title="Latest from the crew" right={<button className="pill pill-plain" onClick={() => go('feed')}>See all <Icon name="chevron" size={13} /></button>} />
        {recent.length === 0 ? (
          <Empty icon="walk" title="No activities yet">Be the first: record a walk or log some stairs.</Empty>
        ) : (
          <div className="recent-grid">
            {recent.map((a) => {
              const who = memberById[a.user_id];
              return (
                <button key={a.id} className="recent-item" onClick={() => go('feed')}>
                  <div className="recent-visual">
                    {a.route ? <MiniRoute route={a.route} height={70} /> : <span className="recent-icon"><Icon name={TYPES[a.type]?.icon || 'clock'} size={26} /></span>}
                  </div>
                  <div className="recent-meta">
                    <span className="recent-who"><Avatar person={who} size={20} /> {who?.name || 'Someone'}</span>
                    <strong>{a.distance_m ? `${km(a.distance_m)} km` : durationShort(a.duration_s)} · {metres(a.elevation_gain_m)} m</strong>
                    <span className="muted small">{TYPES[a.type]?.label} · {timeAgo(a.started_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Nudges */}
      <section className="card span-4">
        <CardHead title="Nudge the crew" sub="No activity in 3+ days" />
        {quiet.length === 0 ? (
          <Empty icon="check" title="Everyone's moving">The whole crew has logged something in the last 3 days.</Empty>
        ) : (
          <ul className="list">
            {quiet.map(({ member, daysSince }) => (
              <li key={member.id} className="list-row">
                <Avatar person={member} size={34} />
                <div className="grow">
                  <strong>{member.name}</strong>
                  <span className="muted small">{daysSince == null ? 'Hasn’t logged anything yet' : `Quiet for ${daysSince} days`}</span>
                </div>
                <button className="pill pill-lime" onClick={() => shareText(`${member.name}, Chandrashila won't climb itself 😄 ${left > 0 ? `${left} days to go.` : ''} Log a walk today?`, location.origin)}>
                  <Icon name="bell" size={13} /> Nudge
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
