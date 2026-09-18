-- supabase/migrations/20260821000000_geo_search.sql
-- "خريطة تفاعلية للعقارات" phase B — the real fix for haversineKm's
-- long-standing limitation (client-side distance filtering only ever
-- worked on whichever page was already loaded). Adds:
--
--   1. properties_in_radius(...) — an indexed circular radius search
--      (earthdistance + cube, Postgres's built-in extensions — no PostGIS
--      needed for a plain radius query).
--   2. properties_in_bounds(...) — a rectangular bounding-box search,
--      used as the pre-filter for polygon ("منطقة اهتمام") search: the
--      client draws a polygon, computes its bounding box, calls this to
--      get the small set of candidates actually near the shape, then
--      does the exact point-in-polygon test on that already-small set
--      itself (lib/geo.ts's pointInPolygon) — genuinely real filtering,
--      not a client-side scan of the whole table, without needing the
--      much heavier PostGIS extension just for one shape test.
--
-- Both return just `id` (not full rows) — the client re-fetches those
-- specific ids through the normal SELECT (with the seller join) via
-- usePropertiesByIds-style `.in("id", ...)`, so there's exactly one
-- place that knows how to turn a properties row into a Property.

create extension if not exists cube;
create extension if not exists earthdistance;

-- ↔ powers the `@>` bounding-box pre-filter properties_in_radius uses
-- below — without this index that function's WHERE clause would still
-- be correct, just a full table scan instead of an index lookup.
create index if not exists properties_earth_idx
  on public.properties using gist (ll_to_earth(lat, lng))
  where lat is not null and lng is not null;

create or replace function public.properties_in_radius(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision,
  p_purpose text default null,
  p_type text default null,
  p_provinces text[] default null,
  p_regions text[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_area_min numeric default null,
  p_area_max numeric default null,
  p_min_rooms numeric default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table(id uuid)
language sql stable
as $$
  select p.id
  from public.properties p
  where p.lat is not null and p.lng is not null
    and earth_box(ll_to_earth(center_lat, center_lng), radius_km * 1000) @> ll_to_earth(p.lat, p.lng)
    and earth_distance(ll_to_earth(center_lat, center_lng), ll_to_earth(p.lat, p.lng)) <= radius_km * 1000
    and (p_purpose is null or p_purpose = 'all' or p.purpose = p_purpose)
    and (p_type is null or p_type = 'all' or p.type = p_type)
    and (p_provinces is null or p.province = any(p_provinces))
    and (p_regions is null or p.location = any(p_regions))
    and (p_price_min is null or p.price >= p_price_min)
    and (p_price_max is null or p.price <= p_price_max)
    and (p_area_min is null or p.area >= p_area_min)
    and (p_area_max is null or p.area <= p_area_max)
    and (p_min_rooms is null or p.rooms >= p_min_rooms)
    and (
      p_query is null or p_query = '' or
      p.title ilike '%' || p_query || '%' or p.location ilike '%' || p_query || '%' or
      p.type ilike '%' || p_query || '%' or p.description ilike '%' || p_query || '%' or
      p.province ilike '%' || p_query || '%'
    )
  order by p.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.properties_in_radius(
  double precision, double precision, double precision, text, text, text[], text[],
  numeric, numeric, numeric, numeric, numeric, text, int, int
) to authenticated;

-- ↔ "رسم مناطق الاهتمام" pre-filter — same filter set, plain rectangle
-- instead of a circle, no pagination (an intentionally small drawn area
-- rarely needs it — see PolygonSearchModal's cap).
create or replace function public.properties_in_bounds(
  min_lat double precision,
  max_lat double precision,
  min_lng double precision,
  max_lng double precision,
  p_purpose text default null,
  p_type text default null,
  p_limit int default 500
)
returns table(id uuid)
language sql stable
as $$
  select p.id
  from public.properties p
  where p.lat is not null and p.lng is not null
    and p.lat between min_lat and max_lat
    and p.lng between min_lng and max_lng
    and (p_purpose is null or p_purpose = 'all' or p.purpose = p_purpose)
    and (p_type is null or p_type = 'all' or p.type = p_type)
  order by p.created_at desc
  limit p_limit;
$$;

grant execute on function public.properties_in_bounds(
  double precision, double precision, double precision, double precision, text, text, int
) to authenticated;
