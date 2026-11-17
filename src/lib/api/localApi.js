// Demo backend: same functions as supabaseApi.js, but everything lives in this browser's localStorage.
import { makeSeed, uid } from './demoSeed.js';

const KEY = 'ascent-demo-v1';
export const isDemo = true;

const authListeners = new Set();
const dataListeners = new Set();

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s) { s = makeSeed(); persist(s); }
  if (!s.messages) s.messages = []; // demo data saved before chat existed
  return s;
}
function persist(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}
function mutate(fn) {
  const s = load();
  const out = fn(s);
  persist(s);
  setTimeout(() => dataListeners.forEach((f) => f()), 0);
  return out;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 60));

export async function getUser() {
  const s = load();
  return s.signedIn ? { id: s.me, email: 'demo@ascent.app' } : null;
}
export function onAuthChange(cb) {
  authListeners.add(cb);
  return () => authListeners.delete(cb);
}
async function setSignedIn(v) {
  mutate((s) => { s.signedIn = v; });
  const u = await getUser();
  authListeners.forEach((f) => f(u));
}
export async function signIn() { await setSignedIn(true); }
export async function signUp() { await setSignedIn(true); return { needsConfirm: false }; }
export async function signOut() { await setSignedIn(false); }
export async function resetDemo() { localStorage.removeItem(KEY); }

export async function getProfile(id) { return delay(clone(load().profiles.find((p) => p.id === id) || null)); }
export async function updateProfile(id, patch) {
  return mutate((s) => { const p = s.profiles.find((x) => x.id === id); Object.assign(p, patch); return clone(p); });
}
export async function createGroup({ name, trek_date, trek_name }) {
  return mutate((s) => {
    const g = { id: uid(), name: name || 'Trek Crew', invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), trek_name: trek_name || 'Chopta – Tungnath – Chandrashila', trek_date: trek_date || null, climb_goal_m: 13200, created_by: s.me, created_at: new Date().toISOString() };
    s.groups.push(g);
    s.profiles.find((p) => p.id === s.me).group_id = g.id;
    return clone(g);
  });
}
export async function joinGroup(code) {
  return mutate((s) => {
    const g = s.groups.find((x) => x.invite_code === code.trim().toUpperCase());
    if (!g) throw new Error('That invite code does not match any crew (demo code: CH4NDR)');
    s.profiles.find((p) => p.id === s.me).group_id = g.id;
    return clone(g);
  });
}
export async function getGroup(id) { return delay(clone(load().groups.find((g) => g.id === id))); }
export async function updateGroup(id, patch) {
  return mutate((s) => { const g = s.groups.find((x) => x.id === id); Object.assign(g, patch); return clone(g); });
}
export async function getMembers(groupId) { return delay(clone(load().profiles.filter((p) => p.group_id === groupId))); }

export async function getActivities(groupId, sinceIso) {
  const s = load();
  const since = new Date(sinceIso);
  return delay(
    s.activities
      .filter((a) => a.group_id === groupId && new Date(a.started_at) >= since)
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .map((a) => ({
        ...clone(a),
        kudos: s.kudos.filter((k) => k.activity_id === a.id).map((k) => k.user_id),
        comment_count: s.comments.filter((c) => c.activity_id === a.id).length,
      }))
  );
}
export async function addActivity(act) {
  return mutate((s) => { const a = { id: uid(), created_at: new Date().toISOString(), ...act }; s.activities.push(a); return clone(a); });
}
export async function deleteActivity(id) {
  mutate((s) => {
    s.activities = s.activities.filter((a) => a.id !== id);
    s.kudos = s.kudos.filter((k) => k.activity_id !== id);
    s.comments = s.comments.filter((c) => c.activity_id !== id);
  });
}
export async function toggleKudos(activityId, userId, has) {
  mutate((s) => {
    s.kudos = s.kudos.filter((k) => !(k.activity_id === activityId && k.user_id === userId));
    if (!has) s.kudos.push({ activity_id: activityId, user_id: userId });
  });
}
export async function getComments(activityId) {
  return delay(clone(load().comments.filter((c) => c.activity_id === activityId).sort((a, b) => a.created_at.localeCompare(b.created_at))));
}
export async function addComment(activityId, userId, body) {
  return mutate((s) => { const c = { id: uid(), activity_id: activityId, user_id: userId, body, created_at: new Date().toISOString() }; s.comments.push(c); return clone(c); });
}
export async function deleteComment(id) { mutate((s) => { s.comments = s.comments.filter((c) => c.id !== id); }); }

export async function getChecklist(groupId) {
  const s = load();
  const items = s.items.filter((i) => i.group_id === groupId);
  const ids = new Set(items.map((i) => i.id));
  return delay(clone({ items, ticks: s.ticks.filter((t) => ids.has(t.item_id)) }));
}
export async function addChecklistItem(groupId, label, userId) {
  return mutate((s) => { const i = { id: uid(), group_id: groupId, label, created_by: userId, created_at: new Date().toISOString() }; s.items.push(i); return clone(i); });
}
export async function deleteChecklistItem(id) {
  mutate((s) => { s.items = s.items.filter((i) => i.id !== id); s.ticks = s.ticks.filter((t) => t.item_id !== id); });
}
export async function toggleTick(itemId, userId, has) {
  mutate((s) => {
    s.ticks = s.ticks.filter((t) => !(t.item_id === itemId && t.user_id === userId));
    if (!has) s.ticks.push({ item_id: itemId, user_id: userId });
  });
}

export async function pushLiveLocation(userId, groupId, lat, lng) {
  mutate((s) => {
    s.live = s.live.filter((l) => l.user_id !== userId);
    s.live.push({ user_id: userId, group_id: groupId, lat, lng, updated_at: new Date().toISOString() });
  });
}
export async function clearLiveLocation(userId) { mutate((s) => { s.live = s.live.filter((l) => l.user_id !== userId); }); }
export async function getLiveLocations(groupId) { return delay(clone(load().live.filter((l) => l.group_id === groupId))); }

// Same visibility as the database rules: crew chat + private messages you sent or received
export async function getMessages(groupId, limit = 500) {
  const s = load();
  return delay(clone(
    s.messages
      .filter((m) => m.group_id === groupId && (!m.recipient_id || m.sender_id === s.me || m.recipient_id === s.me))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-limit)
  ));
}
export async function sendMessage(groupId, senderId, recipientId, body) {
  return mutate((s) => {
    const m = { id: uid(), group_id: groupId, sender_id: senderId, recipient_id: recipientId || null, body, created_at: new Date().toISOString() };
    s.messages.push(m);
    return clone(m);
  });
}
export async function deleteMessage(id) { mutate((s) => { s.messages = s.messages.filter((m) => m.id !== id); }); }

export function subscribe(_groupId, cb) {
  dataListeners.add(cb);
  return () => dataListeners.delete(cb);
}
