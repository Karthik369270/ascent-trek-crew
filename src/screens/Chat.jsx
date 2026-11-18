import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api/index.js';
import { useApp } from '../lib/hooks.js';
import { threadKeyOf } from '../lib/chat.js';
import { callThreadKey, fmtDuration, isLiveCall, memberOf } from '../lib/calls.js';
import { Avatar, AvatarStack, Empty, Sheet } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

// The open conversation lives in the URL (#chat/crew or #chat/<member id>) so the phone's back button works.
function readThread() {
  const [tab, key] = location.hash.replace('#', '').split('/');
  return tab === 'chat' && key ? key : null;
}

const clock = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function shortWhen(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return clock(iso);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayHeading(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function Chat() {
  const { messages, members, profile, group, unread, isDemo } = useApp();
  const [thread, setThread] = useState(readThread);
  const me = profile.id;

  useEffect(() => {
    const h = () => setThread(readThread());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const open = (key) => { location.hash = key ? `chat/${key}` : 'chat'; };

  // Latest message per conversation, for previews and sorting
  const last = useMemo(() => {
    const out = {};
    messages.forEach((m) => { out[threadKeyOf(m, me)] = m; });
    return out;
  }, [messages, me]);

  const others = members
    .filter((m) => m.id !== me)
    .sort((a, b) => {
      const ta = last[a.id] ? new Date(last[a.id].created_at).getTime() : 0;
      const tb = last[b.id] ? new Date(last[b.id].created_at).getTime() : 0;
      return tb - ta || a.name.localeCompare(b.name);
    });

  // On a wide screen the crew chat opens by default; on a phone you see the list first
  const active = thread || 'crew';

  return (
    <div className={`chat ${thread ? 'has-thread' : 'no-thread'}`}>
      <section className="card chat-list" aria-label="Conversations">
        <ThreadRow
          on={active === 'crew'} onClick={() => open('crew')} unread={unread.crew}
          avatar={<span className="crew-avatar"><Icon name="mountain" size={20} /></span>}
          name={group.name || 'Crew chat'} msg={last.crew} showSender
        />
        <div className="chat-section">Message someone</div>
        {others.length === 0 && <p className="muted small chat-hint">Invite friends from the Crew tab to message them here.</p>}
        {others.map((m) => (
          <ThreadRow
            key={m.id} on={active === m.id} onClick={() => open(m.id)} unread={unread[m.id]}
            avatar={<Avatar person={m} size={42} />} name={m.name} msg={last[m.id]}
          />
        ))}
        {isDemo && (
          <button className="pill pill-plain demo-call" onClick={() => api.simulateIncomingCall(true)}>
            <Icon name="phone" size={14} /> Demo: get a test call
          </button>
        )}
      </section>
      <Conversation key={active} threadKey={active} onBack={() => open(null)} />
    </div>
  );
}

function ThreadRow({ on, onClick, avatar, name, msg, unread, showSender }) {
  const { memberById, profile } = useApp();
  let preview = 'No messages yet';
  if (msg) {
    const who = msg.sender_id === profile.id ? 'You' : showSender ? memberById[msg.sender_id]?.name || 'Someone' : null;
    preview = who ? `${who}: ${msg.body}` : msg.body;
  }
  return (
    <button className={`chat-row${on ? ' on' : ''}${unread ? ' unread' : ''}`} onClick={onClick}>
      {avatar}
      <span className="grow">
        <span className="chat-row-top">
          <strong>{name}</strong>
          {msg && <span className="muted small">{shortWhen(msg.created_at)}</span>}
        </span>
        <span className="chat-row-top">
          <span className="chat-preview">{preview}</span>
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </span>
      </span>
    </button>
  );
}

function Conversation({ threadKey, onBack }) {
  const { messages, memberById, members, profile, group, refreshMessages, markRead, toast, calls, call } = useApp();
  const me = profile.id;
  const isCrew = threadKey === 'crew';
  const other = isCrew ? null : memberById[threadKey];
  const list = messages.filter((m) => threadKeyOf(m, me) === threadKey);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState(null);
  const [crewPick, setCrewPick] = useState(null); // null, or { video } while choosing who to ring
  const threadCalls = calls.filter((c) => callThreadKey(c, me) === threadKey);
  const liveCall = threadCalls.find((c) => isLiveCall(c) && memberOf(c, me)?.status !== 'joined');
  const inThisCall = call.cur && threadCalls.some((c) => c.id === call.cur.id);
  // Messages and call log lines, oldest first
  const items = [...list.map((m) => ({ kind: 'msg', at: m.created_at, m })), ...threadCalls.map((c) => ({ kind: 'call', at: c.created_at, c }))]
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  function ring(video) {
    if (isCrew) setCrewPick({ video });
    else call.start(threadKey, video);
  }
  const box = useRef(null);
  const input = useRef(null);

  // Mark as read while it's open, and keep the view scrolled to the newest message
  useEffect(() => { markRead(threadKey); }, [threadKey, list.length, markRead]);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [threadKey, items.length]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api.sendMessage(group.id, me, isCrew ? null : threadKey, body);
      setText('');
      await refreshMessages();
    } catch (err) {
      toast(err.message || 'Could not send');
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  async function remove(id) {
    if (!confirm('Delete this message for everyone?')) return;
    try { await api.deleteMessage(id); setPicked(null); await refreshMessages(); } catch (err) { toast(err.message); }
  }

  if (!isCrew && !other) {
    return (
      <section className="card chat-pane">
        <div className="chat-head"><BackBtn onBack={onBack} /><strong>Conversation</strong></div>
        <div className="chat-msgs"><Empty icon="chat" title="Not in your crew">This person isn't in your crew any more.</Empty></div>
      </section>
    );
  }

  let lastDay = null;
  let prev = null;

  return (
    <section className="card chat-pane" aria-label={isCrew ? 'Crew chat' : `Chat with ${other.name}`}>
      <header className="chat-head">
        <BackBtn onBack={onBack} />
        {isCrew ? <span className="crew-avatar"><Icon name="mountain" size={20} /></span> : <Avatar person={other} size={40} />}
        <div className="grow">
          <strong>{isCrew ? group.name || 'Crew chat' : other.name}</strong>
          <span className="muted small">{isCrew ? 'Everyone in the crew sees this' : `Only you and ${other.name} see this`}</span>
        </div>
        <div className="chat-call-btns">
          <button className="icon-btn" onClick={() => ring(false)} disabled={!!call.cur} aria-label="Voice call" title="Voice call"><Icon name="phone" /></button>
          <button className="icon-btn" onClick={() => ring(true)} disabled={!!call.cur} aria-label="Video call" title="Video call"><Icon name="video" /></button>
        </div>
      </header>

      {liveCall && !call.cur && (
        <div className="call-banner">
          <span className="grow">
            <Icon name={liveCall.video ? 'video' : 'phone'} size={16} />
            {liveCall.video ? 'Video' : 'Voice'} call in progress
            <AvatarStack people={liveCall.members.filter((m) => m.status === 'joined').map((m) => memberById[m.user_id]).filter(Boolean)} size={22} />
          </span>
          <button className="pill pill-ink" onClick={() => call.join(liveCall)}>Join</button>
        </div>
      )}
      {inThisCall && call.cur.minimized && (
        <div className="call-banner">
          <span className="grow"><Icon name="phone" size={16} /> You are in this call</span>
          <button className="pill pill-ink" onClick={() => call.minimize(false)}>Return</button>
        </div>
      )}

      <div className="chat-msgs" ref={box}>
        {items.length === 0 && (
          <Empty icon="chat" title="Say hello">
            {isCrew ? 'Plan a stair session, share a tip, or cheer someone on.' : `Start a private chat with ${other.name}.`}
          </Empty>
        )}
        {items.map((it) => {
          if (it.kind === 'call') {
            const day = dayHeading(it.at);
            const newDay = day !== lastDay;
            lastDay = day;
            prev = null;
            return (
              <div key={`call-${it.c.id}`} className="msg-wrap">
                {newDay && <div className="chat-day">{day}</div>}
                <CallLog c={it.c} me={me} />
              </div>
            );
          }
          const m = it.m;
          const day = dayHeading(m.created_at);
          const newDay = day !== lastDay;
          lastDay = day;
          const mine = m.sender_id === me;
          // Start a new "block" when the sender changes, the day changes, or 10+ minutes pass
          const first = newDay || !prev || prev.sender_id !== m.sender_id || new Date(m.created_at) - new Date(prev.created_at) > 10 * 60e3;
          prev = m;
          const who = memberById[m.sender_id];
          return (
            <div key={m.id} className="msg-wrap">
              {newDay && <div className="chat-day">{day}</div>}
              <div className={`msg${mine ? ' mine' : ''}${first ? ' first' : ''}`}>
                {isCrew && !mine && (first ? <Avatar person={who} size={28} /> : <span className="msg-avatar-gap" />)}
                <button
                  type="button" className="bubble"
                  onClick={() => mine && setPicked(picked === m.id ? null : m.id)}
                  aria-label={mine ? 'Your message, tap for options' : undefined}
                >
                  {isCrew && !mine && first && <span className="bubble-name">{who?.name || 'Someone'}</span>}
                  {m.body}
                  <span className="bubble-time">{clock(m.created_at)}</span>
                </button>
                {mine && picked === m.id && <button type="button" className="msg-del" onClick={() => remove(m.id)}>Delete</button>}
              </div>
            </div>
          );
        })}
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
          placeholder={isCrew ? 'Message the crew…' : `Message ${other.name}…`} aria-label="Message"
        />
        <button className="icon-btn lime chat-send" disabled={!text.trim() || sending} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
      {isCrew && (
        <CrewCallPicker
          pick={crewPick} onClose={() => setCrewPick(null)} people={members.filter((m) => m.id !== me)}
          onStart={(ids) => { call.start(null, crewPick.video, ids); setCrewPick(null); }}
        />
      )}
    </section>
  );
}

function BackBtn({ onBack }) {
  return (
    <button className="icon-btn chat-back" onClick={onBack} aria-label="Back to conversations">
      <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} />
    </button>
  );
}

// One line in the chat for each call: "Video call · 4:12", "Missed voice call", "no answer"
function CallLog({ c, me }) {
  const { memberById } = useApp();
  const kind = c.video ? 'video' : 'voice';
  const Kind = c.video ? 'Video' : 'Voice';
  const mine = memberOf(c, me);
  const iStarted = c.created_by === me;
  let text;
  let missed = false;
  if (isLiveCall(c)) text = `${Kind} call in progress`;
  else if (iStarted && !c.answered_at) text = `${Kind} call · no answer`;
  else if (!iStarted && mine && mine.status !== 'left' && mine.status !== 'joined') {
    missed = mine.status !== 'declined';
    text = mine.status === 'declined' ? `Declined ${kind} call` : `Missed ${kind} call`;
  } else {
    const secs = c.answered_at && c.ended_at ? (new Date(c.ended_at) - new Date(c.answered_at)) / 1000 : null;
    text = `${Kind} call${secs != null ? ` · ${fmtDuration(secs)}` : ''}`;
  }
  const who = !c.recipient_id && !iStarted ? memberById[c.created_by]?.name : null;
  return (
    <div className={`call-log${missed ? ' missed' : ''}`}>
      <Icon name={c.video ? 'video' : 'phone'} size={15} />
      <span>{text}</span>
      <span className="muted">{who ? `${who} · ` : ''}{clock(c.created_at)}</span>
    </div>
  );
}

// Crew call: choose who to ring (everyone ticked to start with)
function CrewCallPicker({ pick, onClose, people, onStart }) {
  const [sel, setSel] = useState(() => new Set(people.map((p) => p.id)));
  useEffect(() => { if (pick) setSel(new Set(people.map((p) => p.id))); }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Sheet open={!!pick} onClose={onClose} title={`Crew ${pick?.video ? 'video' : 'voice'} call`}>
      {people.length === 0 ? <p className="muted">Invite friends to the crew first.</p> : (
        <div className="call-people">
          {people.map((p) => (
            <label key={p.id} className="pick-row">
              <Avatar person={p} size={40} />
              <span className="grow"><strong>{p.name}</strong></span>
              <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
            </label>
          ))}
        </div>
      )}
      <button className="btn btn-ink" disabled={sel.size === 0} onClick={() => onStart([...sel])}>
        <Icon name={pick?.video ? 'video' : 'phone'} size={18} /> Ring {sel.size === people.length ? 'everyone' : `${sel.size} ${sel.size === 1 ? 'person' : 'people'}`}
      </button>
    </Sheet>
  );
}
