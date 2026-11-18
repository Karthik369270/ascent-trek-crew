// Everything you see during a call: the incoming-call screen, the call screen, the minimised pill,
// and the "add people" sheet. Mounted once in the app shell; state comes from useCallController (lib/calls.js).
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/hooks.js';
import { fmtDuration, memberOf } from '../lib/calls.js';
import { Avatar, AvatarStack, Sheet } from './bits.jsx';
import Icon from './Icon.jsx';

function VideoEl({ track, mirror }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = track ? new MediaStream([track]) : null;
  }, [track]);
  return <video ref={ref} autoPlay playsInline muted className={mirror ? 'mirror' : undefined} />;
}

function AudioEl({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = track ? new MediaStream([track]) : null;
    el.play?.().catch(() => {});
  }, [track]);
  return <audio ref={ref} autoPlay />;
}

export default function CallLayer() {
  const { call: ctl } = useApp();
  const [adding, setAdding] = useState(false);
  if (!ctl.cur && !ctl.incoming) return null;
  return (
    <>
      {ctl.incoming && <Incoming c={ctl.incoming} />}
      {ctl.cur && !ctl.cur.minimized && <CallScreen onAdd={() => setAdding(true)} />}
      {ctl.cur && ctl.cur.minimized && <MiniCall />}
      {/* Remote voices keep playing while the call is minimised */}
      {ctl.tiles.filter((t) => t.audio).map((t) => <AudioEl key={t.key} track={t.audio} />)}
      <AddPeople open={adding && !!ctl.cur} onClose={() => setAdding(false)} />
    </>
  );
}

function callTitle(c, me, memberById, group) {
  if (!c) return '';
  if (!c.recipient_id) return group?.name || 'Crew call';
  const otherId = c.created_by === me ? c.recipient_id : c.created_by;
  const extra = c.members.filter((m) => m.user_id !== me && m.user_id !== otherId).length;
  return `${memberById[otherId]?.name || 'Call'}${extra ? ` +${extra}` : ''}`;
}

function Incoming({ c }) {
  const { call: ctl, memberById, group, members, profile } = useApp();
  const caller = memberById[c.created_by];
  const inCall = members.filter((m) => m.id !== profile.id && memberOf(c, m.id)?.status === 'joined');
  const kind = c.video ? 'video' : 'voice';
  return (
    <div className="call-screen incoming" role="dialog" aria-label={`Incoming ${kind} call from ${caller?.name}`}>
      <div className="call-hero">
        <div className="ring-avatar"><Avatar person={caller} size={112} /></div>
        <strong className="call-name">{caller?.name || 'Someone'}</strong>
        <span className="call-sub">
          {c.recipient_id ? `Incoming ${kind} call` : `Crew ${kind} call · ${group?.name || ''}`}
        </span>
        {!c.recipient_id && inCall.length > 1 && (
          <span className="call-sub"><AvatarStack people={inCall} size={26} /> {inCall.length} in the call</span>
        )}
      </div>
      <div className="call-answer">
        <div>
          <button className="call-btn end" onClick={() => ctl.decline(c)} aria-label="Decline"><Icon name="phoneDown" size={28} /></button>
          <span>Decline</span>
        </div>
        {c.video && (
          <div>
            <button className="call-btn" onClick={() => ctl.join(c, false)} aria-label="Answer with voice only"><Icon name="phone" size={24} /></button>
            <span>Voice only</span>
          </div>
        )}
        <div>
          <button className="call-btn accept" onClick={() => ctl.join(c)} aria-label="Answer"><Icon name={c.video ? 'video' : 'phone'} size={26} /></button>
          <span>Answer</span>
        </div>
      </div>
    </div>
  );
}

function useElapsed(ctl) {
  return ctl.connectedAt ? fmtDuration((Date.now() - ctl.connectedAt) / 1000) : null;
}

