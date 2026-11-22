-- DAMEO 0031: DAMEO Pass (season pass). DRAFT — built and tested in the BETA (demo adapter); test on a separate
-- Supabase project / branch before applying to the main DAMEO database.
--  * Seasons of 14 days from pass_settings.anchor (00:00 Asia/Tashkent), 20 levels, two tracks: free and elite.
--  * XP is NEVER reported by the client: it is derived at read/claim time from server-owned rows
--    (finished, validated matches; mission_claims; referral_rewards; pass_checkins). Per-day caps, then a daily cap.
--  * Every reward is claimed by the player ("Olish"), once per season/level/track (PK + advisory lock).
--  * Rewards: coins, non-limited catalog items (an owned item pays coins), timed XP boosters, coin boxes, and pass
--    cosmetics — status emoji (next to the name), avatar frames, profile backgrounds, badges, titles (some timed).
--  * Premium ("elite" track) is paid with Telegram Stars (pass_settings.price_stars): an order + XTR invoice, Premium opens
--    ONLY on Telegram's successful_payment (pass_payment_complete), once per season. pass_grant_premium is the admin fallback.
--  * A season ends by itself: claims and Premium are per season number, so last season's unclaimed rewards close.
--  * Elo / rating tables are never touched.
-- Same rules as src/services/pass/core.ts (unit-tested there). Additive only: new tables and functions.

