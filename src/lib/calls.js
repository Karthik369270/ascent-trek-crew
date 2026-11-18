// Voice/video calls. Who-is-ringing-whom lives in the database (calls + call_members, pushed by realtime);
// the actual audio/video goes through Daily.co. In demo mode there's no Daily: you see your own camera and
// crewmates appear as avatars.
import { useCallback, useEffect, useRef, useState } from 'react';

export const RING_MS = 45000; // how long a call rings before it counts as unanswered
const STALE_MS = 6 * 3600e3; // a call older than this is treated as over even if nobody marked it ended

// Which chat thread a call belongs to (same keys as chat.js: 'crew' or the other person's id)
export function callThreadKey(c, me) {
  if (!c.recipient_id) return 'crew';
  return c.created_by === me ? c.recipient_id : c.created_by;
}
export const memberOf = (c, uid) => c?.members.find((m) => m.user_id === uid);
const fresh = (m) => Date.now() - new Date(m.updated_at).getTime() < RING_MS;
export const isRingingFor = (c, uid) => {
  const m = memberOf(c, uid);
  return !c.ended_at && m?.status === 'ringing' && fresh(m);
};
// Still going: not ended, not ancient, and somebody is in it
export const isLiveCall = (c) => !c.ended_at && Date.now() - new Date(c.created_at).getTime() < STALE_MS && c.members.some((m) => m.status === 'joined');

export function fmtDuration(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// ── Ringtones, generated (no audio files) ──────────────────
let audioCtx;
function tone(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
  } catch { return () => {}; }
  let stopped = false;
  const timers = [];
  const beep = (freqs, dur) => {
    if (stopped) return;
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.03);
    g.gain.setValueAtTime(0.1, t + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(audioCtx.destination);
    freqs.forEach((f) => { const o = audioCtx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur); });
  };
  const play = kind === 'in'
    ? () => { beep([660, 880], 0.35); timers.push(setTimeout(() => beep([660, 880], 0.35), 480)); navigator.vibrate?.([400, 200, 400]); }
    : () => beep([425], 1.1);
  play();
  const iv = setInterval(play, kind === 'in' ? 2200 : 3200);
  return () => { stopped = true; clearInterval(iv); timers.forEach(clearTimeout); try { navigator.vibrate?.(0); } catch { /* ignore */ } };
}

// ── Engines: one talks to Daily, one fakes it for the demo ──
async function dailyEngine(onChange) {
  const { default: Daily } = await import('@daily-co/daily-js'); // only downloaded when a call starts
  const co = Daily.getCallInstance?.() || Daily.createCallObject({ subscribeToTracksAutomatically: true });
  let speaker = null;
  const playable = (t) => (t?.state === 'playable' ? t.persistentTrack : null);
  const emit = () => onChange(Object.values(co.participants()).map((p) => ({
    key: p.session_id,
    userId: p.user_id,
    name: p.user_name,
    local: p.local,
    video: playable(p.tracks?.video),
    audio: p.local ? null : playable(p.tracks?.audio),
    mic: !['off', 'blocked'].includes(p.tracks?.audio?.state),
    speaking: !p.local && p.session_id === speaker,
  })));
  ['joined-meeting', 'participant-joined', 'participant-updated', 'participant-left', 'track-started', 'track-stopped'].forEach((e) => co.on(e, emit));
  co.on('active-speaker-change', (e) => { speaker = e?.activeSpeaker?.peerId; emit(); });
  return {
    async join({ url, token, video }) { await co.join({ url, token, startVideoOff: !video, startAudioOff: false }); emit(); },
    setMic: (b) => co.setLocalAudio(b),
    setCam: (b) => co.setLocalVideo(b),
    flip: () => co.cycleCamera?.(),
    on: (ev, fn) => co.on(ev, fn),
    async leave() {
      try { await co.leave(); } catch { /* already left */ }
      try { await co.destroy(); } catch { /* already gone */ }
    },
  };
}

