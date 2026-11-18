// Vercel serverless function: POST /api/daily-room  { callId }
// Checks the signed-in Supabase user is allowed into this call, then creates (or reuses) a private Daily room
// and returns a short-lived token for it. The Daily API key never leaves the server.
//
// Env vars (Vercel → Settings → Environment Variables):
//   DAILY_API_KEY            from the Daily dashboard → Developers (no VITE_ prefix: it must stay secret)
//   VITE_SUPABASE_URL        already set for the app
//   VITE_SUPABASE_ANON_KEY   already set for the app

const DAILY = 'https://api.daily.co/v1';
const ROOM_HOURS = 6;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const dailyKey = process.env.DAILY_API_KEY;
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!dailyKey || !sbUrl || !sbKey) return res.status(503).json({ error: "Calls aren't set up yet (DAILY_API_KEY missing on the server)" });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const callId = String(req.body?.callId || '');
  if (!jwt) return res.status(401).json({ error: 'Not signed in' });
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return res.status(400).json({ error: 'Bad call id' });

  try {
    // 1. Who is this? (Supabase checks the token)
    const userRes = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: sbKey, Authorization: `Bearer ${jwt}` } });
    if (!userRes.ok) return res.status(401).json({ error: 'Please sign in again' });
    const user = await userRes.json();

    // 2. Are they allowed into this call? Runs as the user, so the database privacy rules apply.
    const infoRes = await fetch(`${sbUrl}/rest/v1/rpc/call_token_info`, {
      method: 'POST',
      headers: { apikey: sbKey, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_call: callId }),
    });
    const info = infoRes.ok ? await infoRes.json() : null;
    if (!info) return res.status(403).json({ error: 'This call has ended or is not yours' });

    // 3. Create the room, or reuse it if someone already joined
    const auth = { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' };
    const name = `ascent-${callId}`;
    const exp = Math.floor(Date.now() / 1000) + ROOM_HOURS * 3600;
    let room = await fetch(`${DAILY}/rooms/${name}`, { headers: auth });
    if (room.status === 404) {
      room = await fetch(`${DAILY}/rooms`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ name, privacy: 'private', properties: { exp, max_participants: 12, eject_at_room_exp: true } }),
      });
      // Two people joining at the same moment can both try to create it
      if (!room.ok) room = await fetch(`${DAILY}/rooms/${name}`, { headers: auth });
    }
    if (!room.ok) return res.status(502).json({ error: `Daily room error (${room.status})` });
    const roomData = await room.json();

    // 4. A token only for this room, this person, for a few hours
    const tok = await fetch(`${DAILY}/meeting-tokens`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ properties: { room_name: name, user_id: user.id, user_name: String(info.name || 'Trekker').slice(0, 40), exp } }),
    });
    if (!tok.ok) return res.status(502).json({ error: `Daily token error (${tok.status})` });
    const { token } = await tok.json();

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ url: roomData.url, token });
  } catch (e) {
    return res.status(500).json({ error: 'Could not start the call' });
  }
}
