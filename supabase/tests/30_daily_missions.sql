-- Daily Missions (0030) scenario test. Run on a scratch database AFTER 00_supabase_stub.sql and all migrations:
--   psql -d scratch -f 00_supabase_stub.sql -f ../migrations/*.sql -f 30_daily_missions.sql
-- Never run against a real project (it inserts test users and games).
\set ON_ERROR_STOP 1
create table public._t_results (name text, ok boolean, detail text); grant all on public._t_results to public;
create function public._t_check(n text, cond boolean, d text default '') returns void language plpgsql security definer as $$ begin insert into public._t_results values (n, coalesce(cond,false), d); end $$;
insert into auth.users (id, email, raw_user_meta_data) values
 ('a1111111-1111-1111-1111-111111111111','a@x','{"username":"alpha"}'),
 ('b2222222-2222-2222-2222-222222222222','b@x','{"username":"bravo"}'),
 ('c3333333-3333-3333-3333-333333333333','c@x','{"username":"charlie"}');
-- A: 3 rated wins in a row, then a loss, 1 more win; a medium bot win; a short game (ignored); yesterday's game (ignored)
insert into public.matches (white_id, black_id, status, rated, result, move_count, started_at, ended_at) values
 ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','finished',true,'white',30, now()-interval '50 min', now()-interval '40 min'),
 ('b2222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111','finished',true,'black',30, now()-interval '39 min', now()-interval '35 min'),
 ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','finished',true,'white',30, now()-interval '34 min', now()-interval '30 min'),
 ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','finished',true,'black',30, now()-interval '29 min', now()-interval '25 min'),
 ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','finished',true,'white',30, now()-interval '24 min', now()-interval '20 min'),
 ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','finished',true,'white',4,  now()-interval '19 min', now()-interval '18 min'),
 ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','finished',true,'white',30, now()-interval '2 days', now()-interval '2 days');
insert into public.matches (white_id, status, rated, vs_bot, bot_level, result, move_count, started_at, ended_at) values
 ('a1111111-1111-1111-1111-111111111111','finished',false,true,'medium','white',40, now()-interval '15 min', now()-interval '10 min');
insert into public.referrals (inviter_id, invitee_id, code) values ('a1111111-1111-1111-1111-111111111111','c3333333-3333-3333-3333-333333333333','ABCDEFGH');
insert into public.mission_events (user_id, kind, ref) select 'a1111111-1111-1111-1111-111111111111','puzzle_solve','p'||g from generate_series(1,10) g;
update public.profiles set tg_id = 7550418397 where id = 'a1111111-1111-1111-1111-111111111111';

set role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claim.role','authenticated', false);
create temp table b as select public.daily_missions_me()::jsonb as j;
select public._t_check('7 missions listed', (select jsonb_array_length(j->'missions') from b) = 7);
select public._t_check('progress values', (select jsonb_object_agg(m->>'slug', (m->>'progress')::int) from b, jsonb_array_elements(j->'missions') m)
   = '{"puzzles_10":10,"invite_1":1,"bot_medium":1,"streak_3":3,"rated_5":5,"rated_win_2":2,"matches_3":3}'::jsonb,
   (select jsonb_object_agg(m->>'slug', (m->>'progress')::int)::text from b, jsonb_array_elements(j->'missions') m));
select public._t_check('bonus not claimable yet', (select public.claim_daily_mission('__bonus')::jsonb->>'error') = 'not_done');
select public._t_check('unknown slug', (select public.claim_daily_mission('zzz')::jsonb->>'error') = 'unknown');
create temp table c as select s.slug, public.claim_daily_mission(s.slug)::jsonb as r from (values ('puzzles_10'),('invite_1'),('bot_medium'),('streak_3'),('rated_5'),('rated_win_2'),('matches_3')) s(slug);
select public._t_check('all 7 claimed', (select bool_and((r->>'ok')::boolean) from c));
select public._t_check('duplicate claim refused', (select public.claim_daily_mission('streak_3')::jsonb->>'error') = 'already');
select public._t_check('bonus 60', (select (public.claim_daily_mission('__bonus')::jsonb->>'amount')::int) = 60);
select public._t_check('bonus once', (select public.claim_daily_mission('__bonus')::jsonb->>'error') = 'already');
select public._t_check('wallet = 300', (select (public.wallet_me()::jsonb->>'balance')::int) = 300);
select public._t_check('ledger rows idempotent', (select count(*) from public.wallet_transactions where ref_type='mission') = 8);
select public._t_check('me shows earned/claimed', (select (j->'claims') from (select public.daily_missions_me()::jsonb j) q) ? '__bonus');
-- client can't write state directly
do $$ begin begin insert into public.mission_claims values (auth.uid(), current_date, 'x', 999); perform public._t_check('direct insert blocked', false);
  exception when insufficient_privilege then perform public._t_check('direct insert blocked', true); end; end $$;
do $$ begin begin insert into public.mission_events (user_id, kind, ref) values (auth.uid(),'puzzle_solve','fake'); perform public._t_check('fake puzzle blocked', false);
  exception when insufficient_privilege then perform public._t_check('fake puzzle blocked', true); end; end $$;
-- admin: over cap rejected atomically, valid save ok
do $$ begin begin perform public.admin_missions_save('[{"slug":"invite_1","target":1,"reward":61,"title_uz":"x","title_en":"x","sort":20,"active":true}]', 60, 300, 12);
  perform public._t_check('over_cap rejected', false); exception when others then perform public._t_check('over_cap rejected', sqlerrm = 'over_cap', sqlerrm); end; end $$;
select public._t_check('rollback kept reward 60', (select (d->>'reward')::int from jsonb_array_elements(public.admin_missions_get()::jsonb->'defs') d where d->>'slug'='invite_1') = 60);
select public._t_check('valid admin save', (public.admin_missions_save('[{"slug":"puzzles_10","target":5,"reward":30,"title_uz":"5 ta jumboq","title_en":"5 puzzles","sort":10,"active":true}]', 60, 300, 12)::jsonb->>'max_daily')::int = 300);
-- B: no progress, not admin
select set_config('request.jwt.claim.sub','b2222222-2222-2222-2222-222222222222', false);
select public._t_check('B: rated_5 done (played 5 rated)', (select (public.claim_daily_mission('rated_5')::jsonb->>'amount')::int) = 30);
select public._t_check('B: invite not done', (select public.claim_daily_mission('invite_1')::jsonb->>'error') = 'not_done');
select public._t_check('B: streak 0 (lost every game)', (select (m->>'progress')::int from jsonb_array_elements(public.daily_missions_me()::jsonb->'missions') m where m->>'slug'='streak_3') = 1);
do $$ begin begin perform public.admin_missions_get(); perform public._t_check('non-admin forbidden', false);
  exception when insufficient_privilege then perform public._t_check('non-admin forbidden', true); end; end $$;
reset role;
select set_config('request.jwt.claim.sub','', false);
set role anon;
do $$ begin begin perform public.daily_missions_me(); perform public._t_check('anon blocked', false);
  exception when insufficient_privilege then perform public._t_check('anon blocked', true); end; end $$;
reset role;
select (case when ok then 'PASS ' else 'FAIL ' end) || name || coalesce(' '||nullif(detail,''),'') from public._t_results;
