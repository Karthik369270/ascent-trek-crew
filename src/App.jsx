import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getMode, hasSupabase, setMode } from './lib/api/index.js';
import { AppContext, useApp, useTheme, useTrackerController } from './lib/hooks.js';
import { addDays, daysUntil, startOfDay } from './lib/stats.js';
import { firstRunSince, loadRead, saveRead, threadKeyOf, unreadCounts } from './lib/chat.js';
import Icon from './components/Icon.jsx';
import { Avatar } from './components/bits.jsx';
import Auth from './screens/Auth.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Track from './screens/Track.jsx';
import Feed from './screens/Feed.jsx';
import Crew from './screens/Crew.jsx';
import Plan from './screens/Plan.jsx';
import Chat from './screens/Chat.jsx';
import Profile from './screens/Profile.jsx';

const SCREENS = { home: Home, track: Track, feed: Feed, crew: Crew, chat: Chat, plan: Plan, profile: Profile };
const NAV = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'feed', label: 'Feed', icon: 'feed' },
  { id: 'track', label: 'Record', icon: 'play' },
  { id: 'crew', label: 'Crew', icon: 'crew' },
  // Chat sits in the desktop rail; on phones it's an icon in the top bar so Record stays centred in the bottom nav
  { id: 'chat', label: 'Chat', icon: 'chat', topOnMobile: true },
  { id: 'plan', label: 'Plan', icon: 'plan' },
];
const TITLES = { home: null, track: 'Record', feed: 'Crew feed', crew: 'Crew', chat: 'Chat', plan: 'Trek plan', profile: 'You' };

function readTab() {
  const t = location.hash.replace('#', '').split('/')[0];
  return SCREENS[t] ? t : 'home';
}

export default function App() {
  const themeCtl = useTheme();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [checklist, setChecklist] = useState({ items: [], ticks: [] });
  const [live, setLive] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatRead, setChatRead] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(readTab);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const tracker = useTrackerController(profile, group);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const go = useCallback((t) => {
    if (location.hash !== `#${t}`) location.hash = t;
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const h = () => setTab(readTab());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      if (getMode() === 'demo' && localStorage.getItem('ascent-demo-enter')) {
        localStorage.removeItem('ascent-demo-enter');
        await api.signIn();
      }
      const u = await api.getUser();
      if (alive) setUser(u);
    })();
    const off = api.onAuthChange((u) => setUser(u));
    return () => { alive = false; off(); };
  }, []);

  // ── Data ──────────────────────────────────────────────────
  const loadCrew = useCallback(async (groupId) => {
    const since = addDays(startOfDay(), -120).toISOString();
    const [g, m, a, c, l, msgs] = await Promise.all([
      api.getGroup(groupId), api.getMembers(groupId), api.getActivities(groupId, since), api.getChecklist(groupId), api.getLiveLocations(groupId),
      api.getMessages(groupId).catch(() => []), // [] if the database hasn't got the messages table yet
    ]);
    setGroup(g); setMembers(m); setActivities(a); setChecklist(c); setLive(l); setMessages(msgs);
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) { setProfile(null); setGroup(null); setLoading(false); return; }
    setLoading(true);
    try {
      const p = await api.getProfile(user.id);
      setProfile(p);
      if (p?.group_id) await loadCrew(p.group_id);
    } catch (e) {
      toast(e.message || 'Could not load data');
    } finally {
      setLoading(false);
    }
  }, [user, loadCrew, toast]);

  useEffect(() => { if (user !== undefined) loadAll(); }, [user, loadAll]);

  const groupId = profile?.group_id;
  useEffect(() => {
    if (!groupId) return;
    let t;
    const off = api.subscribe(groupId, () => {
      clearTimeout(t);
      t = setTimeout(() => loadCrew(groupId).catch(() => {}), 350);
    });
    // Refresh when the app comes back to the foreground
    const onVis = () => document.visibilityState === 'visible' && loadCrew(groupId).catch(() => {});
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [groupId, loadCrew]);

  const refresh = useCallback(() => (groupId ? loadCrew(groupId) : loadAll()), [groupId, loadCrew, loadAll]);
  const refreshMessages = useCallback(() => (groupId ? api.getMessages(groupId).then(setMessages) : Promise.resolve()), [groupId]);

  // ── Chat unread tracking (per device) ─────────────────────
  const uid = user?.id;
  useEffect(() => { setChatRead(uid ? loadRead(uid) : {}); }, [uid]);
  useEffect(() => {
    if (!uid || chatRead._since || loading || !groupId) return;
    const since = firstRunSince(messages, uid);
    setChatRead((prev) => {
      if (prev._since) return prev;
      const r = { ...prev, _since: since };
      saveRead(uid, r);
      return r;
    });
  }, [uid, chatRead, loading, groupId, messages]);
  const markRead = useCallback((key) => {
    if (!uid) return;
    setChatRead((prev) => {
      const latest = messages.filter((m) => threadKeyOf(m, uid) === key).map((m) => new Date(m.created_at).getTime());
      const upTo = new Date(Math.max(Date.now(), ...latest)).toISOString();
      if (prev[key] && new Date(prev[key]) >= new Date(upTo)) return prev;
      const r = { ...prev, [key]: upTo };
      saveRead(uid, r);
      return r;
    });
  }, [uid, messages]);
  const unread = useMemo(() => unreadCounts(messages, uid, chatRead), [messages, uid, chatRead]);

  const signOut = useCallback(async () => {
    if (tracker.status !== 'idle') tracker.discard();
    await api.signOut();
    if (getMode() === 'demo' && hasSupabase) { setMode('live'); location.hash = ''; location.reload(); return; }
    setProfile(null); setGroup(null); setMembers([]); setActivities([]);
    location.hash = '';
  }, [tracker]);

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const ctx = {
    user, profile, setProfile, group, setGroup, members, memberById, activities, checklist, live,
    messages, refreshMessages, unread, markRead,
    refresh, loadAll, go, tab, toast, tracker, signOut, isDemo: api.isDemo, ...themeCtl,
  };

  let body;
  if (user === undefined || (user && loading && !profile)) body = <Splash />;
  else if (!user) body = <Auth />;
  else if (!profile) body = <Splash text="Setting up your profile…" />;
  else if (!profile.group_id || !group) body = loading ? <Splash /> : <Onboarding />;
  else body = <Shell />;

  return (
    <AppContext.Provider value={ctx}>
      {body}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppContext.Provider>
  );
}

