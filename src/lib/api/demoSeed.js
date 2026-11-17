// Generates a believable month of training data for a 5-person crew, so the demo looks alive.

function rng(seed) {
  // mulberry32
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

function loopRoute(r, lat0, lng0, km) {
  // A wobbly closed loop roughly `km` long
  const n = 80;
  const radius = (km * 1000) / (2 * Math.PI); // metres
  const pts = [];
  let wob = 0;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    wob += (r() - 0.5) * 0.12;
    wob *= 0.92;
    const rr = radius * (1 + wob + 0.18 * Math.sin(a * 3 + r()));
    const dLat = (rr * Math.cos(a)) / 111320;
    const dLng = (rr * Math.sin(a)) / (111320 * Math.cos((lat0 * Math.PI) / 180));
    pts.push([+(lat0 + dLat).toFixed(6), +(lng0 + dLng).toFixed(6)]);
  }
  return pts;
}

export function makeSeed() {
  const r = rng(2026);
  const now = new Date();
  const me = uid();
  const groupId = uid();
  const trek = new Date(now);
  trek.setDate(trek.getDate() + 30);

  const people = [
    { id: me, name: 'You', color: '#E6F46A', p: 0.6, power: 1 },
    { id: uid(), name: 'Arjun', color: '#CFE6D6', p: 0.75, power: 1.3 },
    { id: uid(), name: 'Meera', color: '#F2D3B3', p: 0.65, power: 1.1 },
    { id: uid(), name: 'Rahul', color: '#C9D6F2', p: 0.35, power: 0.8 },
    { id: uid(), name: 'Sneha', color: '#E8C6E0', p: 0.55, power: 1 },
  ];
  const homes = [
    [17.4239, 78.4738], [17.4126, 78.4071], [17.4483, 78.3915], [17.3850, 78.4867], [17.4399, 78.4983],
  ];

  const profiles = people.map((p, i) => ({
    id: p.id, name: p.name, color: p.color, group_id: groupId,
    target_km: 4, target_elev_m: 100, target_minutes: 45, share_live: true,
    created_at: new Date(now.getTime() - 40 * 864e5 + i * 1000).toISOString(),
  }));

  const activities = [];
  const kudos = [];
  const comments = [];
  const titles = {
    walk: ['Morning walk', 'Evening loop', 'Lake walk', 'Post-dinner walk'],
    run: ['Easy run', 'Tempo run', 'Sunday long run'],
    hike: ['Hill hike', 'Weekend trail', 'Rock climb practice'],
    stairs: ['Apartment stairs', 'Office stairwell', 'Stair repeats'],
    incline: ['Treadmill incline', 'Gym incline walk'],
  };

  for (let d = 34; d >= 0; d--) {
    people.forEach((p, i) => {
      // Rahul went quiet for the last few days so the "nudge" card has someone to nudge
      if (p.name === 'Rahul' && d < 5) return;
      if (d === 0 && i !== 1) return; // only Arjun has logged today; "You" start fresh
      const ramp = 0.6 + 0.4 * ((34 - d) / 34);
      const forced = (p.name === 'You' && [1, 2, 4, 5].includes(d)) || (['Meera', 'Sneha'].includes(p.name) && [1, 2].includes(d));
      if (!forced && r() > p.p * ramp) return;
      const roll = r();
      const type = roll < 0.45 ? 'walk' : roll < 0.6 ? 'run' : roll < 0.8 ? 'stairs' : roll < 0.9 ? 'incline' : 'hike';
      const day = new Date(now);
      day.setDate(day.getDate() - d);
      day.setHours(r() < 0.55 ? 6 : 18, Math.floor(r() * 50), 0, 0);
      if (day > now) day.setTime(now.getTime() - 3600e3);
      let km = 0, elev = 0, mins = 0, route = null, source = 'gps';
      const s = p.power * ramp;
      if (type === 'walk') { km = 3 + r() * 5 * s; elev = 15 + r() * 60; mins = km * 12; }
      if (type === 'run') { km = 3 + r() * 6 * s; elev = 20 + r() * 50; mins = km * 6.5; }
      if (type === 'hike') { km = 6 + r() * 6 * s; elev = 250 + r() * 450 * s; mins = km * 18; }
      if (type === 'stairs') { elev = 90 + r() * 300 * s; mins = elev / 9; source = 'manual'; }
      if (type === 'incline') { km = 3 + r() * 3; elev = km * 1000 * (0.06 + r() * 0.06); mins = km * 13; source = 'manual'; }
      if (source === 'gps') route = loopRoute(r, homes[i][0] + (r() - 0.5) * 0.02, homes[i][1] + (r() - 0.5) * 0.02, km);
      const pick = titles[type];
      const id = uid();
      activities.push({
        id, user_id: p.id, group_id: groupId, type, title: pick[Math.floor(r() * pick.length)], note: null,
        started_at: day.toISOString(), duration_s: Math.round(mins * 60), distance_m: Math.round(km * 1000),
        elevation_gain_m: Math.round(elev), route, source, created_at: day.toISOString(),
      });
      people.forEach((q) => { if (q.id !== p.id && r() < 0.45) kudos.push({ activity_id: id, user_id: q.id }); });
      if (r() < 0.12) {
        const q = people[Math.floor(r() * people.length)];
        if (q.id !== p.id) comments.push({ id: uid(), activity_id: id, user_id: q.id, body: ['Beast mode 🔥', 'Chandrashila is calling!', 'Next time I’m joining', 'Those stairs though 😮‍💨', 'Solid climb!'][Math.floor(r() * 5)], created_at: new Date(day.getTime() + 3600e3).toISOString() });
      }
    });
  }

  const items = ['Down jacket', 'Gloves & beanie', 'Head torch + spare batteries', 'Broken-in trekking shoes', 'ID card + photocopies', 'Power bank', 'Rain poncho', 'Basic first-aid kit'].map((label) => ({ id: uid(), group_id: groupId, label, created_by: me, created_at: now.toISOString() }));
  const ticks = [];
  items.forEach((it) => people.forEach((p) => { if (p.id !== me && r() < 0.4) ticks.push({ item_id: it.id, user_id: p.id }); }));

  const live = [
    { user_id: people[1].id, group_id: groupId, lat: 17.4245, lng: 78.4135, updated_at: new Date(now.getTime() - 6 * 60e3).toISOString() },
    { user_id: people[2].id, group_id: groupId, lat: 17.4472, lng: 78.3951, updated_at: new Date(now.getTime() - 22 * 60e3).toISOString() },
  ];

  // A little chat history. The last two arrive after "You" last wrote, so they show as unread.
  const ago = (min) => new Date(now.getTime() - min * 60e3).toISOString();
  const [, arjun, meera, rahul, sneha] = people;
  const msg = (from, to, body, min) => ({ id: uid(), group_id: groupId, sender_id: from.id, recipient_id: to ? to.id : null, body, created_at: ago(min) });
  const messages = [
    msg(arjun, null, 'Morning crew! Who’s up for stairs at 6 tomorrow?', 26 * 60),
    msg(sneha, null, 'Me 🙋‍♀️ My building has 14 floors', 25 * 60),
    msg(people[0], null, 'Count me in', 24 * 60),
    msg(rahul, null, 'Knee is a bit sore, skipping this week', 20 * 60),
    msg(meera, rahul, 'Take it easy, ice it tonight. Want me to send the stretches I do?', 19 * 60),
    msg(people[0], arjun, 'Do you have a spare head torch for the trek?', 5 * 60),
    msg(arjun, people[0], 'Yes, I have two. Will bring one', 4 * 60),
    msg(people[0], null, 'Packing list is up in the Plan tab, tick what you have', 3 * 60),
    msg(meera, people[0], 'Did you book the Haridwar train yet?', 70),
    msg(arjun, null, '400 m of stairs done 🔥 Chandrashila here we come', 40),
  ];

  return {
    messages,
    signedIn: false,
    me,
    groups: [{ id: groupId, name: 'Chandrashila Crew', invite_code: 'CH4NDR', trek_name: 'Chopta – Tungnath – Chandrashila', trek_date: `${trek.getFullYear()}-${String(trek.getMonth() + 1).padStart(2, '0')}-${String(trek.getDate()).padStart(2, '0')}`, climb_goal_m: 20000, created_by: me, created_at: now.toISOString() }],
    profiles, activities, kudos, comments, items, ticks, live,
  };
}
