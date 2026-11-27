-- DAMEO Winter City — DRAFT migration for main DAMEO (Phase 4). NOT applied anywhere yet.
-- Mirrors the beta rules in src/services/city/store.ts: the server owns prices, coins, inventory and placement.
-- Clients never write these tables directly: every change goes through the SECURITY DEFINER functions below.

create table if not exists city_shop_items (
  id text primary key,                 -- asset id ('house1', 'rink', …)
  cat text not null,
  price int not null check (price > 0),
  rarity text not null,
  w smallint not null, h smallint not null,
  ground text[] not null,              -- land | park | plaza | river
  xp int not null default 0,
  limited boolean not null default false,
  active boolean not null default true
);

create table if not exists winter_cities (
  owner uuid primary key references auth.users(id) on delete cascade,
  name text,
  xp int not null default 0,
  value int not null default 0,
  likes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists city_inventory (
  owner uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references city_shop_items(id),
  qty int not null default 0 check (qty >= 0),
  primary key (owner, asset_id)
);

create table if not exists city_buildings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references city_shop_items(id),
  x smallint not null, y smallint not null,
  rotation smallint not null default 0 check (rotation in (0, 1)),   -- 1 = mirrored
  state text not null default 'built',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists city_buildings_owner on city_buildings(owner);

-- one row per occupied tile: the primary key makes overlapping placements impossible
create table if not exists city_tiles (
  owner uuid not null,
  x smallint not null, y smallint not null,
  building uuid not null references city_buildings(id) on delete cascade,
  primary key (owner, x, y)
);

create table if not exists city_transactions (
  id bigserial primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  qty int not null,
  price int not null,
  idem text not null,
  created_at timestamptz not null default now(),
  unique (owner, idem)                 -- the same request twice = one purchase
);

create table if not exists city_visitors (owner uuid not null, visitor uuid not null, day date not null default current_date, primary key (owner, visitor, day));
create table if not exists city_likes (owner uuid not null, liker uuid not null, week date not null, primary key (owner, liker));
create table if not exists city_daily_tasks (owner uuid not null, period text not null, task text not null, taken_at timestamptz not null default now(), primary key (owner, period, task));
create table if not exists city_rewards (owner uuid not null, day date not null, kind text not null, primary key (owner, day, kind));
create table if not exists winter_event_progress (id int primary key default 1, snow bigint not null default 0, players int not null default 0, updated_at timestamptz not null default now());
-- city_zones / city_plots: the map is generated from a fixed seed (same on client and server); the server keeps
-- a copy of its tile types to validate coordinates:
create table if not exists city_map_tiles (x smallint not null, y smallint not null, kind smallint not null, primary key (x, y));

alter table winter_cities enable row level security;
alter table city_inventory enable row level security;
alter table city_buildings enable row level security;
alter table city_tiles enable row level security;
alter table city_transactions enable row level security;
alter table city_visitors enable row level security;
alter table city_likes enable row level security;
alter table city_daily_tasks enable row level security;
alter table city_rewards enable row level security;
alter table city_shop_items enable row level security;
alter table winter_event_progress enable row level security;
alter table city_map_tiles enable row level security;

-- read: everybody can look at cities (friends' visits), only the owner sees inventory / purchases
create policy "shop readable" on city_shop_items for select using (true);
create policy "cities readable" on winter_cities for select using (true);
create policy "buildings readable" on city_buildings for select using (true);
create policy "own inventory" on city_inventory for select using (owner = auth.uid());
create policy "own transactions" on city_transactions for select using (owner = auth.uid());
create policy "event readable" on winter_event_progress for select using (true);
-- no insert/update/delete policies: writes only through the functions below

create or replace function city_buy(p_asset text, p_qty int, p_idem text) returns int
language plpgsql security definer set search_path = public as $$
declare it city_shop_items; cost int;
begin
  if auth.uid() is null or p_qty < 1 or p_qty > 50 then raise exception 'bad request'; end if;
  select * into it from city_shop_items where id = p_asset and active;
  if not found then raise exception 'unknown item'; end if;
  -- (limited items: check the event window here)
  insert into city_transactions(owner, asset_id, qty, price, idem) values (auth.uid(), p_asset, p_qty, it.price, p_idem)
    on conflict (owner, idem) do nothing;
  if not found then return (select qty from city_inventory where owner = auth.uid() and asset_id = p_asset); end if;
  cost := it.price * p_qty;
  perform wallet_spend(auth.uid(), cost, 'city_item', p_asset, p_idem);   -- existing DAMEO wallet function (raises when short)
  insert into city_inventory(owner, asset_id, qty) values (auth.uid(), p_asset, p_qty)
    on conflict (owner, asset_id) do update set qty = city_inventory.qty + excluded.qty;
  return (select qty from city_inventory where owner = auth.uid() and asset_id = p_asset);
end $$;

create or replace function city_place(p_asset text, p_x int, p_y int, p_rot int) returns uuid
language plpgsql security definer set search_path = public as $$
declare it city_shop_items; bid uuid; bad int;
begin
  select * into it from city_shop_items where id = p_asset;
  update city_inventory set qty = qty - 1 where owner = auth.uid() and asset_id = p_asset and qty > 0;
  if not found then raise exception 'not in inventory'; end if;
  -- every footprint tile must be on the map and of an allowed ground
  select count(*) into bad from generate_series(p_x, p_x + it.w - 1) gx cross join generate_series(p_y, p_y + it.h - 1) gy
    left join city_map_tiles t on t.x = gx and t.y = gy
    where t.kind is null or not (
      (t.kind = 0 and 'land' = any(it.ground)) or (t.kind = 5 and 'park' = any(it.ground)) or
      (t.kind = 6 and 'plaza' = any(it.ground)) or ('river' = any(it.ground) and t.kind in (0, 3, 5)));
  if bad > 0 then raise exception 'ground'; end if;
  insert into city_buildings(owner, asset_id, x, y, rotation) values (auth.uid(), p_asset, p_x, p_y, p_rot) returning id into bid;
  insert into city_tiles(owner, x, y, building)
    select auth.uid(), gx, gy, bid from generate_series(p_x, p_x + it.w - 1) gx cross join generate_series(p_y, p_y + it.h - 1) gy;
    -- a taken tile violates the primary key → the whole call rolls back (inventory included)
  insert into winter_cities(owner, xp, value) values (auth.uid(), it.xp, it.price)
    on conflict (owner) do update set xp = winter_cities.xp + it.xp, value = winter_cities.value + it.price, updated_at = now();
  return bid;
end $$;
-- city_move(building, x, y, rot) and city_store(building) follow the same pattern, always with owner = auth.uid().
