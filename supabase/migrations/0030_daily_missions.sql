-- DAMEO 0030 (v3.2): Daily Missions.
--  * 7 missions + a full-completion bonus; at most mission_settings.daily_cap coins per player per day (300 at launch).
--  * The day is the Uzbekistan calendar day: resets at 00:00 Asia/Tashkent.
--  * Progress is NEVER reported by the client: it is derived at read/claim time from server-owned rows
--    (matches finished & validated by match-action, referrals, mission_events written by server code only).
--  * A claim is one row in mission_claims (PK user+day+slug) and one wallet credit with idem key
--    mission:<day>:<slug>; a per-user advisory lock serialises concurrent claims → no duplicates, cap always holds.
--  * Definitions & settings are admin-editable (permission 'tournaments.manage'), validated and audited.
-- Additive only: new tables/functions. Matches, rating, wallet and referral code are unchanged.
-- Same rules as src/services/missions/core.ts (unit-tested there).

/* ================================================================= config */
create table if not exists public.mission_settings (
  id         boolean primary key default true check (id),
  bonus      int not null default 60  check (bonus between 0 and 1000),
  daily_cap  int not null default 300 check (daily_cap between 0 and 5000),
  min_moves  int not null default 12  check (min_moves between 0 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.mission_settings (id) values (true) on conflict do nothing;

create table if not exists public.mission_definitions (
  slug       text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  kind       text not null unique check (kind in ('puzzle_solve','referral_join','bot_win_medium','rated_win_streak',
                                                  'rated_complete','rated_win','match_complete')),
  target     int not null check (target between 1 and 1000),
  reward     int not null check (reward between 0 and 1000),
  title_uz   text not null check (length(btrim(title_uz)) between 1 and 120),
  title_en   text not null check (length(btrim(title_en)) between 1 and 120),
  sort       int not null default 0,
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.mission_definitions (slug, kind, target, reward, title_uz, title_en, sort) values
  ('puzzles_10',  'puzzle_solve',     10, 30, '10 ta jumboq yech',                      'Solve 10 puzzles',           10),
  ('invite_1',    'referral_join',     1, 60, '1 ta yangi do''st taklif qil',           'Invite 1 new player',        20),
  ('bot_medium',  'bot_win_medium',    1, 20, 'O''rta darajali botni yut',              'Defeat the Medium bot',      30),
  ('streak_3',    'rated_win_streak',  3, 50, 'Ketma-ket 3 ta reytingli o''yinda yut', 'Win 3 rated games in a row', 40),
  ('rated_5',     'rated_complete',    5, 30, '5 ta reytingli o''yinni yakunla',        'Complete 5 rated games',     50),
  ('rated_win_2', 'rated_win',         2, 30, '2 ta reytingli o''yinda yut',            'Win 2 rated games',          60),
  ('matches_3',   'match_complete',    3, 20, '3 ta o''yinni yakunla',                  'Complete 3 games',           70)
on conflict (slug) do nothing;

/* ================================================================= state */
create table if not exists public.mission_claims (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  slug       text not null,                 -- definition slug, or '__bonus'
  amount     int  not null check (amount >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, day, slug)
);

-- progress sources that have no table of their own (puzzles). Written ONLY by server code (service role / security
-- definer functions) after the server has validated the event; unique (user, kind, ref) → an event counts once.
create table if not exists public.mission_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('puzzle_solve')),
  ref        text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists mission_events_user_idx on public.mission_events (user_id, kind, created_at);
create index if not exists matches_ended_idx on public.matches (ended_at) where status = 'finished';

alter table public.mission_settings    enable row level security;
alter table public.mission_definitions enable row level security;
alter table public.mission_claims      enable row level security;
alter table public.mission_events      enable row level security;
revoke all on public.mission_settings, public.mission_definitions, public.mission_claims, public.mission_events from anon, authenticated;
grant select, insert, update on public.mission_settings, public.mission_definitions, public.mission_claims, public.mission_events to service_role;

/* ================================================================= rules */
create or replace function public._mission_day(p_ts timestamptz default now()) returns date
language sql stable set search_path = public as $$
  select (p_ts at time zone 'Asia/Tashkent')::date;
$$;

-- Today's progress for every definition (inactive ones included; callers filter). Same rules as core.ts measure().
create or replace function public._mission_progress(p_uid uuid, p_day date)
returns table (slug text, kind text, target int, reward int, progress int, sort int, active boolean, title_uz text, title_en text)
language plpgsql stable security definer set search_path = public as $$
declare
  t0 timestamptz := p_day::timestamp at time zone 'Asia/Tashkent';
  t1 timestamptz := (p_day + 1)::timestamp at time zone 'Asia/Tashkent';
  mm int;
  v_complete int; v_rated int; v_rwin int; v_bot int; v_ref int; v_puz int;
  v_cur int := 0; v_best int := 0;
  r record;
begin
  select s.min_moves into mm from public.mission_settings s where s.id;
  mm := coalesce(mm, 12);

  -- every finished, server-validated game of mine today with enough moves (bot games included)
  select count(*) into v_complete from public.matches m
   where m.status = 'finished' and p_uid in (m.white_id, m.black_id)
     and m.ended_at >= t0 and m.ended_at < t1 and m.move_count >= mm;

  -- rated = the server rated it (vs players and virtual opponents) and no anti-abuse note
  select count(*), count(*) filter (where (m.result = 'white' and m.white_id = p_uid) or (m.result = 'black' and m.black_id = p_uid))
    into v_rated, v_rwin
    from public.matches m
   where m.status = 'finished' and m.rated and m.rating_note is null and p_uid in (m.white_id, m.black_id)
     and m.ended_at >= t0 and m.ended_at < t1 and m.move_count >= mm;

  for r in
    select ((m.result = 'white' and m.white_id = p_uid) or (m.result = 'black' and m.black_id = p_uid)) as won
      from public.matches m
     where m.status = 'finished' and m.rated and m.rating_note is null and p_uid in (m.white_id, m.black_id)
       and m.ended_at >= t0 and m.ended_at < t1 and m.move_count >= mm
     order by m.ended_at, m.id
  loop
    if r.won then v_cur := v_cur + 1; v_best := greatest(v_best, v_cur); else v_cur := 0; end if;
  end loop;

  -- the practice bot (not a virtual opponent): the player is always white, the bot black
  select count(*) into v_bot from public.matches m
   where m.status = 'finished' and m.vs_bot and m.virtual_id is null and not m.rated and m.bot_level = 'medium'
     and m.white_id = p_uid and m.result = 'white'
     and m.ended_at >= t0 and m.ended_at < t1 and m.move_count >= mm;

  -- a NEW player joined with my invite today (referrals.invitee_id is unique → each person counts once, ever)
  select count(*) into v_ref from public.referrals x where x.inviter_id = p_uid and x.created_at >= t0 and x.created_at < t1;

  select count(*) into v_puz from public.mission_events e
   where e.user_id = p_uid and e.kind = 'puzzle_solve' and e.created_at >= t0 and e.created_at < t1;

  return query
  select d.slug, d.kind, d.target, d.reward,
         least(d.target, case d.kind
           when 'puzzle_solve'     then v_puz
           when 'referral_join'    then v_ref
           when 'bot_win_medium'   then v_bot
           when 'rated_win_streak' then v_best
           when 'rated_complete'   then v_rated
           when 'rated_win'        then v_rwin
           when 'match_complete'   then v_complete
           else 0 end)::int,
         d.sort, d.active, d.title_uz, d.title_en
    from public.mission_definitions d
   order by d.sort, d.slug;
end $$;
revoke all on function public._mission_progress(uuid, date) from public, anon, authenticated;

/* ================================================================= player API */
create or replace function public.daily_missions_me() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := public._mission_day();
  s public.mission_settings;
  res json;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into s from public.mission_settings where id;
  select json_build_object(
    'day', d,
    'cap', s.daily_cap,
    'bonus', s.bonus,
    'bonus_claimed', exists (select 1 from public.mission_claims c where c.user_id = uid and c.day = d and c.slug = '__bonus'),
    'balance', coalesce((select w.balance from public.user_wallets w where w.user_id = uid), 0),
    'claims', coalesce((select json_object_agg(c.slug, c.amount) from public.mission_claims c where c.user_id = uid and c.day = d), '{}'::json),
    'missions', coalesce((
      select json_agg(json_build_object(
               'slug', p.slug, 'kind', p.kind, 'target', p.target, 'reward', p.reward, 'progress', p.progress,
               'title_uz', p.title_uz, 'title_en', p.title_en,
               'claimed', exists (select 1 from public.mission_claims c where c.user_id = uid and c.day = d and c.slug = p.slug))
             order by p.sort, p.slug)
        from public._mission_progress(uid, d) p where p.active), '[]'::json)
  ) into res;
  return res;
end $$;
revoke all on function public.daily_missions_me() from public, anon;
grant execute on function public.daily_missions_me() to authenticated;

-- {ok:true, amount, balance, earned} | {ok:false, error:'unknown'|'not_done'|'already'}
create or replace function public.claim_daily_mission(p_slug text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := public._mission_day();
  s public.mission_settings;
  v_amount int; v_target int; v_prog int; v_earned int;
  bal bigint;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_slug is null or length(p_slug) > 40 then return json_build_object('ok', false, 'error', 'unknown'); end if;
  -- one claim at a time per player per day (double taps, two devices, retries)
  perform pg_advisory_xact_lock(hashtextextended('mission:' || uid::text || ':' || d::text, 0));
  if exists (select 1 from public.mission_claims c where c.user_id = uid and c.day = d and c.slug = p_slug) then
    return json_build_object('ok', false, 'error', 'already');
  end if;
  select * into s from public.mission_settings where id;

  if p_slug = '__bonus' then
    if not exists (select 1 from public.mission_definitions x where x.active)
       or exists (select 1 from public.mission_definitions x
                   where x.active and not exists (select 1 from public.mission_claims c where c.user_id = uid and c.day = d and c.slug = x.slug)) then
      return json_build_object('ok', false, 'error', 'not_done');
    end if;
    v_amount := s.bonus;
  else
    select p.target, p.progress, p.reward into v_target, v_prog, v_amount
      from public._mission_progress(uid, d) p where p.slug = p_slug and p.active;
    if not found then return json_build_object('ok', false, 'error', 'unknown'); end if;
    if v_prog < v_target then return json_build_object('ok', false, 'error', 'not_done'); end if;
  end if;

  select coalesce(sum(c.amount), 0) into v_earned from public.mission_claims c where c.user_id = uid and c.day = d;
  v_amount := greatest(0, least(v_amount, s.daily_cap - v_earned));      -- the daily cap always holds
  insert into public.mission_claims (user_id, day, slug, amount) values (uid, d, p_slug, v_amount);
  if v_amount > 0 then
    bal := public._wallet_apply(uid, v_amount, 'reward', 'mission', p_slug, 'mission:' || d::text || ':' || p_slug, d::text, null);
  else
    select coalesce(w.balance, 0) into bal from public.user_wallets w where w.user_id = uid;
  end if;
  return json_build_object('ok', true, 'amount', v_amount, 'balance', coalesce(bal, 0), 'earned', v_earned + v_amount);
end $$;
revoke all on function public.claim_daily_mission(text) from public, anon;
grant execute on function public.claim_daily_mission(text) to authenticated;

/* ================================================================= admin API */
create or replace function public.admin_missions_get() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_require('tournaments.manage');
  return json_build_object(
    'defs', coalesce((select json_agg(json_build_object('slug', d.slug, 'kind', d.kind, 'target', d.target, 'reward', d.reward,
                       'title_uz', d.title_uz, 'title_en', d.title_en, 'sort', d.sort, 'active', d.active) order by d.sort, d.slug)
                      from public.mission_definitions d), '[]'::json),
    'settings', (select json_build_object('bonus', s.bonus, 'daily_cap', s.daily_cap, 'min_moves', s.min_moves)
                   from public.mission_settings s where s.id));
end $$;
revoke all on function public.admin_missions_get() from public, anon;
grant execute on function public.admin_missions_get() to authenticated;

-- p_defs: [{slug, target, reward, title_uz, title_en, sort, active}] — existing missions only (kinds are fixed).
-- All-or-nothing: any invalid value or a configuration above the daily cap rolls the whole save back.
create or replace function public.admin_missions_save(p_defs jsonb, p_bonus int, p_daily_cap int, p_min_moves int, p_reason text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._admin_require('tournaments.manage');
  x jsonb;
  total int;
begin
  if jsonb_typeof(p_defs) <> 'array' then raise exception 'bad_settings' using errcode = 'P0001'; end if;
  if p_bonus not between 0 and 1000 or p_daily_cap not between 0 and 5000 or p_min_moves not between 0 and 200 then
    raise exception 'bad_settings' using errcode = 'P0001';
  end if;
  for x in select * from jsonb_array_elements(p_defs) loop
    if (x->>'target')::int not between 1 and 1000 then raise exception 'bad_target' using errcode = 'P0001'; end if;
    if (x->>'reward')::int not between 0 and 1000 then raise exception 'bad_reward' using errcode = 'P0001'; end if;
    if length(btrim(coalesce(x->>'title_uz', ''))) not between 1 and 120 or length(btrim(coalesce(x->>'title_en', ''))) not between 1 and 120 then
      raise exception 'bad_title' using errcode = 'P0001';
    end if;
    update public.mission_definitions
       set target = (x->>'target')::int, reward = (x->>'reward')::int,
           title_uz = btrim(x->>'title_uz'), title_en = btrim(x->>'title_en'),
           sort = coalesce((x->>'sort')::int, sort), active = coalesce((x->>'active')::boolean, active),
           updated_at = now(), updated_by = uid
     where slug = x->>'slug';
    if not found then raise exception 'unknown mission %', x->>'slug' using errcode = 'P0001'; end if;
  end loop;
  update public.mission_settings set bonus = p_bonus, daily_cap = p_daily_cap, min_moves = p_min_moves,
         updated_at = now(), updated_by = uid where id;
  select coalesce(sum(d.reward), 0) + p_bonus into total from public.mission_definitions d where d.active;
  if total > p_daily_cap then raise exception 'over_cap' using errcode = 'P0001'; end if;
  perform public._audit(uid, 'missions.save', 'missions', null, p_reason,
                        jsonb_build_object('defs', p_defs, 'bonus', p_bonus, 'daily_cap', p_daily_cap, 'min_moves', p_min_moves));
  return json_build_object('ok', true, 'max_daily', total);
end $$;
revoke all on function public.admin_missions_save(jsonb, int, int, int, text) from public, anon;
grant execute on function public.admin_missions_save(jsonb, int, int, int, text) to authenticated;
