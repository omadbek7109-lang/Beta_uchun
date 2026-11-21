-- DAMEO 0031: DAMEO Pass (season pass). DRAFT — built and tested in the BETA (demo adapter); test on a separate
-- Supabase project / branch before applying to the main DAMEO database.
--  * Seasons of 14 days from pass_settings.anchor (00:00 Asia/Tashkent), 20 levels, two tracks: free and elite.
--  * XP is NEVER reported by the client: it is derived at read/claim time from server-owned rows
--    (finished, validated matches; mission_claims; referral_rewards; pass_checkins). Per-day caps, then a daily cap.
--  * Every reward is claimed by the player ("Olish"), once per season/level/track (PK + advisory lock).
--  * Items are only non-limited catalog items (no Limited Edition serial is ever consumed); an owned item pays coins.
--  * Elite is bought once per season with DAMEO Coins (Stars invoice: later, through the payments function).
-- Same rules as src/services/pass/core.ts (unit-tested there). Additive only: new tables and functions.

/* ================================================================= config */
create table if not exists public.pass_settings (
  id               boolean primary key default true check (id),
  anchor           date not null default '2026-11-16',
  season_days      int  not null default 14  check (season_days between 7 and 60),
  price_coins      int  not null default 3000 check (price_coins between 0 and 100000),
  price_stars      int  not null default 99   check (price_stars between 1 and 10000),
  elite_boost_pct  int  not null default 20   check (elite_boost_pct between 0 and 100),
  daily_cap        int  not null default 1000 check (daily_cap between 0 and 10000),
  min_moves        int  not null default 12   check (min_moves between 0 and 200),
  xp_live_game     int  not null default 15,
  xp_live_win      int  not null default 25,
  xp_bot_win       int  not null default 10,
  xp_checkin       int  not null default 25,
  xp_mission       int  not null default 20,
  xp_mission_bonus int  not null default 40,
  xp_referral      int  not null default 150,
  live_per_day     int  not null default 20,
  bot_wins_per_day int  not null default 10,
  referrals_per_season int not null default 5,
  updated_at       timestamptz not null default now()
);
insert into public.pass_settings (id) values (true) on conflict do nothing;

-- cumulative XP needed for each level (level 1 = 0). Steps: 2–5: 150, 6–10: 250, 11–15: 350, 16–20: 450 → 5 850.
create or replace function public._pass_level_xp(p_level int) returns int
language sql immutable as $$
  select case when p_level <= 1 then 0 else
    (select sum(case when n <= 5 then 150 when n <= 10 then 250 when n <= 15 then 350 else 450 end)::int
       from generate_series(2, least(p_level, 20)) n) end
$$;
create or replace function public._pass_level(p_xp int) returns int
language sql immutable as $$
  select coalesce(max(l), 1) from generate_series(1, 20) l where public._pass_level_xp(l) <= p_xp
$$;