async function demoEngine(onChange, me) {
  let stream = null, cam = false, mic = true, facing = 'user', onCamError = null;
  const emit = () => onChange([{ key: 'me', userId: me.id, name: me.name, local: true, video: cam ? stream?.getVideoTracks()[0] || null : null, mic }]);
  const startCam = async () => {
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false }); } catch { stream = null; }
  };
  const stopCam = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  return {
    async join({ video }) { cam = video; if (video) await startCam(); if (video && !stream) { cam = false; onCamError?.(); } emit(); },
    setMic(b) { mic = b; emit(); },
    async setCam(b) { cam = b; if (b) await startCam(); else stopCam(); if (b && !stream) { cam = false; onCamError?.(); } emit(); },
    async flip() { facing = facing === 'user' ? 'environment' : 'user'; if (cam) { stopCam(); await startCam(); emit(); } },
    on(ev, fn) { if (ev === 'camera-error') onCamError = fn; },
    async leave() { stopCam(); },
  };
}

// ── The controller, held in App so a call survives switching tabs ──
export function useCallController({ api, profile, group, memberById, calls, refreshCalls, toast }) {
  const me = profile?.id;
  const [cur, setCurState] = useState(null); // { id, video, phase: 'connecting' | 'live', minimized, startedAt }
  const curRef = useRef(null);
  const setCur = useCallback((v) => {
    const next = typeof v === 'function' ? v(curRef.current) : v;
    curRef.current = next;
    setCurState(next);
  }, []);
  const [parts, setParts] = useState([]);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [, setTick] = useState(0);
  const engine = useRef(null);
  const connectedAt = useRef(null);

  const call = cur ? calls.find((c) => c.id === cur.id) : null;
  const incoming = !cur ? calls.find((c) => isRingingFor(c, me)) : null;

  // Tick once a second while ringing or in a call (timer, ring timeouts)
  const needTick = !!cur || calls.some((c) => !c.ended_at && memberOf(c, me)?.status === 'ringing');
  useEffect(() => {
    if (!needTick) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [needTick]);

  const finish = useCallback(async (status, msg) => {
    const c = curRef.current;
    if (!c) return;
    setCur(null);
    setParts([]);
    connectedAt.current = null;
    const e = engine.current;
    engine.current = null;
    e?.leave();
    if (status && c.id) { try { await api.respondToCall(c.id, status); } catch { /* call already over */ } }
    if (msg) toast(msg);
    refreshCalls();
  }, [api, toast, refreshCalls, setCur]);

  const connect = useCallback(async (id, video) => {
    setCur((c) => ({ recipientId: c?.recipientId, minimized: !!c?.minimized, id, video, phase: 'connecting', startedAt: Date.now() }));
    setMic(true);
    setCam(video);
    try {
      const cred = await api.getCallToken(id);
      const e = await (cred.demo ? demoEngine : dailyEngine)(setParts, profile);
      if (curRef.current?.id !== id) { e.leave(); return; } // hung up while connecting
      engine.current = e;
      e.on('left-meeting', () => finish('left'));
      e.on('error', (ev) => finish('left', ev?.errorMsg || 'The call dropped'));
      e.on('camera-error', () => { setCam(false); toast('Camera or microphone is blocked. Allow it in the browser settings.'); });
      await e.join({ ...cred, video });
      setCur((c) => (c && c.id === id ? { ...c, phase: 'live' } : c));
    } catch (err) {
      finish('left', err?.message || 'Could not connect the call');
    }
  }, [api, profile, finish, setCur, toast]);

  const start = useCallback(async (recipientId, video, inviteIds) => {
    if (curRef.current) return toast("You're already in a call");
    // Show the call screen straight away while the call is being set up
    setCur({ id: null, video, phase: 'connecting', minimized: false, startedAt: Date.now(), recipientId });
    setCam(video);
    try {
      const id = await api.startCall(group.id, recipientId, video, inviteIds);
      if (!curRef.current) { api.respondToCall(id, 'left').catch(() => {}); return; } // hung up already
      await refreshCalls();
      connect(id, video);
    } catch (err) { setCur(null); toast(err.message || 'Could not start the call'); }
  }, [api, group, refreshCalls, connect, toast]);

  const join = useCallback(async (c, video = c.video) => {
    if (curRef.current) return toast("You're already in a call");
    try {
      await api.respondToCall(c.id, 'joined');
      await refreshCalls();
      connect(c.id, video);
    } catch (err) { toast(err.message || 'Could not join'); refreshCalls(); }
  }, [api, refreshCalls, connect, toast]);

  const decline = useCallback(async (c) => {
    try { await api.respondToCall(c.id, 'declined'); } catch { /* over already */ }
    refreshCalls();
  }, [api, refreshCalls]);

  const invite = useCallback(async (ids) => {
    if (!curRef.current) return;
    try { await api.inviteToCall(curRef.current.id, ids); await refreshCalls(); } catch (err) { toast(err.message); }
  }, [api, refreshCalls, toast]);

  const toggleMic = useCallback(() => { setMic((v) => { engine.current?.setMic(!v); return !v; }); }, []);
  const toggleCam = useCallback(() => { setCam((v) => { engine.current?.setCam(!v); return !v; }); }, []);
  const flip = useCallback(() => engine.current?.flip(), []);
  const minimize = useCallback((v) => setCur((c) => (c ? { ...c, minimized: v } : c)), [setCur]);
  const hangup = useCallback(() => finish('left'), [finish]);

  // Hang up by itself when the call is over, nobody answered, or the other person declined
  const others = call ? call.members.filter((m) => m.user_id !== me) : [];
  const othersIn = others.filter((m) => m.status === 'joined');
  const othersRinging = others.filter((m) => m.status === 'ringing' && fresh(m));
  if (othersIn.length && !connectedAt.current && cur?.phase === 'live') connectedAt.current = Date.now();
  useEffect(() => {
    if (!cur || !call) return;
    if (call.ended_at) { finish(null, 'Call ended'); return; }
    if (othersIn.length || othersRinging.length) return;
    if (Date.now() - cur.startedAt < 4000) return; // let the first updates arrive
    const one = call.recipient_id && others.length === 1 ? others[0] : null;
    const who = one && memberById[one.user_id]?.name;
    const msg = connectedAt.current || call.answered_at ? 'Call ended'
      : one?.status === 'declined' ? `${who || 'They'} declined` : 'No answer';
    finish('left', msg);
  });

  // Ringtones: incoming ring, and the "ringing" tone while you wait for someone to pick up
  const ringingOut = !!cur && cur.phase === 'live' && othersIn.length === 0 && othersRinging.length > 0;
  useEffect(() => (incoming ? tone('in') : undefined), [incoming?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (ringingOut ? tone('out') : undefined), [ringingOut]);

  // Closing the app mid-call: tell the others you left (best effort)
  useEffect(() => {
    const bye = () => { const c = curRef.current; if (c) api.respondToCall(c.id, 'left').catch(() => {}); };
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [api]);

  // What to draw: people in the call (Daily), plus people still ringing / connecting from the database
  const tiles = (() => {
    if (!cur) return [];
    const list = [];
    const seen = new Set();
    parts.forEach((p) => {
      seen.add(p.userId);
      list.push({ ...p, person: memberById[p.userId] || { name: p.name } });
    });
    if (!parts.some((p) => p.local)) list.unshift({ key: 'me', userId: me, local: true, person: profile, mic, video: null });
    (call?.members || []).forEach((m, i) => {
      if (m.user_id === me || seen.has(m.user_id)) return;
      const person = memberById[m.user_id];
      if (!person) return;
      if (m.status === 'joined') {
        // Demo: crewmates "in the call" show as avatars that take turns talking
        if (api.isDemo) list.push({ key: m.user_id, userId: m.user_id, person, mic: true, speaking: Math.floor(Date.now() / 3000) % 4 === i % 4 });
        else list.push({ key: m.user_id, userId: m.user_id, person, state: 'Connecting…' });
      } else if (m.status === 'ringing' && fresh(m)) {
        list.push({ key: m.user_id, userId: m.user_id, person, state: 'Ringing…' });
      }
    });
    return list;
  })();

  return {
    cur, call, incoming, tiles, mic, cam,
    connectedAt: connectedAt.current,
    waiting: !!cur && othersIn.length === 0,
    start, join, decline, hangup, invite, toggleMic, toggleCam, flip, minimize,
  };
}
