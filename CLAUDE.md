# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Ascent — Trek Crew**: a private, Strava-like fitness tracker for a small group of friends training for a trek
(Chopta → Tungnath → Chandrashila, December 2026). It is an installable PWA (not a native app). Users record GPS
walks/runs/hikes, log stairs/treadmill incline manually, set daily targets, and see streaks, leaderboards, a readiness
score, a shared "crew climb", a 4-week plan, a packing checklist and live location on trek day.

Owner: Karthik. Python is his strongest language; explain JS/React decisions in plain language and keep changes simple.

## Commands

```bash
npm install          # Node 20.19+ required (Vite 8)
npm run dev          # dev server on :5173 (--host, so phones on the same Wi-Fi can open it)
npm run build        # production build to dist/ (also generates service worker + manifest)
npm run preview      # serve dist/ on :4173
```

No test runner or linter is configured. After any change, **`npm run build` must pass** and you should check the
affected screen in the browser in **both light and dark themes** and at **phone width (~390px)** and **desktop (~1440px)**.

## Stack

- React 18 + Vite 8 (`@vitejs/plugin-react` 6), plain JavaScript (JSX), no TypeScript
- `vite-plugin-pwa` (generateSW, autoUpdate) — config in `vite.config.js`
- Supabase (`@supabase/supabase-js` v2): Postgres + auth (email/password) + realtime
- Leaflet (used directly, not react-leaflet) with standard OpenStreetMap tiles (no key; dark mode = CSS filter on `.leaflet-tile-pane`; CARTO now needs a key)
- Font: Plus Jakarta Sans via `@fontsource-variable/plus-jakarta-sans` (bundled, works offline)
- No router library, no state library, no CSS framework, no chart library — keep it that way unless asked

## Architecture

```
src/main.jsx                 entry; imports font + styles.css
src/App.jsx                  auth/session, data loading, realtime subscription, app shell (rail, topbar, bottom nav)
src/lib/hooks.js             AppContext + useApp(), useTheme(), useWakeLock(), useTrackerController(), recovery helpers
src/lib/api/index.js         picks backend: exports `api`, `hasSupabase`, `getMode()`, `setMode()`
src/lib/api/supabaseApi.js   real backend
src/lib/api/localApi.js      demo backend (localStorage), same function signatures
src/lib/api/demoSeed.js      seeded fake 5-person crew + ~35 days of activities
src/lib/geo.js               GpsTracker class (filtering, elevation smoothing, pause/resume), haversine, simplify
src/lib/stats.js             all fitness maths: totals, streaks, readiness, leaderboard, badges, PLAN, TREK profile
src/lib/format.js            number/date/pace formatting, TYPES (activity types), shareText()
src/components/Icon.jsx      inline SVG icon set (`<Icon name="..."/>`) — add new icons here, don't add an icon library
src/components/bits.jsx      Avatar, AvatarStack, Pill, Segmented, Progress, Sheet (modal), Empty, CardHead
src/components/Charts.jsx    Lollipop, MountainProfile, VPill, Sparkbars, MiniRoute (all hand-written SVG)
src/components/RouteMap.jsx  Leaflet map (route polyline, "me" marker, crew markers), theme-aware tiles
src/screens/                 Auth, Onboarding, Home, Track, Feed, Crew, Plan, Profile
src/styles.css               ALL styling; design tokens at the top (light in :root, dark in [data-theme='dark'])
supabase/schema.sql          tables, RLS policies, RPCs, trigger, realtime publication (idempotent, re-runnable)
```

### Key patterns

- **Routing** is hash-based (`#home`, `#track`, `#feed`, `#crew`, `#plan`, `#profile`). Navigate with `go(tab)` from
  `useApp()`. `SCREENS`/`NAV` in `App.jsx` define tabs. Invite links use `/?join=CODE` (read in Onboarding).
- **Global state** lives in `App.jsx` and is exposed through `AppContext`: `user, profile, group, members, memberById,
  activities, checklist, live, refresh, go, toast, tracker, theme, pref, setPref, isDemo, signOut`.
  After any write, call `await refresh()` (realtime also triggers a debounced reload).
- **Two backends, one interface.** `localApi.js` and `supabaseApi.js` must export the **same functions with the same
  signatures and return shapes**. Any new data operation must be added to BOTH. Demo mode is used when no Supabase
  env vars are set, or when `localStorage['ascent-mode'] === 'demo'`.
- Activities returned by `getActivities` are **newest-first** and include `kudos: [user_id]` and `comment_count`.
  `stats.js` relies on newest-first ordering (e.g. `lastActive`).
- **Recording** state is held in `useTrackerController` at the App level so it survives tab switches. It also: ticks
  every second, keeps a wake lock, pushes live location every 30 s (if `profile.share_live`), writes a recovery copy to
  `localStorage['ascent-recording']` every 5 s, and warns on `beforeunload`.
- `GpsTracker` mutates `this.points` in place; components that depend on the route must also depend on
  `points.length` (see RouteMap) or copy the array.
- Dates: `trek_date` is a `YYYY-MM-DD` string. Use `isoDate()` / `daysUntil()` from `stats.js` — **never**
  `toISOString().slice(0,10)` for calendar dates (it shifts to UTC; users are in IST, UTC+5:30).