function CallScreen({ onAdd }) {
  const { call: ctl, profile, memberById, group } = useApp();
  const { cur, call, tiles, waiting } = ctl;
  const me = profile.id;
  const elapsed = useElapsed(ctl);
  const remotes = tiles.filter((t) => !t.local);
  const local = tiles.find((t) => t.local);
  const live = remotes.filter((t) => !t.state);
  const inCount = live.length + 1;

  let status;
  if (cur.phase === 'connecting') status = 'Connecting…';
  else if (waiting) status = remotes.some((t) => t.state === 'Ringing…') ? 'Ringing…' : 'Calling…';
  else status = `${elapsed || '0:00'}${inCount > 2 ? ` · ${inCount} in call` : ''}`;

  // While waiting: your own camera full screen with the person you're calling on top (like WhatsApp).
  // One other person: them full screen, you in a small corner. More: a grid.
  const duo = !waiting && live.length === 1 && remotes.length === 1;
  const grid = waiting ? [] : duo ? remotes : [local, ...remotes];
  const n = grid.length;
  const ringingPeople = remotes.map((t) => t.person);
  const target = cur.recipientId ? memberById[cur.recipientId] : null; // known before the call row arrives
  const title = callTitle(call, me, memberById, group) || target?.name || group?.name || 'Call';

  return (
    <div className="call-screen" role="dialog" aria-label="Call">
      {waiting && (
        <div className="call-waiting">
          {local?.video && <div className="call-self-full"><VideoEl track={local.video} mirror /></div>}
          <div className="call-hero">
            {target || call?.recipient_id || ringingPeople.length === 1
              ? <div className="ring-avatar"><Avatar person={ringingPeople[0] || target || memberById[call?.recipient_id]} size={112} /></div>
              : ringingPeople.length ? <AvatarStack people={ringingPeople} size={64} max={4} />
              : <span className="crew-avatar ring-avatar call-crew-avatar"><Icon name="mountain" size={44} /></span>}
            <strong className="call-name">{title}</strong>
            <span className="call-sub">{status}</span>
          </div>
        </div>
      )}

      {!waiting && (
        <div className={`call-grid n${Math.min(n, 9)}`} style={{ '--cols': n <= 1 ? 1 : n <= 4 ? 2 : 3 }}>
          {grid.map((t) => <Tile key={t.key} t={t} big={duo} />)}
        </div>
      )}
      {duo && local && (
        <div className="call-pip"><Tile t={local} /></div>
      )}

      <header className="call-top">
        <button className="call-icon" onClick={() => ctl.minimize(true)} aria-label="Minimise call"><Icon name="minimize" size={22} /></button>
        <div className="call-title">
          {!waiting && <strong>{title}</strong>}
          {!waiting && <span>{status}</span>}
          <span className="call-lock">{cur.video || ctl.cam ? 'Video call' : 'Voice call'} · only your crew</span>
        </div>
        <button className="call-icon" onClick={onAdd} aria-label="Add people" disabled={cur.phase !== 'live'}><Icon name="userPlus" size={22} /></button>
      </header>

      <footer className="call-controls">
        <button className={`call-btn soft${ctl.cam ? '' : ' off'}`} onClick={ctl.flip} disabled={!ctl.cam} aria-label="Switch camera"><Icon name="flip" size={22} /></button>
        <button className={`call-btn soft${ctl.cam ? '' : ' off'}`} onClick={ctl.toggleCam} aria-label={ctl.cam ? 'Turn camera off' : 'Turn camera on'}>
          <Icon name={ctl.cam ? 'video' : 'videoOff'} size={22} />
        </button>
        <button className={`call-btn soft${ctl.mic ? '' : ' off'}`} onClick={ctl.toggleMic} aria-label={ctl.mic ? 'Mute' : 'Unmute'}>
          <Icon name={ctl.mic ? 'mic' : 'micOff'} size={22} />
        </button>
        <button className="call-btn end" onClick={ctl.hangup} aria-label="End call"><Icon name="phoneDown" size={28} /></button>
      </footer>
    </div>
  );
}

function Tile({ t, big }) {
  const name = t.local ? 'You' : t.person?.name || t.name || 'Crewmate';
  return (
    <div className={`tile${t.speaking ? ' speaking' : ''}${t.state ? ' waiting' : ''}${big ? ' big' : ''}`}>
      {t.video
        ? <VideoEl track={t.video} mirror={t.local} />
        : <div className="tile-avatar"><Avatar person={t.person} size={big ? 120 : 72} /></div>}
      <span className="tile-name">
        {t.mic === false && <Icon name="micOff" size={14} />}
        {name}
      </span>
      {t.state && <span className="tile-state">{t.state}</span>}
    </div>
  );
}

function MiniCall() {
  const { call: ctl, profile, memberById, group } = useApp();
  const elapsed = useElapsed(ctl);
  return (
    <div className="call-mini" role="status">
      <button className="call-mini-main" onClick={() => ctl.minimize(false)} aria-label="Back to call">
        <span className="call-mini-dot" />
        <span className="grow">
          <strong>{callTitle(ctl.call, profile.id, memberById, group)}</strong>
          <span>{ctl.waiting ? 'Ringing…' : elapsed || 'On call'} · tap to return</span>
        </span>
      </button>
      <button className="call-btn end small" onClick={ctl.hangup} aria-label="End call"><Icon name="phoneDown" size={20} /></button>
    </div>
  );
}

const STATUS_LABEL = { joined: 'In the call', ringing: 'Ringing…', declined: 'Declined', missed: 'No answer', left: 'Left' };

function AddPeople({ open, onClose }) {
  const { call: ctl, members, profile } = useApp();
  const c = ctl.call;
  const others = members.filter((m) => m.id !== profile.id);
  return (
    <Sheet open={open} onClose={onClose} title="Add people to the call">
      <div className="call-people">
        {others.length === 0 && <p className="muted">Invite friends to the crew first.</p>}
        {others.map((m) => {
          const mm = memberOf(c, m.id);
          const ringing = mm?.status === 'ringing' && Date.now() - new Date(mm.updated_at).getTime() < 45000;
          const busy = mm?.status === 'joined' || ringing;
          return (
            <div key={m.id} className="call-person">
              <Avatar person={m} size={40} />
              <span className="grow">
                <strong>{m.name}</strong>
                <span className="muted small">{mm ? (ringing ? 'Ringing…' : STATUS_LABEL[mm.status === 'ringing' ? 'missed' : mm.status]) : 'Not in the call'}</span>
              </span>
              {!busy && (
                <button className="pill pill-ink" onClick={() => ctl.invite([m.id])}>
                  <Icon name="phone" size={14} /> {mm ? 'Ring again' : 'Ring'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
