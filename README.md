# Ascent — Trek Crew

A private fitness tracker for a small group of friends preparing for a trek (set up for Chopta → Tungnath → Chandrashila).
It's like Strava, but only your crew can see it: GPS walk/run/hike tracking, stair and incline logging, daily targets,
streaks, leaderboards, a trek readiness score, a shared "crew climb", a 4-week plan, a packing checklist and live
location on trek day. Light and dark themes included.

It's a **Progressive Web App (PWA)**: you deploy it once and send a link. Friends open it on their phone and tap
"Add to Home Screen", and it then opens full-screen like a normal app. No Play Store or App Store needed.

---

## 1. Run it on your laptop (2 minutes)

Install Node.js 22 LTS (https://nodejs.org; anything from 20.19 up works, older 20.x versions fail to build), then:

```bash
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173). With no backend connected, it runs in **demo mode** with a
fake crew, so you can click through everything.

To try it on your phone over the same Wi-Fi, open the `Network:` URL that `npm run dev` prints. GPS only works over
HTTPS though, so for real tracking use the deployed version (step 3).

## 2. Create the backend (Supabase, free, ~5 minutes)

Supabase stores accounts, activities and the checklist, and pushes live updates to everyone's phone.

1. Sign up at https://supabase.com and create a new project (pick the Mumbai region if offered; it's closest to you).
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**.
   It creates the tables, the privacy rules (people only ever see their own crew) and realtime.
   It's safe to run again later.
3. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email".
   This is optional but recommended for a friends-only app: people can sign in straight away without waiting for an email.
   (Supabase's free email sending is heavily rate-limited.)
4. Go to **Project Settings → API** (shown as "Data API" / "API Keys" in some versions) and copy:
   - Project URL
   - `anon` / publishable key (**not** the `service_role` secret key)
5. In this folder, copy `.env.example` to `.env` and paste them in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart `npm run dev`. You'll now see the real sign-in screen. The demo is still available from a button on that screen.

## 3. Deploy it (Vercel, free, ~5 minutes)

1. Push this folder to a GitHub repo (`.env` is git-ignored, so your keys won't be committed).
2. Go to https://vercel.com → **Add New → Project** → import the repo. Vercel detects Vite automatically
   (build command `npm run build`, output folder `dist`).
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values.
4. Click **Deploy**. You get an `https://your-app.vercel.app` link with HTTPS, which GPS needs.
5. Back in Supabase → **Authentication → URL Configuration**, set **Site URL** to that Vercel link.

Netlify or Cloudflare Pages work the same way (build `npm run build`, publish `dist`, same two env variables).

When you push changes to GitHub later, Vercel redeploys automatically, and the app on everyone's phone updates itself
the next time they open it.

## 4. Get your friends in

1. You sign up, choose **Create a crew**, and set the trek date.
2. Go to **Crew → Share link**. It sends an invite link with the code built in (e.g. `…/?join=FBD4E7`).
3. Friends open the link, create an account, and the code is pre-filled.
4. Install on the phone:
   - **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*
   - **iPhone (Safari):** Share button → *Add to Home Screen*

## How GPS tracking works (and its limits)

- Tap **Record** → pick Walk / Run / Hike → start. Distance, time, pace and elevation gained update live.
- The app keeps the screen awake while recording. **Keep the app open on screen during an activity.**
  Web apps can't record GPS in the background or with the screen locked. That's the one real trade-off
  versus a Play Store app (see "Going native" below).
- GPS noise is filtered: fixes worse than ±35 m are ignored, jitter while standing still isn't counted, and impossible
  jumps (> 43 km/h) are dropped. Elevation uses smoothed altitude with a 4 m threshold, so noise doesn't add fake climb.
- Some phones don't report altitude. When saving, you can type the climb in yourself.
- If the phone kills the tab mid-walk, a recovery copy is kept and the app offers to save it next time.
- **Stairs / treadmill:** use **Log manually**. Stairs count as about 3 m per floor; incline = distance × incline %.
  Since Hyderabad and Nellore are fairly flat, stairs are the best way to train for the climb.
- Live location: while someone is recording, their position is shared with the crew every 30 s
  (each person can turn this off in **You → Share live location**). On trek day, everyone taps Record at Chopta.

## The readiness score

Out of 100, from the last 3 weeks:

| Part | Points | Full marks at |
|---|---|---|
| Average weekly climbing | 40 | 1,000 m / week |
| Longest single outing | 20 | 10 km |
| Biggest single climb | 20 | 400 m |
| Active days | 20 | 12 of 21 days |

75+ = "Summit ready", 45–74 = "Getting there". Change the numbers in `src/lib/stats.js` → `READINESS_TARGETS`.
The 4-week plan is in the same file (`PLAN`). This is general fitness guidance only. Anyone with a heart, lung or knee
condition should check with a doctor first.

## Project structure

```
supabase/schema.sql        database tables, privacy rules, realtime
src/lib/api/               supabaseApi.js (real backend), localApi.js + demoSeed.js (demo mode)
src/lib/geo.js             GPS recorder with filtering + elevation smoothing
src/lib/stats.js           readiness, streaks, leaderboard, badges, plan, crew climb, trek profile
src/lib/hooks.js           theme (light/dark/auto), wake lock, recording state
src/screens/               Home, Track, Feed, Crew, Plan, Profile, Auth, Onboarding
src/components/            charts (lollipop, mountain profile, pill sliders), map, icons
src/styles.css             all styling; colour tokens for light + dark at the top
```

To change the look, edit the variables at the top of `src/styles.css` (`--lime`, `--mint-a`, `--bg`, the dark
block, …). The font is Plus Jakarta Sans, bundled locally. To swap it, `npm i @fontsource-variable/<font>`, change
the import in `src/main.jsx` and `--font` in the CSS.

## Going native later (background GPS)

If the group wants recording to continue with the screen locked, wrap this same code with **Capacitor**:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init Ascent com.yourname.ascent --web-dir dist
npm run build && npx cap add android && npx cap open android
```

Then add a background-geolocation plugin (e.g. `@capacitor-community/background-geolocation`) and feed its positions
into `GpsTracker.onPosition()` in `src/lib/geo.js`. Everything else stays the same. Install the APK directly on
friends' Android phones; no Play Store listing is needed.

## Map tiles

Maps use the standard OpenStreetMap tiles (no API key needed), which are fine for light, non-commercial use like this.
Dark mode darkens the same tiles with a CSS filter. (CARTO basemaps were used earlier but now need an API key.)
Attribution is shown on the map.