create table if not exists public.pass_rewards (
  level          int  not null check (level between 1 and 20),
  track          text not null check (track in ('free', 'elite')),
  kind           text not null check (kind in ('coins', 'item', 'title')),
  value          text not null,
  fallback_coins int  not null default 0 check (fallback_coins >= 0),
  bonus_coins    int  not null default 0 check (bonus_coins >= 0),   -- paid on top (elite level-20 title)
  rarity         text not null default 'common',
  label_uz       text not null,
  label_en       text not null,
  primary key (level, track)
);
insert into public.pass_rewards (level, track, kind, value, fallback_coins, bonus_coins, rarity, label_uz, label_en) values
  (1,'free','coins','30',0,0,'common','30 coin','30 coins'),
  (2,'free','coins','40',0,0,'common','40 coin','40 coins'),
  (3,'free','coins','50',0,0,'common','50 coin','50 coins'),
  (4,'free','item','graphite',250,0,'common','Graphite doska','Graphite board'),
  (5,'free','coins','60',0,0,'common','60 coin','60 coins'),
  (6,'free','coins','60',0,0,'common','60 coin','60 coins'),
  (7,'free','title','season_player',0,0,'rare','"Mavsum o''yinchisi" unvoni','"Season player" title'),
  (8,'free','coins','70',0,0,'common','70 coin','70 coins'),
  (9,'free','coins','70',0,0,'common','70 coin','70 coins'),
  (10,'free','item','st-royal-gold',250,0,'rare','Royal Gold toshlar','Royal Gold stones'),
  (11,'free','coins','70',0,0,'common','70 coin','70 coins'),
  (12,'free','coins','80',0,0,'common','80 coin','80 coins'),
  (13,'free','coins','80',0,0,'common','80 coin','80 coins'),
  (14,'free','coins','80',0,0,'common','80 coin','80 coins'),
  (15,'free','item','royal-wood',600,0,'rare','Royal Wood doska','Royal Wood board'),
  (16,'free','coins','90',0,0,'common','90 coin','90 coins'),
  (17,'free','coins','90',0,0,'common','90 coin','90 coins'),
  (18,'free','coins','100',0,0,'common','100 coin','100 coins'),
  (19,'free','coins','100',0,0,'common','100 coin','100 coins'),
  (20,'free','title','season_finisher',0,0,'epic','"Mavsum finalisti" unvoni','"Season finisher" title'),
  (1,'elite','coins','100',0,0,'rare','100 coin','100 coins'),
  (2,'elite','item','st-obsidian',600,0,'rare','Obsidian toshlar','Obsidian stones'),
  (3,'elite','coins','100',0,0,'rare','100 coin','100 coins'),
  (4,'elite','coins','100',0,0,'rare','100 coin','100 coins'),
  (5,'elite','item','fx-ripple',1500,0,'rare','To''lqin effekti','Ripple effect'),
  (6,'elite','coins','150',0,0,'rare','150 coin','150 coins'),
  (7,'elite','coins','150',0,0,'rare','150 coin','150 coins'),
  (8,'elite','item','emerald-board',900,0,'epic','Emerald doska','Emerald board'),
  (9,'elite','coins','150',0,0,'epic','150 coin','150 coins'),
  (10,'elite','title','elite_member',0,0,'epic','"Elite" unvoni','"Elite" title'),
  (11,'elite','coins','150',0,0,'epic','150 coin','150 coins'),
  (12,'elite','item','st-sapphire',900,0,'epic','Sapphire toshlar','Sapphire stones'),
  (13,'elite','coins','200',0,0,'epic','200 coin','200 coins'),
  (14,'elite','coins','200',0,0,'epic','200 coin','200 coins'),
  (15,'elite','item','fx-sparkle',2500,0,'epic','Uchqun effekti','Sparkle effect'),
  (16,'elite','coins','200',0,0,'epic','200 coin','200 coins'),
  (17,'elite','coins','250',0,0,'legendary','250 coin','250 coins'),
  (18,'elite','coins','250',0,0,'legendary','250 coin','250 coins'),
  (19,'elite','item','fx-fire',4000,0,'legendary','Olov izi effekti','Fire trail effect'),
  (20,'elite','title','season_king',0,300,'mythic','"Mavsum qiroli" unvoni + 300 coin','"Season king" title + 300 coins')
on conflict (level, track) do nothing;

/* ================================================================= player data */
create table if not exists public.pass_checkins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
create table if not exists public.pass_elite (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  season     int  not null check (season >= 1),
  method     text not null check (method in ('coins', 'stars', 'admin')),
  price      int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, season)
);
create table if not exists public.pass_claims (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  season     int  not null,
  level      int  not null,
  track      text not null check (track in ('free', 'elite')),
  coins      int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, season, level, track)
);
create table if not exists public.pass_titles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  season     int  not null,
  created_at timestamptz not null default now(),
  primary key (user_id, title)
);
create table if not exists public.pass_equipped (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  title   text not null
);
alter table public.pass_settings enable row level security;
alter table public.pass_rewards  enable row level security;
alter table public.pass_checkins enable row level security;
alter table public.pass_elite    enable row level security;
alter table public.pass_claims   enable row level security;
alter table public.pass_titles   enable row level security;
alter table public.pass_equipped enable row level security;
-- everything goes through the functions below; titles are public (shown next to names)
revoke all on public.pass_settings, public.pass_rewards, public.pass_checkins, public.pass_elite, public.pass_claims,
              public.pass_titles, public.pass_equipped from anon, authenticated;
