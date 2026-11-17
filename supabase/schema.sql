-- ─────────────────────────────────────────────────────────────
-- Ascent — Trek Crew : database schema for Supabase
-- Run this whole file once in Supabase → SQL Editor → New query.
-- ─────────────────────────────────────────────────────────────

-- Groups (one crew per trek)
create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  invite_code   text not null unique,
  trek_name     text not null default 'Chopta – Tungnath – Chandrashila',
  trek_date     date,
  climb_goal_m  integer not null default 13200,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- One profile per user
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null default 'Trekker',
  color           text not null default '#CFE6D6',
  group_id        uuid references public.groups(id) on delete set null,
  target_km       numeric not null default 4,
  target_elev_m   integer not null default 100,
  target_minutes  integer not null default 45,
  share_live      boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.activities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  group_id          uuid not null references public.groups(id) on delete cascade,
  type              text not null,
  title             text,
  note              text,
  started_at        timestamptz not null,
  duration_s        integer not null default 0 check (duration_s >= 0),
  distance_m        numeric not null default 0 check (distance_m >= 0),
  elevation_gain_m  numeric not null default 0 check (elevation_gain_m >= 0),
  route             jsonb,
  source            text not null default 'gps' check (source in ('gps','manual')),
  created_at        timestamptz not null default now()
);
create index if not exists activities_group_time on public.activities (group_id, started_at desc);
-- Allowed activity types (re-created each run so new types like 'cycle' reach existing databases)
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in ('walk','run','hike','cycle','stairs','incline','other'));

create table if not exists public.kudos (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists comments_activity on public.comments (activity_id, created_at);

create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 80),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.checklist_ticks (
  item_id  uuid not null references public.checklist_items(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (item_id, user_id)
);

-- Last known position while someone is recording (for trek day)
create table if not exists public.live_locations (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  updated_at  timestamptz not null default now()
);

-- Chat: recipient_id null = crew chat (everyone in the crew), otherwise a private message between two members
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid references public.profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 1000),
  created_at    timestamptz not null default now()
);
create index if not exists messages_group_time on public.messages (group_id, created_at desc);

-- ── Helpers ──────────────────────────────────────────────────
create or replace function public.my_group_id()
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.profiles where id = auth.uid()
$$;

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, color)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    (array['#CFE6D6','#E6F46A','#F2D3B3','#C9D6F2','#E8C6E0','#BFE3E0'])[1 + floor(random()*6)::int]
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a crew and join it
create or replace function public.create_group(p_name text, p_trek_date date, p_trek_name text default null)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups; code text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups (name, invite_code, trek_date, trek_name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Trek Crew'), code, p_trek_date,
          coalesce(nullif(trim(p_trek_name), ''), 'Chopta – Tungnath – Chandrashila'), auth.uid())
  returning * into g;
  update public.profiles set group_id = g.id where id = auth.uid();
  return g;
end $$;

