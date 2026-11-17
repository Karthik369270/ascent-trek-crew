import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export const isDemo = false;

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const num = (v) => (v == null ? 0 : Number(v));

// ── Auth ────────────────────────────────────────────────────
export async function getUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ── Profiles & crew ─────────────────────────────────────────
export async function getProfile(id) {
  // The profile row is created by a database trigger right after sign-up; retry briefly in case it lags.
  for (let i = 0; i < 4; i++) {
    const row = must(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
    if (row) return normProfile(row);
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function normProfile(p) {
  return { ...p, target_km: num(p.target_km), target_elev_m: num(p.target_elev_m), target_minutes: num(p.target_minutes) };
}

export async function updateProfile(id, patch) {
  return normProfile(must(await supabase.from('profiles').update(patch).eq('id', id).select().single()));
}

export async function createGroup({ name, trek_date, trek_name }) {
  return must(await supabase.rpc('create_group', { p_name: name, p_trek_date: trek_date || null, p_trek_name: trek_name || null }));
}

export async function joinGroup(code) {
  return must(await supabase.rpc('join_group', { p_code: code }));
}

export async function getGroup(id) {
  return must(await supabase.from('groups').select('*').eq('id', id).single());
}

export async function updateGroup(id, patch) {
  return must(await supabase.from('groups').update(patch).eq('id', id).select().single());
}

export async function getMembers(groupId) {
  const rows = must(await supabase.from('profiles').select('*').eq('group_id', groupId).order('created_at'));
  return rows.map(normProfile);
}

// ── Activities ──────────────────────────────────────────────
export async function getActivities(groupId, sinceIso) {
  const rows = must(
    await supabase
      .from('activities')
      .select('*, kudos(user_id), comments(count)')
      .eq('group_id', groupId)
      .gte('started_at', sinceIso)
      .order('started_at', { ascending: false })
      .limit(2000)
  );
  return rows.map((r) => ({
    ...r,
    distance_m: num(r.distance_m),
    elevation_gain_m: num(r.elevation_gain_m),
    kudos: (r.kudos || []).map((k) => k.user_id),
    comment_count: r.comments?.[0]?.count ?? 0,
    comments: undefined,
  }));
}

export async function addActivity(act) {
  return must(await supabase.from('activities').insert(act).select().single());
}

export async function deleteActivity(id) {
  must(await supabase.from('activities').delete().eq('id', id));
}

export async function toggleKudos(activityId, userId, has) {
  if (has) must(await supabase.from('kudos').delete().match({ activity_id: activityId, user_id: userId }));
  else must(await supabase.from('kudos').insert({ activity_id: activityId, user_id: userId }));
}

export async function getComments(activityId) {
  return must(await supabase.from('comments').select('*').eq('activity_id', activityId).order('created_at'));
}

export async function addComment(activityId, userId, body) {
  return must(await supabase.from('comments').insert({ activity_id: activityId, user_id: userId, body }).select().single());
}

export async function deleteComment(id) {
  must(await supabase.from('comments').delete().eq('id', id));
}

// ── Checklist ───────────────────────────────────────────────
export async function getChecklist(groupId) {
  const items = must(await supabase.from('checklist_items').select('*').eq('group_id', groupId).order('created_at'));
  const ticks = items.length
    ? must(await supabase.from('checklist_ticks').select('item_id,user_id').in('item_id', items.map((i) => i.id)))
    : [];
  return { items, ticks };
}

export async function addChecklistItem(groupId, label, userId) {
  return must(await supabase.from('checklist_items').insert({ group_id: groupId, label, created_by: userId }).select().single());
}

export async function deleteChecklistItem(id) {
  must(await supabase.from('checklist_items').delete().eq('id', id));
}

export async function toggleTick(itemId, userId, has) {
  if (has) must(await supabase.from('checklist_ticks').delete().match({ item_id: itemId, user_id: userId }));
  else must(await supabase.from('checklist_ticks').insert({ item_id: itemId, user_id: userId }));
}

// ── Live location (only while recording) ────────────────────
export async function pushLiveLocation(userId, groupId, lat, lng) {
  must(await supabase.from('live_locations').upsert({ user_id: userId, group_id: groupId, lat, lng, updated_at: new Date().toISOString() }));
}

export async function clearLiveLocation(userId) {
  must(await supabase.from('live_locations').delete().eq('user_id', userId));
}

export async function getLiveLocations(groupId) {
  return must(await supabase.from('live_locations').select('*').eq('group_id', groupId));
}

// ── Realtime ────────────────────────────────────────────────
export function subscribe(groupId, cb) {
  const g = `group_id=eq.${groupId}`;
  const ch = supabase
    .channel(`crew-${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: g }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kudos' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: g }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_ticks' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations', filter: g }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: g }, cb)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export async function resetDemo() {}
