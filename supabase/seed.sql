insert into public.providers (
  id,
  slug,
  name,
  category,
  origin,
  active
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'kiln',
    'Kiln Studio',
    'workshop',
    'https://serendipity-phase0-kiln.vercel.app',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'nori',
    'Nori Counter',
    'food',
    'https://serendipity-phase0-nori.vercel.app',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'loop',
    'Loop Room',
    'culture',
    'https://serendipity-phase0-loop.vercel.app',
    true
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  origin = excluded.origin,
  active = excluded.active,
  updated_at = clock_timestamp();

insert into public.locations (
  id,
  provider_id,
  name,
  address_short,
  map_x,
  map_y,
  active
)
values
  ('kiln.main', '00000000-0000-4000-8000-000000000001', 'Kiln Studio', 'Shibuya', 12, 18, true),
  ('kiln.annex', '00000000-0000-4000-8000-000000000001', 'Kiln Annex', 'Shibuya', 16, 22, true),
  ('nori.counter', '00000000-0000-4000-8000-000000000002', 'Nori Counter', 'Shibuya', 48, 48, true),
  ('nori.tea', '00000000-0000-4000-8000-000000000002', 'Nori Tea Bar', 'Shibuya', 44, 43, true),
  ('loop.room', '00000000-0000-4000-8000-000000000003', 'Loop Room', 'Shibuya', 82, 72, true),
  ('loop.lounge', '00000000-0000-4000-8000-000000000003', 'Loop Lounge', 'Shibuya', 77, 67, true)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  name = excluded.name,
  address_short = excluded.address_short,
  map_x = excluded.map_x,
  map_y = excluded.map_y,
  active = excluded.active;

insert into public.travel_times (from_location_id, to_location_id, minutes)
values
  ('kiln.main', 'nori.counter', 20),
  ('kiln.main', 'nori.tea', 18),
  ('kiln.annex', 'nori.counter', 22),
  ('kiln.annex', 'nori.tea', 19),
  ('nori.counter', 'kiln.main', 20),
  ('nori.counter', 'kiln.annex', 22),
  ('nori.counter', 'loop.room', 18),
  ('nori.counter', 'loop.lounge', 15),
  ('nori.tea', 'kiln.main', 18),
  ('nori.tea', 'kiln.annex', 19),
  ('nori.tea', 'loop.room', 20),
  ('nori.tea', 'loop.lounge', 17),
  ('loop.room', 'nori.counter', 18),
  ('loop.room', 'nori.tea', 20),
  ('loop.lounge', 'nori.counter', 15),
  ('loop.lounge', 'nori.tea', 17)
on conflict (from_location_id, to_location_id) do update set
  minutes = excluded.minutes;

insert into public.slots (
  id,
  seed_key,
  provider_id,
  location_id,
  title,
  starts_at,
  ends_at,
  price_yen,
  original_price_yen,
  capacity_total,
  capacity_remaining,
  status,
  tags,
  novelty_score,
  inventory_version
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'kiln.beginner-pottery',
    '00000000-0000-4000-8000-000000000001',
    'kiln.main',
    'Beginner pottery',
    '2030-05-17T18:15:00+09:00',
    '2030-05-17T19:15:00+09:00',
    1500,
    2500,
    2,
    2,
    'ACTIVE',
    array['creative', 'hands-on', 'beginner'],
    0.900,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'kiln.paper-lantern',
    '00000000-0000-4000-8000-000000000001',
    'kiln.annex',
    'Paper lantern sprint',
    '2030-05-17T18:05:00+09:00',
    '2030-05-17T18:50:00+09:00',
    1900,
    2400,
    2,
    2,
    'ACTIVE',
    array['creative', 'hands-on', 'cozy'],
    0.640,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'kiln.glaze-lab',
    '00000000-0000-4000-8000-000000000001',
    'kiln.main',
    'Tiny glaze lab',
    '2030-05-17T18:30:00+09:00',
    '2030-05-17T19:20:00+09:00',
    2200,
    2800,
    1,
    1,
    'ACTIVE',
    array['creative', 'craft', 'analog'],
    0.720,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'nori.seasonal-counter',
    '00000000-0000-4000-8000-000000000002',
    'nori.counter',
    'Seasonal counter tasting',
    '2030-05-17T19:40:00+09:00',
    '2030-05-17T20:30:00+09:00',
    1800,
    3000,
    2,
    2,
    'ACTIVE',
    array['seasonal', 'food', 'solo-friendly'],
    0.780,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'nori.tea-flight',
    '00000000-0000-4000-8000-000000000002',
    'nori.tea',
    'Three-cup tea flight',
    '2030-05-17T19:25:00+09:00',
    '2030-05-17T20:10:00+09:00',
    1600,
    2100,
    2,
    2,
    'ACTIVE',
    array['seasonal', 'tea', 'cozy'],
    0.630,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'nori.late-bites',
    '00000000-0000-4000-8000-000000000002',
    'nori.counter',
    'Late counter bites',
    '2030-05-17T20:00:00+09:00',
    '2030-05-17T20:50:00+09:00',
    1400,
    2000,
    1,
    1,
    'ACTIVE',
    array['seasonal', 'food', 'solo-friendly'],
    0.680,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'loop.experimental-listening',
    '00000000-0000-4000-8000-000000000003',
    'loop.room',
    'Experimental listening room',
    '2030-05-17T21:00:00+09:00',
    '2030-05-17T22:00:00+09:00',
    1200,
    2000,
    2,
    2,
    'ACTIVE',
    array['experimental', 'music', 'intimate'],
    0.960,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    'loop.vinyl-circle',
    '00000000-0000-4000-8000-000000000003',
    'loop.lounge',
    'Vinyl listening circle',
    '2030-05-17T20:45:00+09:00',
    '2030-05-17T21:35:00+09:00',
    1400,
    1900,
    3,
    3,
    'ACTIVE',
    array['music', 'analog', 'intimate'],
    0.700,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000009',
    'loop.late-experiment',
    '00000000-0000-4000-8000-000000000003',
    'loop.room',
    'Late sound experiment',
    '2030-05-17T21:15:00+09:00',
    '2030-05-17T22:10:00+09:00',
    1000,
    1600,
    2,
    2,
    'ACTIVE',
    array['experimental', 'music', 'analog'],
    0.620,
    1
  )
on conflict (id) do update set
  seed_key = excluded.seed_key,
  provider_id = excluded.provider_id,
  location_id = excluded.location_id,
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  price_yen = excluded.price_yen,
  original_price_yen = excluded.original_price_yen,
  capacity_total = excluded.capacity_total,
  capacity_remaining = excluded.capacity_remaining,
  status = excluded.status,
  tags = excluded.tags,
  novelty_score = excluded.novelty_score,
  inventory_version = excluded.inventory_version,
  updated_at = clock_timestamp();

insert into private.demo_slot_baselines (
  slot_id,
  title,
  starts_at,
  ends_at,
  price_yen,
  original_price_yen,
  capacity_total,
  capacity_remaining,
  status,
  tags,
  novelty_score,
  inventory_version
)
select
  id,
  title,
  starts_at,
  ends_at,
  price_yen,
  original_price_yen,
  capacity_total,
  capacity_remaining,
  status,
  tags,
  novelty_score,
  inventory_version
from public.slots
on conflict (slot_id) do update set
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  price_yen = excluded.price_yen,
  original_price_yen = excluded.original_price_yen,
  capacity_total = excluded.capacity_total,
  capacity_remaining = excluded.capacity_remaining,
  status = excluded.status,
  tags = excluded.tags,
  novelty_score = excluded.novelty_score,
  inventory_version = excluded.inventory_version;
