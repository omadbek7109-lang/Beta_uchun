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
do $$ begin perform public.pass_grant_premium('d4444444-4444-4444-4444-444444444444'); perform public._p_check('non-admin cannot grant Premium', false);
exception when others then perform public._p_check('non-admin cannot grant Premium', true); end $$;

-- Premium with Telegram Stars: order → precheck → successful_payment (service role, as the Edge Functions do)
reset role;
update public.profiles set tg_id = 555001 where id = 'd4444444-4444-4444-4444-444444444444';
create temp table _o as select (public.pass_order_create('d4444444-4444-4444-4444-444444444444')->>'order_id')::uuid as id;
grant select on _o to public;
select public._p_check('order is 99 Stars', (select stars from public.pass_orders where id = (select id from _o)) = 99);
select public._p_check('precheck: wrong amount refused', public.pass_payment_precheck((select id from _o), 50, 'XTR', 555001) = 'amount mismatch');
select public._p_check('precheck: wrong account refused', public.pass_payment_precheck((select id from _o), 99, 'XTR', 999) = 'wrong account');
select public._p_check('precheck ok', public.pass_payment_precheck((select id from _o), 99, 'XTR', 555001) is null);
select public._p_check('no Premium before the payment', not exists (select 1 from public.pass_elite where user_id = 'd4444444-4444-4444-4444-444444444444'));
select public._p_check('payment completes', (public.pass_payment_complete((select id from _o), 'charge-001', null, 99, 555001, '{}'::jsonb)->>'ok')::boolean);
select public._p_check('same charge again = duplicate', (public.pass_payment_complete((select id from _o), 'charge-001', null, 99, 555001, '{}'::jsonb)->>'duplicate')::boolean);
select public._p_check('Premium opened once', (select count(*) from public.pass_elite where user_id = 'd4444444-4444-4444-4444-444444444444') = 1);
do $$ begin perform public.pass_order_create('d4444444-4444-4444-4444-444444444444'); perform public._p_check('second order refused (already premium)', false);
exception when others then perform public._p_check('second order refused (already premium)', true); end $$;
set role authenticated;
select public._p_check('pass_me sends the 40 rewards', json_array_length(public.pass_me()->'rewards') = 40);
select public._p_check('elite 2 gives the item', public.pass_claim(2, 'elite')->>'item' = 'st-royal-gold');
select public._p_check('elite 1 = 250 coins', (public.pass_claim(1, 'elite')->>'coins')::int = 250);
-- free 3 = XP +10% for 3 days → today's 360 → 396
select public._p_check('free 3 starts a booster', (public.pass_claim(3, 'free')->>'boost')::int = 10);
select public._p_check('xp boosted = 396', (public.pass_me()->>'xp')::int = 396, public.pass_me()->>'xp');
select public._p_check('boost_today = 10', (public.pass_me()->>'boost_today')::int = 10);
reset role;
select public._p_check('item in inventory', exists (select 1 from public.user_inventory where user_id = 'd4444444-4444-4444-4444-444444444444' and item_slug = 'st-royal-gold' and source = 'reward'));
-- wallet: 50 (free 1) + 250 (elite 1)
select public._p_check('wallet = 300', (select balance from public.user_wallets where user_id = 'd4444444-4444-4444-4444-444444444444') = 300,
                       (select balance::text from public.user_wallets where user_id = 'd4444444-4444-4444-4444-444444444444'));

-- daily cap: 40 more rated wins today → live capped at 20/day; total today capped at 1000
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at)
select 'd4444444-4444-4444-4444-444444444444','e5555555-5555-5555-5555-555555555555','finished',true,'white',30, now() - make_interval(secs => 100 + i), now() - make_interval(secs => i)
  from generate_series(1, 40) i;
set role authenticated;
select public._p_check('today capped at 1000', (public.pass_me()->'today'->>'today')::int = 1000 and (public.pass_me()->'today'->>'capped')::boolean,
                       public.pass_me()->'today'->>'today');
-- yesterday: 20 rated wins → 800 (no booster then) → 1 000 + 800 = 1 800 XP = level 8
reset role;
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at)
select 'd4444444-4444-4444-4444-444444444444','e5555555-5555-5555-5555-555555555555','finished',true,'white',30,
       now() - interval '1 day' - make_interval(mins => i + 1), now() - interval '1 day' - make_interval(mins => i)
  from generate_series(1, 20) i;
set role authenticated;
select set_config('request.jwt.claim.sub','d4444444-4444-4444-4444-444444444444', false);
select public._p_check('season xp = 1800', (public.pass_me()->>'xp')::int = 1800, public.pass_me()->>'xp');
-- a non-limited board: granted with the next serial, never touches Limited stock
select public._p_check('free 9 gives Graphite board', public.pass_claim(9, 'free')->>'item' = 'graphite');
reset role;
select public._p_check('board collection row with serial', exists (select 1 from public.user_board_collections where user_id = 'd4444444-4444-4444-4444-444444444444' and board_slug = 'graphite' and price_paid = 0));
set role authenticated;
-- emoji pack: 3 emoji, the first one worn at once, visible to everyone
select public._p_check('free 6 gives an emoji pack', public.pass_claim(6, 'free')->>'cosmetic' = 'emoji');
select public._p_check('3 emoji owned', json_array_length(public.pass_me()->'owned') = 3);
select public._p_check('the first emoji is worn', public.pass_me()->'equipped'->>'emoji' = 'e-crown');
select public._p_check('anyone can see what I wear', public.pass_worn('d4444444-4444-4444-4444-444444444444')->>'emoji' = 'e-crown');
-- currency and perk
select public._p_check('elite 5 claimed', (public.pass_claim(5, 'elite')->>'ok')::boolean);
select public._p_check('100 crystals in the pass wallet', (public.pass_me()->'wallet'->>'crystal')::int = 100);
select public._p_check('free 8 is an XP booster', (public.pass_claim(8, 'free')->>'boost')::int = 20);
-- background + equip; a box pays inside its range
select public._p_check('free 7 gives a background', public.pass_claim(7, 'free')->>'cosmetic' = 'background');
select public._p_check('equip it off and on', (public.pass_equip('background', null)->>'ok')::boolean and (public.pass_equip('background', 'bg-night')->>'ok')::boolean);
select public._p_check('cannot wear what I do not own', not (public.pass_equip('frame', 'f-legend')->>'ok')::boolean);
reset role;
insert into public.mission_claims (user_id, day, slug, amount) values
 ('d4444444-4444-4444-4444-444444444444', public._pass_day() - 1, 'rated_5', 30),
 ('d4444444-4444-4444-4444-444444444444', public._pass_day() - 1, 'rated_win_2', 30),
 ('d4444444-4444-4444-4444-444444444444', public._pass_day() - 1, 'matches_3', 20);
set role authenticated;
-- + 3 missions yesterday (60); the +20% booster (free 8) now also counts today → level 10+
select public._p_check('free 14 claimed', (public.pass_claim(14, 'free')->>'ok')::boolean);
select public._p_check('mission slot perk active', json_array_length(public.pass_me()->'perks') = 1);
select public._p_check('box pays 50..250', (select (r->>'coins')::int between 50 and 250 from (select public.pass_claim(10, 'free') r) x));

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