- Weeks start on Monday (`startOfWeek`). Locale formatting uses `'en-IN'`.

## Domain constants (in `src/lib/stats.js`)

- `TREK.gain_m = 1320` (Chopta ~2,680 m → Chandrashila ~4,000 m), profile points and landmarks for the chart.
- `READINESS_TARGETS`: weekly climb 1,000 m (40 pts), longest outing 10 km (20), biggest single climb 400 m (20),
  active days 12/21 (20). Labels: ≥75 "Summit ready", ≥45 "Getting there", else "Needs work".
- `PLAN`: 4 weeks ending the day before the trek (base → climb → peak → taper).
- Manual stairs = 3 m per floor; incline gain = distance × incline %.
- GPS filters in `geo.js`: ignore accuracy > 35 m, jitter < max(3 m, 0.4×accuracy), speed > 12 m/s; elevation uses
  EMA smoothing with a 4 m hysteresis step. Change these deliberately — they were validated with a simulated walk
  (1.11 km measured vs 1.11 km true; 96 m vs 99.5 m true climb with ±1.5 m altitude noise).

## Design system

The UI follows a reference "bento dashboard" style: soft grey-green canvas, white rounded cards (`--r: 26px`), mint
gradient cards (`.card.mint`), lime accent cards (`.card.lime`), ink pills/buttons, big light-weight numbers
(`.big-num`, font-weight ~250–300). Desktop has a left icon rail; ≤860px switches to a floating bottom nav with a
raised lime Record button.

Rules:
- **Use CSS variables only** (`--bg`, `--card`, `--card-2`, `--card-3`, `--text`, `--muted`, `--line`, `--lime`,
  `--on-lime`, `--mint-a`, `--mint-b`, `--ink`, `--on-ink`, …). Never hard-code colours in components, so dark mode
  keeps working. If you add a token, define it in **both** `:root` and `[data-theme='dark']`.
- Note `--ink` inverts in dark mode (dark pill in light theme, light pill in dark theme).
- Theme is applied via `document.documentElement.dataset.theme`; preference stored in `localStorage['ascent-theme']`
  (`light` | `dark` | `system`). `index.html` has an inline script to avoid a flash on load.
- Home uses a 12-column `.bento` grid with `.span-N` classes; on mobile every span becomes full width.
- Reuse components from `bits.jsx` and `Charts.jsx` before writing new ones. Keep charts as hand-written SVG.
- The owner will supply custom fonts/UI tweaks later: font is set by `--font` and the import in `main.jsx`.

## Database (Supabase)

`supabase/schema.sql` is the single source of truth. Tables: `groups`, `profiles`, `activities`, `kudos`, `comments`,
`checklist_items`, `checklist_ticks`, `live_locations`.

- Every table has RLS. Access is scoped through `public.my_group_id()` (security definer) — users only see their crew.
- Profiles are created by the `on_auth_user_created` trigger. Joining/creating crews **only** via RPCs
  `create_group(p_name, p_trek_date, p_trek_name)` and `join_group(p_code)`; the profile update policy forbids changing
  `group_id` directly.
- All tables are in the `supabase_realtime` publication; `api.subscribe()` listens to them.
- Keep the script **idempotent** (`create table if not exists`, `drop policy if exists` + `create policy`,
  `create or replace function`). When changing the schema, update the SQL file and tell the owner to re-run it in the
  Supabase SQL Editor. There is no migration tool.
- The schema was verified with PGlite (stubbed `auth` schema): re-runnable, outsiders can't read/insert, sneak-joins
  blocked, realtime tables registered. If you change policies, re-verify the same cases.
- Never use or ask for the `service_role` key in the frontend. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Environment

`.env` (git-ignored), copied from `.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Empty values → app runs in demo mode only.

## Deployment

Vercel (or Netlify/Cloudflare Pages): build `npm run build`, output `dist`, set the two env vars. HTTPS is required for
GPS. Set Supabase Auth "Site URL" to the deployed URL. Pushes to the main branch redeploy automatically; the service
worker auto-updates clients. Full steps are in `README.md` — keep it in sync with any setup change.

## Known limitations / roadmap

- PWA cannot record GPS with the screen locked or app backgrounded. Planned path: wrap with **Capacitor** + a
  background-geolocation plugin, feeding positions into `GpsTracker.onPosition()` (see README "Going native").
- No step counting (browsers can't read the pedometer); targets are distance, climb and active minutes.
- Nudges use `navigator.share` / WhatsApp link, not push notifications. Web push would need a service-worker push
  handler + a Supabase Edge Function — not built yet.
- No editing of saved activities (delete + re-log). No comment deletion UI (API exists).
- Activities older than 120 days are not loaded (`loadCrew` in `App.jsx`).

## Working conventions

- Keep the demo backend fully working — it's how the UI is previewed without Supabase. Use "Reset demo data" in
  the Profile screen (or clear `localStorage['ascent-demo-v1']`) after changing `demoSeed.js`.
- Prefer small, focused changes; don't introduce TypeScript, Tailwind, a router, a state library or a UI kit unless
  explicitly asked.
- User-facing copy: short, plain, friendly; Indian English and `en-IN` number formatting.
- Fitness guidance in the UI stays general (the Plan screen already carries a "check with a doctor" note).
- Don't commit `.env`, `node_modules`, `dist`, or `dev-dist`.