-- Join a crew with its invite code
create or replace function public.join_group(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'That invite code does not match any crew'; end if;
  update public.profiles set group_id = g.id where id = auth.uid();
  return g;
end $$;

grant execute on function public.create_group(text, date, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ── Row level security: you only ever see your own crew ─────
alter table public.groups          enable row level security;
alter table public.profiles        enable row level security;
alter table public.activities      enable row level security;
alter table public.kudos           enable row level security;
alter table public.comments        enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_ticks enable row level security;
alter table public.live_locations  enable row level security;
alter table public.messages        enable row level security;

drop policy if exists "crew reads group" on public.groups;
create policy "crew reads group" on public.groups for select using (id = public.my_group_id());
drop policy if exists "crew updates group" on public.groups;
create policy "crew updates group" on public.groups for update using (id = public.my_group_id());

drop policy if exists "read self and crew" on public.profiles;
create policy "read self and crew" on public.profiles for select
  using (id = auth.uid() or (group_id is not null and group_id = public.my_group_id()));
drop policy if exists "update self" on public.profiles;
create policy "update self" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and group_id is not distinct from public.my_group_id());

drop policy if exists "crew reads activities" on public.activities;
create policy "crew reads activities" on public.activities for select using (group_id = public.my_group_id());
drop policy if exists "insert own activity" on public.activities;
create policy "insert own activity" on public.activities for insert
  with check (user_id = auth.uid() and group_id = public.my_group_id());
drop policy if exists "update own activity" on public.activities;
create policy "update own activity" on public.activities for update using (user_id = auth.uid());
drop policy if exists "delete own activity" on public.activities;
create policy "delete own activity" on public.activities for delete using (user_id = auth.uid());

drop policy if exists "crew reads kudos" on public.kudos;
create policy "crew reads kudos" on public.kudos for select
  using (exists (select 1 from public.activities a where a.id = activity_id and a.group_id = public.my_group_id()));
drop policy if exists "give kudos" on public.kudos;
create policy "give kudos" on public.kudos for insert
  with check (user_id = auth.uid() and exists (select 1 from public.activities a where a.id = activity_id and a.group_id = public.my_group_id()));
drop policy if exists "remove own kudos" on public.kudos;
create policy "remove own kudos" on public.kudos for delete using (user_id = auth.uid());

drop policy if exists "crew reads comments" on public.comments;
create policy "crew reads comments" on public.comments for select
  using (exists (select 1 from public.activities a where a.id = activity_id and a.group_id = public.my_group_id()));
drop policy if exists "write comment" on public.comments;
create policy "write comment" on public.comments for insert
  with check (user_id = auth.uid() and exists (select 1 from public.activities a where a.id = activity_id and a.group_id = public.my_group_id()));
drop policy if exists "delete own comment" on public.comments;
create policy "delete own comment" on public.comments for delete using (user_id = auth.uid());

drop policy if exists "crew checklist read" on public.checklist_items;
create policy "crew checklist read" on public.checklist_items for select using (group_id = public.my_group_id());
drop policy if exists "crew checklist add" on public.checklist_items;
create policy "crew checklist add" on public.checklist_items for insert with check (group_id = public.my_group_id());
drop policy if exists "crew checklist delete" on public.checklist_items;
create policy "crew checklist delete" on public.checklist_items for delete using (group_id = public.my_group_id());

drop policy if exists "crew ticks read" on public.checklist_ticks;
create policy "crew ticks read" on public.checklist_ticks for select
  using (exists (select 1 from public.checklist_items i where i.id = item_id and i.group_id = public.my_group_id()));
drop policy if exists "tick own" on public.checklist_ticks;
create policy "tick own" on public.checklist_ticks for insert
  with check (user_id = auth.uid() and exists (select 1 from public.checklist_items i where i.id = item_id and i.group_id = public.my_group_id()));
drop policy if exists "untick own" on public.checklist_ticks;
create policy "untick own" on public.checklist_ticks for delete using (user_id = auth.uid());

drop policy if exists "crew live read" on public.live_locations;
create policy "crew live read" on public.live_locations for select using (group_id = public.my_group_id());
drop policy if exists "live insert own" on public.live_locations;
create policy "live insert own" on public.live_locations for insert
  with check (user_id = auth.uid() and group_id = public.my_group_id());
drop policy if exists "live update own" on public.live_locations;
create policy "live update own" on public.live_locations for update
  using (user_id = auth.uid()) with check (group_id = public.my_group_id());
drop policy if exists "live delete own" on public.live_locations;
create policy "live delete own" on public.live_locations for delete using (user_id = auth.uid());

-- Crew chat is visible to the whole crew; a private message only to its sender and recipient
drop policy if exists "read crew chat and own dms" on public.messages;
create policy "read crew chat and own dms" on public.messages for select
  using (group_id = public.my_group_id()
         and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid()));
drop policy if exists "send message" on public.messages;
create policy "send message" on public.messages for insert
  with check (sender_id = auth.uid() and group_id = public.my_group_id()
              and (recipient_id is null
                   or (recipient_id <> auth.uid()
                       and exists (select 1 from public.profiles p where p.id = recipient_id and p.group_id = public.my_group_id()))));
drop policy if exists "delete own message" on public.messages;
create policy "delete own message" on public.messages for delete using (sender_id = auth.uid());

-- ── Realtime: push changes to everyone's app instantly ──────
do $$
declare t text;
begin
  foreach t in array array['activities','kudos','comments','checklist_items','checklist_ticks','live_locations','profiles','groups','messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