grant select on public.pass_equipped to anon, authenticated;
create policy pass_equipped_read on public.pass_equipped for select using (true);
grant select, insert, update, delete on public.pass_settings, public.pass_rewards, public.pass_checkins, public.pass_elite,
      public.pass_claims, public.pass_titles, public.pass_equipped to service_role;

/* ================================================================= season + XP */
create or replace function public._pass_day() returns date
language sql stable as $$ select (now() at time zone 'Asia/Tashkent')::date $$;

create or replace function public._pass_season(p_at timestamptz default now(),
                                               out n int, out t0 timestamptz, out t1 timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare s public.pass_settings; a timestamptz;
begin
  select * into s from public.pass_settings where id;
  a := s.anchor::timestamp at time zone 'Asia/Tashkent';
  n := greatest(1, floor(extract(epoch from (p_at - a)) / (s.season_days * 86400))::int + 1);
  t0 := a + make_interval(days => (n - 1) * s.season_days);
  t1 := t0 + make_interval(days => s.season_days);
end $$;

-- Season XP of a player: per Tashkent day sum every source (with per-day limits), Elite boost, then the daily cap.
create or replace function public._pass_xp(p_uid uuid, out total int, out today int, out capped boolean, out lines json)
language plpgsql stable security definer set search_path = public as $$
declare s public.pass_settings; sn record; elite boolean; d date := public._pass_day();
begin
  select * into s from public.pass_settings where id;
  select * into sn from public._pass_season();
  elite := exists (select 1 from public.pass_elite e where e.user_id = p_uid and e.season = sn.n);
  with g as (    -- rated (pvp + virtual opponents), validated, long enough
    select (m.ended_at at time zone 'Asia/Tashkent')::date as day,
           ((m.result = 'white' and m.white_id = p_uid) or (m.result = 'black' and m.black_id = p_uid)) as won,
           row_number() over (partition by (m.ended_at at time zone 'Asia/Tashkent')::date order by m.ended_at, m.id) as rn
      from public.matches m
     where m.status = 'finished' and m.rated and m.rating_note is null and p_uid in (m.white_id, m.black_id)
       and m.ended_at >= sn.t0 and m.ended_at < sn.t1 and m.move_count >= s.min_moves
  ), b as (      -- practice bot wins (the player is white)
    select (m.ended_at at time zone 'Asia/Tashkent')::date as day,
           row_number() over (partition by (m.ended_at at time zone 'Asia/Tashkent')::date order by m.ended_at, m.id) as rn
      from public.matches m
     where m.status = 'finished' and m.vs_bot and m.virtual_id is null and not m.rated and m.white_id = p_uid
       and m.result = 'white' and m.ended_at >= sn.t0 and m.ended_at < sn.t1 and m.move_count >= s.min_moves
  ), r as (      -- invited friends who finished their 2 real games (inviter reward row), first N of the season
    select (x.created_at at time zone 'Asia/Tashkent')::date as day,
           row_number() over (order by x.created_at, x.id) as rn
      from public.referral_rewards x
     where x.user_id = p_uid and x.role = 'inviter' and x.created_at >= sn.t0 and x.created_at < sn.t1
  ), src as (
    select day, 'live_game' as source, count(*)::int as cnt, count(*)::int * s.xp_live_game as xp from g where rn <= s.live_per_day group by day
    union all
    select day, 'live_win', count(*)::int, count(*)::int * s.xp_live_win from g where rn <= s.live_per_day and won group by day
    union all
    select day, 'bot_win', count(*)::int, count(*)::int * s.xp_bot_win from b where rn <= s.bot_wins_per_day group by day
    union all
    select c.day, 'checkin', 1, s.xp_checkin from public.pass_checkins c
     where c.user_id = p_uid and c.day >= (sn.t0 at time zone 'Asia/Tashkent')::date and c.day < (sn.t1 at time zone 'Asia/Tashkent')::date
    union all
    select mc.day, 'mission', count(*)::int, count(*)::int * s.xp_mission from public.mission_claims mc
     where mc.user_id = p_uid and mc.slug <> '__bonus'
       and mc.day >= (sn.t0 at time zone 'Asia/Tashkent')::date and mc.day < (sn.t1 at time zone 'Asia/Tashkent')::date
     group by mc.day
    union all
    select mc.day, 'mission_bonus', 1, s.xp_mission_bonus from public.mission_claims mc
     where mc.user_id = p_uid and mc.slug = '__bonus'
       and mc.day >= (sn.t0 at time zone 'Asia/Tashkent')::date and mc.day < (sn.t1 at time zone 'Asia/Tashkent')::date
    union all
    select day, 'referral', count(*)::int, count(*)::int * s.xp_referral from r where rn <= s.referrals_per_season group by day
  ), per_day as (
    select day, sum(xp)::int as raw from src group by day
  ), boosted as (
    select day, raw, case when elite then (raw * (100 + s.elite_boost_pct)) / 100 else raw end as v from per_day
  )
  select coalesce(sum(least(v, s.daily_cap)), 0)::int,
         coalesce(max(least(v, s.daily_cap)) filter (where day = d), 0)::int,
         coalesce(bool_or(v > s.daily_cap) filter (where day = d), false),
         (select coalesce(json_agg(json_build_object('source', source, 'count', cnt, 'xp', xp)), '[]'::json) from src where day = d)
    into total, today, capped, lines
    from boosted;
end $$;
revoke all on function public._pass_xp(uuid) from public, anon, authenticated;

/* ================================================================= player API */
create or replace function public.pass_me() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); sn record; x record; s public.pass_settings;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into s from public.pass_settings where id;
  select * into sn from public._pass_season();
  select * into x from public._pass_xp(uid);
  return json_build_object(
    'season', sn.n,
    'xp', x.total,
    'today', json_build_object('total', x.total, 'today', x.today, 'capped', x.capped, 'todayLines', x.lines),
    'elite', exists (select 1 from public.pass_elite e where e.user_id = uid and e.season = sn.n),
    'price', json_build_object('coins', s.price_coins, 'stars', s.price_stars),
    'checked_in', exists (select 1 from public.pass_checkins c where c.user_id = uid and c.day = public._pass_day()),
    'claims', coalesce((select json_agg(c.track || ':' || c.level) from public.pass_claims c where c.user_id = uid and c.season = sn.n), '[]'::json),
    'titles', coalesce((select json_agg(t.title) from public.pass_titles t where t.user_id = uid), '[]'::json),
    'equipped_title', (select q.title from public.pass_equipped q where q.user_id = uid),
    'balance', coalesce((select w.balance from public.user_wallets w where w.user_id = uid), 0));
