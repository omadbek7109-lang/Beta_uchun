-- DAMEO Pass (0031) scenario test. Run on a scratch database AFTER 00_supabase_stub.sql and all migrations:
--   psql -d scratch -f 00_supabase_stub.sql -f ../migrations/*.sql -f 31_season_pass.sql
-- Never run against a real project (it inserts test users, games and coins).
\set ON_ERROR_STOP 1
create table if not exists public._p_results (name text, ok boolean, detail text); grant all on public._p_results to public;
create or replace function public._p_check(n text, cond boolean, d text default '') returns void language plpgsql security definer as $$
begin insert into public._p_results values (n, coalesce(cond, false), d); end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d4444444-4444-4444-4444-444444444444','d@x','{"username":"delta"}'),
 ('e5555555-5555-5555-5555-555555555555','e@x','{"username":"echo"}');

-- D today: 3 rated wins + 1 rated loss vs E, 1 short game (ignored), 12 practice-bot wins (10 count)
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at)
select 'd4444444-4444-4444-4444-444444444444','e5555555-5555-5555-5555-555555555555','finished',true,
       case when i < 4 then 'white' else 'black' end, 30, now() - make_interval(mins => 60 - i * 5), now() - make_interval(mins => 58 - i * 5)
  from generate_series(1, 4) i;
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at) values
 ('d4444444-4444-4444-4444-444444444444','e5555555-5555-5555-5555-555555555555','finished',true,'white',4, now()-interval '9 min', now()-interval '8 min');
insert into public.matches (white_id, black_id, status, rated, result, move_count, vs_bot, bot_level, started_at, ended_at)
select 'd4444444-4444-4444-4444-444444444444', null, 'finished', false, 'white', 30, true, 'easy', now() - make_interval(mins => 120 - i), now() - make_interval(mins => 119 - i)
  from generate_series(1, 12) i;
-- 3 missions + the bonus today
insert into public.mission_claims (user_id, day, slug, amount) values
 ('d4444444-4444-4444-4444-444444444444', public._pass_day(), 'rated_5', 30),
 ('d4444444-4444-4444-4444-444444444444', public._pass_day(), 'rated_win_2', 30),
 ('d4444444-4444-4444-4444-444444444444', public._pass_day(), 'matches_3', 20),
 ('d4444444-4444-4444-4444-444444444444', public._pass_day(), '__bonus', 60);

set role authenticated;
select set_config('request.jwt.claim.sub','d4444444-4444-4444-4444-444444444444', false);
select set_config('request.jwt.claim.role','authenticated', false);

-- expected: live 4 games × 15 = 60, 3 wins × 25 = 75, bot 10 × 10 = 100, missions 3 × 20 = 60, bonus 40 → 335
select public._p_check('xp before check-in = 335', (public.pass_me()->>'xp')::int = 335, public.pass_me()->>'xp');
select public._p_check('check-in ok', (public.pass_checkin()->>'ok')::boolean);
select public._p_check('second check-in refused', not (public.pass_checkin()->>'ok')::boolean);
select public._p_check('xp after check-in = 360', (public.pass_me()->>'xp')::int = 360, public.pass_me()->>'xp');
-- 360 XP → level 3 (150 / 300 / 450)
select public._p_check('claim free 1', (public.pass_claim(1, 'free')->>'ok')::boolean);
select public._p_check('claim free 1 again = already', public.pass_claim(1, 'free')->>'error' = 'already');
select public._p_check('claim free 4 = locked', public.pass_claim(4, 'free')->>'error' = 'locked');
select public._p_check('claim elite 1 without elite', public.pass_claim(1, 'elite')->>'error' = 'elite');
select public._p_check('unknown level', public.pass_claim(42, 'free')->>'error' = 'unknown');
select public._p_check('elite without coins', public.pass_buy_elite_coins()->>'error' = 'insufficient');

reset role;
select public._wallet_apply('d4444444-4444-4444-4444-444444444444', 5000, 'reward', 'test', null, 'test:topup', null, null);
set role authenticated;
select public._p_check('elite bought', (public.pass_buy_elite_coins()->>'ok')::boolean);
select public._p_check('elite twice = already', public.pass_buy_elite_coins()->>'error' = 'already');
-- boost: 360 × 1.2 = 432 (still level 2+), elite 2 = Obsidian stones (item) → granted
select public._p_check('xp boosted = 432', (public.pass_me()->>'xp')::int = 432, public.pass_me()->>'xp');
select public._p_check('elite 2 gives the item', public.pass_claim(2, 'elite')->>'item' = 'st-obsidian');
reset role;
select public._p_check('item in inventory', exists (select 1 from public.user_inventory where user_id = 'd4444444-4444-4444-4444-444444444444' and item_slug = 'st-obsidian' and source = 'reward'));
-- wallet: 30 (free 1) + 5000 − 3000 = 2030
select public._p_check('wallet = 2030', (select balance from public.user_wallets where user_id = 'd4444444-4444-4444-4444-444444444444') = 2030,
                       (select balance::text from public.user_wallets where user_id = 'd4444444-4444-4444-4444-444444444444'));

-- daily cap: 40 more rated wins today → live capped at 20/day; total today capped at 1000
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at)
select 'd4444444-4444-4444-4444-444444444444','e5555555-5555-5555-5555-555555555555','finished',true,'white',30, now() - make_interval(secs => 100 + i), now() - make_interval(secs => i)
  from generate_series(1, 40) i;
set role authenticated;
select public._p_check('today capped at 1000', (public.pass_me()->'today'->>'today')::int = 1000 and (public.pass_me()->'today'->>'capped')::boolean,
                       public.pass_me()->'today'->>'today');
-- yesterday: 20 rated wins → 800 × 1.2 = 960 more → 1 960 XP = level 9
reset role;
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at)
select 'd4444444-4444-4444-4444-444444444444','e5555555-5555-5555-5555-555555555555','finished',true,'white',30,
       now() - interval '1 day' - make_interval(mins => i + 1), now() - interval '1 day' - make_interval(mins => i)
  from generate_series(1, 20) i;
set role authenticated;
select set_config('request.jwt.claim.sub','d4444444-4444-4444-4444-444444444444', false);
select public._p_check('season xp = 1960', (public.pass_me()->>'xp')::int = 1960, public.pass_me()->>'xp');
-- a non-limited board: granted with the next serial, never touches Limited stock
select public._p_check('free 4 gives Graphite board', public.pass_claim(4, 'free')->>'item' = 'graphite');
reset role;
select public._p_check('board collection row with serial', exists (select 1 from public.user_board_collections where user_id = 'd4444444-4444-4444-4444-444444444444' and board_slug = 'graphite' and price_paid = 0));
set role authenticated;
-- title + equip
select public._p_check('claim free 7 (title)', public.pass_claim(7, 'free')->>'title' = 'season_player');
select public._p_check('equip title', (public.pass_equip_title('season_player')->>'ok')::boolean);
select public._p_check('cannot equip unowned title', not (public.pass_equip_title('season_king')->>'ok')::boolean);

-- E has nothing
select set_config('request.jwt.claim.sub','e5555555-5555-5555-5555-555555555555', false);
-- E: today 44 rated games, first 20 count (×15) + 1 win (25) = 325; yesterday 20 losses = 300
select public._p_check('E xp = 625', (public.pass_me()->>'xp')::int = 625, public.pass_me()->>'xp');

reset role;
set role anon;
select set_config('request.jwt.claim.sub','', false);
do $$ begin perform public.pass_me(); perform public._p_check('anon blocked', false);
exception when others then perform public._p_check('anon blocked', true); end $$;
reset role;

select case when ok then 'PASS' else 'FAIL' end || ' ' || name || case when ok then '' else ' (' || detail || ')' end from public._p_results;
select count(*) filter (where not ok) as failures from public._p_results;