/* ================================================================= config */
create table if not exists public.pass_settings (
  id               boolean primary key default true check (id),
  anchor           date not null default '2026-11-16',
  season_days      int  not null default 21  check (season_days between 7 and 60),
  price_som        int  not null default 11900 check (price_som between 0 and 10000000),
  price_stars      int  not null default 50   check (price_stars between 1 and 10000),   -- Premium Pass price in Telegram Stars
  elite_boost_pct  int  not null default 0    check (elite_boost_pct between 0 and 100),
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
  kind           text not null check (kind in ('coins', 'item', 'xp_boost', 'box', 'currency', 'perk', 'emoji', 'frame', 'background', 'badge', 'title')),
  value          text not null,                                     -- amount / item slug / cosmetic id(s, comma list for emoji packs)
  fallback_coins int  not null default 0 check (fallback_coins >= 0),
  days           int  not null default 0 check (days between 0 and 365),
  min_coins      int  not null default 0,
  max_coins      int  not null default 0,
  amount         int  not null default 0 check (amount >= 0),       -- currency / perk amount
  rarity         text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythic')),
  label_uz       text not null,
  label_en       text not null,
  art            text,                                              -- picture path in the app (pass/*.webp)
  note_uz        text,
  note_en        text,
  primary key (level, track)
);
-- Season 01 "Royal Legacy" (same rows as src/services/pass/core.ts DEFAULT_REWARDS). Admins can change rows later.
insert into public.pass_rewards (level, track, kind, value, fallback_coins, days, min_coins, max_coins, amount, rarity, label_uz, label_en, art, note_uz, note_en) values
  (1,'free','coins','50',0,0,0,0,0,'common','50 Dameo Coin','50 Dameo Coins','pass/free-01.webp',null,null),
  (2,'free','item','st-obsidian',600,0,0,0,0,'common','Klassik dona (Style)','Classic pieces (Style)','pass/free-02.webp','O''yinda: Obsidian donalar','In game: Obsidian pieces'),
  (3,'free','xp_boost','10',0,3,0,0,0,'common','XP +10% (3 kun)','XP +10% (3 days)','pass/free-03.webp',null,null),
  (4,'free','frame','f-violet',0,0,0,0,0,'rare','Profil avatar ramkasi','Profile avatar frame','pass/free-04.webp',null,null),
  (5,'free','coins','100',0,0,0,0,0,'common','100 Dameo Coin','100 Dameo Coins','pass/free-05.webp',null,null),
  (6,'free','emoji','e-crown,e-piece,e-win',0,0,0,0,0,'rare','Maxsus emoji (3 ta)','Special emoji (3)','pass/free-06.webp','Ism yonida ko''rinadi','Shown next to your name'),
  (7,'free','background','bg-night',0,0,0,0,0,'rare','Profil foni (Tema)','Profile background','pass/free-07.webp',null,null),
  (8,'free','xp_boost','20',0,3,0,0,0,'rare','XP Booster (3 kun)','XP Booster (3 days)','pass/free-08.webp','XP +20%','XP +20%'),
  (9,'free','item','pass-violet',250,0,0,0,0,'common','Classic Violet Board','Classic Violet Board','pass/board-free.webp','O''yin doskasi · inventarga tushadi','Game board · goes to your inventory'),
  (10,'free','box','box-bag',0,0,50,250,0,'rare','Mukofot qutisi (Tasodifiy)','Reward bag (Random)','pass/free-10.webp','50–250 coin','50–250 coins'),
  (11,'free','coins','150',0,0,0,0,0,'common','150 Dameo Coin','150 Dameo Coins','pass/free-11.webp',null,null),
  (12,'free','item','fx-ripple',1500,0,0,0,0,'rare','Dona effekti (Oddiy)','Piece effect','pass/free-12.webp','O''yinda: To''lqin effekti','In game: Ripple effect'),
  (13,'free','emoji','e-win',0,0,0,0,0,'rare','G''alaba stikerlari (3 ta)','Victory stickers (3)','pass/free-13.webp','WIN emojisi','WIN emoji'),
  (14,'free','perk','mission_slot',0,3,0,0,1,'rare','Topshiriq sloti +1 (3 kun)','Mission slot +1 (3 days)','pass/free-14.webp',null,null),
  (15,'free','frame','f-violet2',0,0,0,0,0,'rare','Profil ramkasi (Oddiy)','Profile frame','pass/free-15.webp',null,null),
  (16,'free','coins','200',0,0,0,0,0,'common','200 Dameo Coin','200 Dameo Coins','pass/free-16.webp',null,null),
  (17,'free','title','t-active',0,7,0,0,0,'epic','"Faol o''yinchi" unvoni (7 kun)','"Active player" title (7 days)','pass/free-17.webp',null,null),
  (18,'free','item','royal-wood',600,0,0,0,0,'epic','Maxsus doska (Rangli)','Special board','pass/free-18.webp','O''yinda: Royal Wood doska','In game: Royal Wood board'),
  (19,'free','box','box-chest',0,0,150,500,0,'epic','Kichik sandiq (Kolleksiya)','Small chest','pass/free-19.webp','150–500 coin','150–500 coins'),
  (20,'free','badge','b-s1',0,0,0,0,0,'epic','Season 01 ishtirokchisi','Season 01 participant','pass/free-20.webp',null,null),
  (1,'elite','coins','250',0,0,0,0,0,'rare','250 Dameo Coin','250 Dameo Coins','pass/prem-01.webp',null,null),
  (2,'elite','item','st-royal-gold',250,0,0,0,0,'epic','Premium dona (Oltin)','Premium pieces (Gold)','pass/prem-02.webp','O''yinda: Royal Gold donalar','In game: Royal Gold pieces'),
  (3,'elite','xp_boost','50',0,7,0,0,0,'epic','XP +50% (7 kun)','XP +50% (7 days)','pass/prem-03.webp',null,null),
  (4,'elite','frame','f-gold',0,0,0,0,0,'epic','Premium ramka (S1)','Premium frame (S1)','pass/prem-04.webp',null,null),
  (5,'elite','currency','crystal',0,0,0,0,100,'epic','100 Kreativ kristall','100 Creative crystals','pass/prem-05.webp',null,null),
  (6,'elite','item','fx-lightning',4000,0,0,0,0,'epic','Yurish effekti (Neon)','Move effect (Neon)','pass/prem-06.webp','O''yinda: Chaqmoq effekti','In game: Lightning effect'),
  (4,'elite','item','pass-royal-gold',900,0,0,0,0,'epic','Royal Gold Board','Royal Gold Board','pass/board-prem.webp','Premium o''yin doskasi · inventarga tushadi','Premium board · goes to your inventory'),
  (8,'elite','emoji','e-gold-crown,e-diamond,e-fire,e-crown,e-win',0,0,0,0,0,'legendary','Maxsus emoji (5 ta)','Special emoji (5)','pass/prem-08.webp','Ism yonida ko''rinadi','Shown next to your name'),
  (9,'elite','title','t-elite',0,30,0,0,0,'epic','"Dameo Elite" unvoni (30 kun)','"Dameo Elite" title (30 days)','pass/prem-09.webp',null,null),
  (10,'elite','box','box-epic',0,0,400,1000,0,'legendary','Kolleksiya sandig''i (Epik)','Collection chest (Epic)','pass/prem-10.webp','400–1000 coin','400–1000 coins'),
  (11,'elite','coins','500',0,0,0,0,0,'epic','500 Dameo Coin','500 Dameo Coins','pass/prem-11.webp',null,null),
  (12,'elite','item','midnight-blue',300,0,0,0,0,'epic','Mavsumiy doska (S1 Exclusive)','Season board (S1 Exclusive)','pass/prem-12.webp','O''yinda: Midnight Blue doska','In game: Midnight Blue board'),
  (13,'elite','frame','f-royal',0,0,0,0,0,'epic','Premium avatar ramkasi','Premium avatar frame','pass/prem-13.webp',null,null),
  (14,'elite','item','fx-fire',4000,0,0,0,0,'legendary','Dona effekti (Fire)','Piece effect (Fire)','pass/prem-14.webp','O''yinda: Olov izi effekti','In game: Fire trail effect'),
  (15,'elite','currency','ticket',0,0,0,0,5,'epic','O''yin chiptasi (+5 ta)','Game tickets (+5)','pass/prem-15.webp',null,null),
  (16,'elite','frame','f-epic',0,0,0,0,0,'legendary','Animatsiyali ramka (Epik)','Animated frame (Epic)','pass/prem-16.webp',null,null),
  (17,'elite','badge','b-s1-gold',0,0,0,0,0,'legendary','Season 01 Belgi (Profil)','Season 01 badge (Profile)','pass/prem-17.webp',null,null),
  (18,'elite','item','fx-stardust',6000,0,0,0,0,'legendary','Yurish effekti (Wings)','Move effect (Wings)','pass/prem-18.webp','O''yinda: Yulduz changi effekti','In game: Stardust effect'),
  (19,'elite','title','t-champion',0,30,0,0,0,'legendary','"Champion da''vogar" unvoni (30 kun)','"Title contender" title (30 days)','pass/prem-19.webp',null,null),
  (20,'elite','frame','f-legend',0,0,0,0,0,'mythic','Season 01 Premium ramkasi (Legendary)','Season 01 Premium frame (Legendary)','pass/prem-20.webp',null,null)
on conflict (level, track) do update set kind = excluded.kind, value = excluded.value, fallback_coins = excluded.fallback_coins,
  days = excluded.days, min_coins = excluded.min_coins, max_coins = excluded.max_coins, amount = excluded.amount, rarity = excluded.rarity,
  label_uz = excluded.label_uz, label_en = excluded.label_en, art = excluded.art, note_uz = excluded.note_uz, note_en = excluded.note_en;

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
create table if not exists public.pass_cosmetics (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('emoji', 'frame', 'background', 'badge', 'title')),
  id         text not null,
  season     int  not null,
  until      timestamptz,                                     -- null = forever
  created_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create table if not exists public.pass_equipped (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null check (kind in ('emoji', 'frame', 'background', 'badge', 'title')),
  id      text not null,
  primary key (user_id, kind)
);
create table if not exists public.pass_boosts (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  pct      int  not null check (pct between 1 and 200),
  starts   timestamptz not null,
  ends     timestamptz not null
);
create index if not exists pass_boosts_user_idx on public.pass_boosts (user_id, ends);
create table if not exists public.pass_wallet (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('crystal', 'ticket')),
  amount   int  not null default 0 check (amount >= 0),
  primary key (user_id, currency)
);
create table if not exists public.pass_perks (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  perk    text not null check (perk in ('mission_slot')),
  amount  int  not null default 1,
  ends    timestamptz not null
);
-- Premium Pass orders paid with Telegram Stars (separate from coin top-ups; Elo, wallet and coins untouched)
create table if not exists public.pass_orders (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public.profiles(id) on delete cascade,
  season                     int  not null,
  stars                      int  not null check (stars > 0),
  status                     text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'refunded')),
  status_reason              text,
  tg_user_id                 bigint,
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  raw                        jsonb,
  created_at                 timestamptz not null default now(),
  paid_at                    timestamptz
);
create index if not exists pass_orders_user_idx on public.pass_orders (user_id, created_at desc);
alter table public.pass_settings enable row level security;
alter table public.pass_rewards  enable row level security;
alter table public.pass_checkins enable row level security;
alter table public.pass_elite    enable row level security;
alter table public.pass_claims   enable row level security;
alter table public.pass_cosmetics enable row level security;
alter table public.pass_equipped enable row level security;
alter table public.pass_boosts   enable row level security;
alter table public.pass_wallet   enable row level security;
alter table public.pass_perks    enable row level security;
alter table public.pass_orders   enable row level security;
-- everything goes through the functions below; titles are public (shown next to names)
revoke all on public.pass_settings, public.pass_rewards, public.pass_checkins, public.pass_elite, public.pass_claims,
              public.pass_cosmetics, public.pass_equipped, public.pass_boosts, public.pass_wallet, public.pass_perks,
              public.pass_orders from anon, authenticated;
grant select, insert, update, delete on public.pass_settings, public.pass_rewards, public.pass_checkins, public.pass_elite,
      public.pass_claims, public.pass_cosmetics, public.pass_equipped, public.pass_boosts, public.pass_wallet, public.pass_perks,
      public.pass_orders to service_role;

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
  ), boosted as (     -- strongest booster touching the day (boosters don't stack) + Elite boost
    select p.day, p.raw,
           (p.raw * (100 + case when elite then s.elite_boost_pct else 0 end
              + coalesce((select max(bo.pct) from public.pass_boosts bo
                           where bo.user_id = p_uid
                             and bo.starts < ((p.day + 1)::timestamp at time zone 'Asia/Tashkent')
                             and bo.ends > (p.day::timestamp at time zone 'Asia/Tashkent')), 0))) / 100 as v
      from per_day p
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
create or replace function public._pass_worn(p_uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(q.kind, q.id), '{}'::json)
    from public.pass_equipped q
    join public.pass_cosmetics c on c.user_id = q.user_id and c.kind = q.kind and c.id = q.id
   where q.user_id = p_uid and (c.until is null or c.until > now())
$$;
revoke all on function public._pass_worn(uuid) from public, anon, authenticated;

create or replace function public.pass_me() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); sn record; x record; s public.pass_settings; d date := public._pass_day();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into s from public.pass_settings where id;
  select * into sn from public._pass_season();
  select * into x from public._pass_xp(uid);
  return json_build_object(
    'season', sn.n,
    'xp', x.total,
    'today', json_build_object('total', x.total, 'today', x.today, 'capped', x.capped, 'todayLines', x.lines),
    'boost_today', coalesce((select max(bo.pct) from public.pass_boosts bo where bo.user_id = uid
                               and bo.starts < ((d + 1)::timestamp at time zone 'Asia/Tashkent')
                               and bo.ends > (d::timestamp at time zone 'Asia/Tashkent')), 0),
    'elite', exists (select 1 from public.pass_elite e where e.user_id = uid and e.season = sn.n),
    'price', json_build_object('som', s.price_som, 'stars', s.price_stars),
    'checked_in', exists (select 1 from public.pass_checkins c where c.user_id = uid and c.day = d),
    'claims', coalesce((select json_agg(c.track || ':' || c.level) from public.pass_claims c where c.user_id = uid and c.season = sn.n), '[]'::json),
    'owned', coalesce((select json_agg(json_build_object('id', c.id, 'kind', c.kind, 'season', c.season,
                         'until', case when c.until is null then null else (extract(epoch from c.until) * 1000)::bigint end))
                         from public.pass_cosmetics c where c.user_id = uid and (c.until is null or c.until > now())), '[]'::json),
    'equipped', public._pass_worn(uid),
    'balance', coalesce((select w.balance from public.user_wallets w where w.user_id = uid), 0),
    'season_end', (extract(epoch from sn.t1) * 1000)::bigint,
    'rewards', (select json_agg(row_to_json(r) order by r.level, r.track) from public.pass_rewards r),
    'wallet', coalesce((select json_object_agg(w.currency, w.amount) from public.pass_wallet w where w.user_id = uid), '{}'::json),
    'perks', coalesce((select json_agg(json_build_object('id', p.perk, 'amount', p.amount, 'until', (extract(epoch from p.ends) * 1000)::bigint))
                         from public.pass_perks p where p.user_id = uid and p.ends > now()), '[]'::json));
end $$;
revoke all on function public.pass_me() from public, anon;
grant execute on function public.pass_me() to authenticated;

-- what a player wears (any player: shown on their profile, next to their name)
create or replace function public.pass_worn(p_user uuid) returns json
language sql stable security definer set search_path = public as $$ select public._pass_worn(p_user) $$;
revoke all on function public.pass_worn(uuid) from public;
grant execute on function public.pass_worn(uuid) to anon, authenticated;

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
        coins int := 0; item text; cosmetic text; boost int := 0; bal bigint; v_until timestamptz;
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
  elsif rw.kind = 'box' then
    coins := rw.min_coins + floor(random() * (greatest(rw.max_coins, rw.min_coins) - rw.min_coins + 1))::int;
  elsif rw.kind = 'item' then
    if public._pass_grant_item(uid, rw.value) then item := rw.value; else coins := rw.fallback_coins; end if;
  elsif rw.kind = 'currency' then
    insert into public.pass_wallet (user_id, currency, amount) values (uid, rw.value, rw.amount)
    on conflict (user_id, currency) do update set amount = public.pass_wallet.amount + excluded.amount;
  elsif rw.kind = 'perk' then
    insert into public.pass_perks (user_id, perk, amount, ends) values (uid, rw.value, greatest(rw.amount, 1), now() + make_interval(days => greatest(rw.days, 1)));
  elsif rw.kind = 'xp_boost' then
    boost := rw.value::int;
    insert into public.pass_boosts (user_id, pct, starts, ends) values (uid, boost, now(), now() + make_interval(days => greatest(rw.days, 1)));
  else
    cosmetic := rw.kind;
    v_until := case when rw.days > 0 then now() + make_interval(days => rw.days) end;
    insert into public.pass_cosmetics (user_id, kind, id, season, until)
    select uid, rw.kind, btrim(x), sn.n, v_until from unnest(string_to_array(rw.value, ',')) x     -- emoji packs: several ids
    on conflict (user_id, kind, id) do update
      set until = case when public.pass_cosmetics.until is null or excluded.until is null then null
                       else greatest(public.pass_cosmetics.until, excluded.until) end;
    insert into public.pass_equipped (user_id, kind, id) values (uid, rw.kind, btrim(split_part(rw.value, ',', 1)))
    on conflict (user_id, kind) do nothing;                                                      -- first of a kind is worn
  end if;
  insert into public.pass_claims (user_id, season, level, track, coins) values (uid, sn.n, p_level, p_track, coins);
  if coins > 0 then
    bal := public._wallet_apply(uid, coins, 'reward', 'pass', p_track || ':' || p_level,
                                'pass:' || sn.n || ':' || p_track || ':' || p_level, 'season ' || sn.n, null);
  else
    select coalesce(w.balance, 0) into bal from public.user_wallets w where w.user_id = uid;
  end if;
  return json_build_object('ok', true, 'coins', coins, 'item', item, 'cosmetic', cosmetic, 'boost', boost, 'balance', coalesce(bal, 0));
end $$;
revoke all on function public.pass_claim(int, text) from public, anon;
grant execute on function public.pass_claim(int, text) to authenticated;

create or replace function public.pass_equip(p_kind text, p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_kind not in ('emoji', 'frame', 'background', 'badge', 'title') then return json_build_object('ok', false); end if;
  if p_id is null then
    delete from public.pass_equipped where user_id = uid and kind = p_kind;
    return json_build_object('ok', true);
  end if;
  if not exists (select 1 from public.pass_cosmetics c where c.user_id = uid and c.kind = p_kind and c.id = p_id
                   and (c.until is null or c.until > now())) then
    return json_build_object('ok', false);
  end if;
  insert into public.pass_equipped (user_id, kind, id) values (uid, p_kind, p_id)
  on conflict (user_id, kind) do update set id = excluded.id;
  return json_build_object('ok', true);
end $$;
revoke all on function public.pass_equip(text, text) from public, anon;
grant execute on function public.pass_equip(text, text) to authenticated;

-- Premium (11 900 so'm through FLECT STARS): an admin with 'payments.view' confirms the payment and opens it.
create or replace function public.pass_grant_premium(p_user uuid, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare a uuid; sn record; s public.pass_settings; n int;
begin
  a := public._admin_require('payments.view');
  select * into s from public.pass_settings where id;
  select * into sn from public._pass_season();
  insert into public.pass_elite (user_id, season, method, price) values (p_user, sn.n, 'admin', s.price_som)
  on conflict do nothing;
  get diagnostics n = row_count;
  return json_build_object('ok', n = 1, 'season', sn.n, 'already', n = 0);
end $$;
revoke all on function public.pass_grant_premium(uuid, text) from public, anon;
grant execute on function public.pass_grant_premium(uuid, text) to authenticated;

/* ================================================================= Premium with Telegram Stars */
-- (service role) the `payments` Edge Function asks for an order before it creates the XTR invoice (payload 'pass:<order id>')
create or replace function public.pass_order_create(p_user uuid) returns json
language plpgsql security definer set search_path = public as $$
declare s public.pass_settings; sn record; o public.pass_orders; tgid bigint;
begin
  if public._is_banned(p_user) then raise exception 'account restricted'; end if;
  select * into s from public.pass_settings where id;
  select * into sn from public._pass_season();
  if exists (select 1 from public.pass_elite e where e.user_id = p_user and e.season = sn.n) then raise exception 'already premium'; end if;
  if (select count(*) from public.pass_orders where user_id = p_user and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too many orders';
  end if;
  select tg_id into tgid from public.profiles where id = p_user;
  insert into public.pass_orders (user_id, season, stars, tg_user_id) values (p_user, sn.n, s.price_stars, tgid) returning * into o;
  return json_build_object('order_id', o.id, 'stars', o.stars, 'season', o.season, 'season_end', sn.t1);
end $$;

-- (service role) Telegram pre_checkout_query for 'pass:<id>': null = allow, text = refuse
create or replace function public.pass_payment_precheck(p_order uuid, p_stars int, p_currency text, p_tg bigint) returns text
language plpgsql security definer set search_path = public as $$
declare o public.pass_orders; sn record;
begin
  select * into o from public.pass_orders where id = p_order;
  if not found then return 'order not found'; end if;
  if o.status <> 'pending' then return 'order is ' || o.status; end if;
  if o.created_at < now() - interval '1 day' then return 'order expired'; end if;
  if p_currency <> 'XTR' or p_stars <> o.stars then return 'amount mismatch'; end if;
  if o.tg_user_id is distinct from p_tg then return 'wrong account'; end if;
  select * into sn from public._pass_season();
  if o.season <> sn.n then return 'season ended'; end if;
  if exists (select 1 from public.pass_elite e where e.user_id = o.user_id and e.season = o.season) then return 'already premium'; end if;
  return null;
end $$;

-- (service role) Telegram successful_payment: Premium opens exactly once (unique charge id), only now
create or replace function public.pass_payment_complete(p_order uuid, p_charge text, p_provider_charge text, p_stars int, p_tg bigint, p_raw jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare o public.pass_orders;
begin
  if p_charge is null or length(p_charge) < 4 then raise exception 'charge id required'; end if;
  if exists (select 1 from public.pass_orders where telegram_payment_charge_id = p_charge) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;
  select * into o from public.pass_orders where id = p_order for update;
  if not found then return json_build_object('ok', false, 'error', 'order not found'); end if;
  if o.status in ('paid', 'refunded') then return json_build_object('ok', true, 'duplicate', true); end if;
  if p_stars <> o.stars or o.tg_user_id is distinct from p_tg then
    update public.pass_orders set status_reason = 'needs review: paid amount/account mismatch', raw = p_raw,
           telegram_payment_charge_id = p_charge, provider_payment_charge_id = p_provider_charge where id = o.id;
    return json_build_object('ok', false, 'error', 'needs review');
  end if;
  update public.pass_orders set status = 'paid', status_reason = null, paid_at = now(), telegram_payment_charge_id = p_charge,
         provider_payment_charge_id = p_provider_charge, raw = p_raw where id = o.id;
  insert into public.pass_elite (user_id, season, method, price) values (o.user_id, o.season, 'stars', o.stars) on conflict do nothing;
  return json_build_object('ok', true, 'user_id', o.user_id, 'season', o.season);
end $$;
revoke all on function public.pass_order_create(uuid) from public, anon, authenticated;
revoke all on function public.pass_payment_precheck(uuid, int, text, bigint) from public, anon, authenticated;
revoke all on function public.pass_payment_complete(uuid, text, text, int, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.pass_order_create(uuid) to service_role;
grant execute on function public.pass_payment_precheck(uuid, int, text, bigint) to service_role;
grant execute on function public.pass_payment_complete(uuid, text, text, int, bigint, jsonb) to service_role;


/* ================================================================= DAMEO Pass boards (only from the Pass: not on sale) */
insert into public.shop_items (slug, category_id, slot, collection, name_uz, name_en, desc_uz, desc_en, rarity, price, is_free, is_default,
                               active, retired, style, image_url, sort)
values
  ('pass-violet', 'boards', 'board', 'pass', 'Classic Violet Board', 'Classic Violet Board', 'DAMEO Pass · Season 01 bepul doskasi.', 'DAMEO Pass · Season 01 free board.', 'rare', 0, false, false, false, true,
   '{"light":"#ac63cd","dark":"#2a1144","edge":"#3a1a5c","edge2":"#c9a0ff","frame":"gold","hl":"#e8bb4d","coord":"#eadcff","lt":"pass-violet-l","dt":"pass-violet-d","fr":"pass-violet-frame","fi":[0.0704,0.0753,0.9341,0.9504]}', 'boards/pass-violet.webp', 90),
  ('pass-royal-gold', 'boards', 'board', 'pass', 'Royal Gold Board', 'Royal Gold Board', 'DAMEO Pass · Season 01 Premium doskasi: oltin ramka, toj.', 'DAMEO Pass · Season 01 Premium board: gold frame and crown.', 'epic', 0, false, false, false, true,
   '{"light":"#972dc9","dark":"#150b24","edge":"#4a2a10","edge2":"#d4a53c","frame":"gold","hl":"#e8bb4d","coord":"#eadcff","lt":"pass-royal-gold-l","dt":"pass-royal-gold-d","fr":"pass-royal-gold-frame","fi":[0.0832,0.1328,0.9159,0.8696]}', 'boards/pass-royal-gold.webp', 91)
on conflict (slug) do nothing;