end $$;
revoke all on function public.pass_me() from public, anon;
grant execute on function public.pass_me() to authenticated;

create or replace function public.pass_checkin() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  insert into public.pass_checkins (user_id, day) values (uid, public._pass_day()) on conflict do nothing;
  get diagnostics n = row_count;
  return json_build_object('ok', n = 1);
end $$;
revoke all on function public.pass_checkin() from public, anon;
grant execute on function public.pass_checkin() to authenticated;

-- Gives a non-limited catalog item for free. Boards and stones get the next serial like a purchase (board_inventory).
-- Returns false if the item is already owned or cannot be given (then the caller pays fallback coins).
create or replace function public._pass_grant_item(p_uid uuid, p_slug text) returns boolean
language plpgsql security definer set search_path = public as $$
declare st public.board_inventory; n int;
begin
  if exists (select 1 from public.user_inventory where user_id = p_uid and item_slug = p_slug) then return false; end if;
  if not exists (select 1 from public.shop_items where slug = p_slug) then return false; end if;
  if exists (select 1 from public.board_catalog where slug = p_slug) then
    if exists (select 1 from public.user_board_collections where user_id = p_uid and board_slug = p_slug) then return false; end if;
    select * into st from public.board_inventory where slug = p_slug for update;
    if not found or st.supply is not null then return false; end if;                -- never a Limited Edition copy
    n := st.sold + 1;
    update public.board_inventory set sold = n where slug = p_slug;
    insert into public.user_board_collections (user_id, board_slug, serial, price_paid) values (p_uid, p_slug, n, 0);
  end if;
  insert into public.user_inventory (user_id, item_slug, source) values (p_uid, p_slug, 'reward') on conflict do nothing;
  return true;