function Splash({ text }) {
  return (
    <div className="splash">
      <img src="/icon.svg" alt="" width="56" height="56" />
      <span className="muted">{text || 'Loading…'}</span>
    </div>
  );
}

function Shell() {
  const { tab, go, profile, group, tracker, isDemo, theme, setPref, unread } = useApp();
  const Screen = SCREENS[tab] || Home;
  const days = daysUntil(group?.trek_date);
  const now = new Date();
  const recording = tracker.status !== 'idle';

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-inner">
          <button className="rail-logo" onClick={() => go('home')} aria-label="Home"><img src="/icon.svg" alt="" /></button>
          <nav>
            {NAV.map((n) => (
              <button key={n.id} className={`rail-btn${tab === n.id ? ' on' : ''}${n.id === 'track' ? ' rec' : ''}`} onClick={() => go(n.id)} aria-label={n.label} title={n.label}>
                <Icon name={n.id === 'track' && recording ? 'pause' : n.icon} size={20} />
                {n.id === 'chat' && unread.total > 0 && <span className="nav-badge">{unread.total}</span>}
                <span className="rail-tip">{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="rail-bottom">
            <button className="rail-btn" onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" title="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
            </button>
            <button className={`rail-btn${tab === 'profile' ? ' on' : ''}`} onClick={() => go('profile')} aria-label="Profile">
              <Avatar person={profile} size={34} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="date-chip">
              <strong>{now.getDate()}</strong>
              <span>{now.toLocaleDateString('en-IN', { weekday: 'short' })}<br />{now.toLocaleDateString('en-IN', { month: 'short' })}</span>
            </div>
            {days != null && days >= 0 && (
              <div className="date-chip ghost">
                <strong>{days}</strong>
                <span>days to<br />trek</span>
              </div>
            )}
            {TITLES[tab] && <h1 className="page-title">{TITLES[tab]}</h1>}
          </div>
          <div className="topbar-right">
            {isDemo && <span className="pill pill-lime demo-pill">Demo</span>}
            {recording && tab !== 'track' && (
              <button className="pill pill-ink rec-pill" onClick={() => go('track')}>
                <span className="rec-dot" /> Recording
              </button>
            )}
            <button className="pill pill-ink crew-pill" onClick={() => go('crew')}>{group?.name}</button>
            <button className={`icon-btn mobile-only chat-top${tab === 'chat' ? ' on' : ''}`} onClick={() => go('chat')} aria-label="Chat">
              <Icon name="chat" />
              {unread.total > 0 && <span className="nav-badge">{unread.total}</span>}
            </button>
            <button className="icon-btn mobile-only" onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button className="mobile-only avatar-btn" onClick={() => go('profile')} aria-label="Profile"><Avatar person={profile} size={36} /></button>
          </div>
        </header>
        <main className="content">
          <Screen />
        </main>
      </div>

      <nav className="bottom-nav">
        {NAV.filter((n) => !n.topOnMobile).map((n) => (
          <button key={n.id} className={`bn-btn${tab === n.id ? ' on' : ''}${n.id === 'track' ? ' rec' : ''}${n.id === 'track' && recording ? ' live' : ''}`} onClick={() => go(n.id)}>
            <span className="bn-icon"><Icon name={n.id === 'track' && recording ? 'pause' : n.icon} size={n.id === 'track' ? 22 : 20} /></span>
            {n.id !== 'track' && <span>{n.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
