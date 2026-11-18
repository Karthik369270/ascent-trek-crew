// Vercel serverless function: POST /api/call-token  { callId }
// Checks the signed-in Supabase user is allowed into this call, then returns a short-lived Agora token for it.
// The Agora certificate never leaves the server.
//
// Env vars (Vercel → Settings → Environment Variables):
//   AGORA_APP_ID             Agora console → your project → App ID
//   AGORA_APP_CERTIFICATE    Agora console → your project → Primary Certificate (secret: no VITE_ prefix)
//   VITE_SUPABASE_URL        already set for the app
//   VITE_SUPABASE_ANON_KEY   already set for the app
import agoraToken from 'agora-token';

const { RtcTokenBuilder, RtcRole } = agoraToken;
const TOKEN_SECONDS = 6 * 3600;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const appId = process.env.AGORA_APP_ID;
  const cert = process.env.AGORA_APP_CERTIFICATE;
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!appId || !cert || !sbUrl || !sbKey) return res.status(503).json({ error: "Calls aren't set up yet (Agora keys missing on the server)" });

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

    // 3. A token for this call's channel only, for this person (their user id is their Agora id)
    const channel = `ascent-${callId}`;
    const token = RtcTokenBuilder.buildTokenWithUserAccount(appId, cert, channel, user.id, RtcRole.PUBLISHER, TOKEN_SECONDS, TOKEN_SECONDS);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ appId, channel, token, uid: user.id });
  } catch (e) {
    return res.status(500).json({ error: 'Could not start the call' });
  }
}