end $$;
revoke all on function public._pass_grant_item(uuid, text) from public, anon, authenticated;

create or replace function public.pass_claim(p_level int, p_track text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sn record; rw public.pass_rewards; lvl int; elite boolean;
        coins int := 0; item text; title text; bal bigint;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if public._is_banned(uid) then raise exception 'account restricted'; end if;
  select * into sn from public._pass_season();
  perform pg_advisory_xact_lock(hashtextextended('pass:' || uid::text || ':' || sn.n, 0));   -- double taps, two devices
  select * into rw from public.pass_rewards where level = p_level and track = p_track;
  if not found then return json_build_object('ok', false, 'error', 'unknown'); end if;
  if exists (select 1 from public.pass_claims c where c.user_id = uid and c.season = sn.n and c.level = p_level and c.track = p_track) then
    return json_build_object('ok', false, 'error', 'already');
  end if;
  lvl := public._pass_level((select total from public._pass_xp(uid)));
  if p_level > lvl then return json_build_object('ok', false, 'error', 'locked'); end if;
  elite := exists (select 1 from public.pass_elite e where e.user_id = uid and e.season = sn.n);
  if p_track = 'elite' and not elite then return json_build_object('ok', false, 'error', 'elite'); end if;

  if rw.kind = 'coins' then
    coins := rw.value::int;
  elsif rw.kind = 'item' then
    if public._pass_grant_item(uid, rw.value) then item := rw.value; else coins := rw.fallback_coins; end if;
  else
    title := rw.value;
    insert into public.pass_titles (user_id, title, season) values (uid, rw.value, sn.n) on conflict do nothing;
  end if;
  coins := coins + rw.bonus_coins;
  insert into public.pass_claims (user_id, season, level, track, coins) values (uid, sn.n, p_level, p_track, coins);
  if coins > 0 then
    bal := public._wallet_apply(uid, coins, 'reward', 'pass', p_track || ':' || p_level,
                                'pass:' || sn.n || ':' || p_track || ':' || p_level, 'season ' || sn.n, null);
  else
    select coalesce(w.balance, 0) into bal from public.user_wallets w where w.user_id = uid;
  end if;
  return json_build_object('ok', true, 'coins', coins, 'item', item, 'title', title, 'balance', coalesce(bal, 0));
end $$;
revoke all on function public.pass_claim(int, text) from public, anon;
grant execute on function public.pass_claim(int, text) to authenticated;

create or replace function public.pass_buy_elite_coins() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sn record; s public.pass_settings; bal bigint;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if public._is_banned(uid) then raise exception 'account restricted'; end if;
  select * into s from public.pass_settings where id;
  select * into sn from public._pass_season();
  perform pg_advisory_xact_lock(hashtextextended('pass:' || uid::text || ':' || sn.n, 0));
  if exists (select 1 from public.pass_elite e where e.user_id = uid and e.season = sn.n) then
    return json_build_object('ok', false, 'error', 'already');
  end if;
  begin
    bal := public._wallet_apply(uid, -s.price_coins, 'purchase', 'pass', 'elite:' || sn.n, 'pass_elite:' || sn.n,
                                'Elite season ' || sn.n, null);
  exception when sqlstate 'P0001' then
    return json_build_object('ok', false, 'error', 'insufficient');
  end;
  insert into public.pass_elite (user_id, season, method, price) values (uid, sn.n, 'coins', s.price_coins);
  return json_build_object('ok', true, 'balance', bal);
end $$;
revoke all on function public.pass_buy_elite_coins() from public, anon;
grant execute on function public.pass_buy_elite_coins() to authenticated;

create or replace function public.pass_equip_title(p_title text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_title is null then
    delete from public.pass_equipped where user_id = uid;
    return json_build_object('ok', true);
  end if;
  if not exists (select 1 from public.pass_titles t where t.user_id = uid and t.title = p_title) then
    return json_build_object('ok', false);
  end if;
  insert into public.pass_equipped (user_id, title) values (uid, p_title)
  on conflict (user_id) do update set title = excluded.title;
  return json_build_object('ok', true);
end $$;
revoke all on function public.pass_equip_title(text) from public, anon;
grant execute on function public.pass_equip_title(text) to authenticated;
