// Chat helpers: which conversation a message belongs to, and unread counts.
// "Read up to" times are kept per device in localStorage (no server table needed for a small crew).

// 'crew' for the crew chat, otherwise the other person's id
export const threadKeyOf = (m, me) => (!m.recipient_id ? 'crew' : m.sender_id === me ? m.recipient_id : m.sender_id);

const storeKey = (uid) => `ascent-chat-read-${uid}`;

export function loadRead(uid) {
  try { return JSON.parse(localStorage.getItem(storeKey(uid)) || '{}') || {}; } catch { return {}; }
}

export function saveRead(uid, read) {
  try { localStorage.setItem(storeKey(uid), JSON.stringify(read)); } catch { /* storage blocked */ }
}

const t = (iso) => new Date(iso).getTime();

// read = { _since: iso (first time chat was seen on this device), [threadKey]: iso }
export function unreadCounts(messages, me, read) {
  const out = { total: 0 };
  if (!read?._since) return out;
  messages.forEach((m) => {
    if (m.sender_id === me) return;
    const k = threadKeyOf(m, me);
    if (t(m.created_at) > t(read[k] || read._since)) {
      out[k] = (out[k] || 0) + 1;
      out.total += 1;
    }
  });
  return out;
}

// On a device's first run, treat everything up to your own latest message (or now) as read
export function firstRunSince(messages, me) {
  const mine = messages.filter((m) => m.sender_id === me);
  return mine.length ? mine[mine.length - 1].created_at : new Date().toISOString();
}
