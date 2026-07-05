-- ============================================================
--  PARK AI — Supabase Schema
--  Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- Bookings table: every reservation made on the platform
create table if not exists bookings (
  id            bigint generated always as identity primary key,
  booking_id    text not null,
  lot_id        int not null,
  lot_name      text not null,
  lot_area      text not null,
  spot_code     text not null,
  vehicle       text not null,
  duration_hrs  int not null,
  total_paid    numeric not null,
  created_at    timestamptz default now()
);

-- Host listings table: driveways/garages listed by homeowners
create table if not exists host_listings (
  id            bigint generated always as identity primary key,
  name          text not null,
  type          text not null,
  spots         int not null,
  rate          numeric not null,
  status        text default 'active',
  bookings      int default 0,
  earned        numeric default 0,
  views         int default 0,
  created_at    timestamptz default now()
);

-- IoT sensor readings table: real ESP32 nodes write here via REST/MQTT bridge
create table if not exists sensor_readings (
  id            bigint generated always as identity primary key,
  node_id       text not null,
  lot_id        int not null,
  slot_id       text not null,
  occupied      boolean not null,
  distance_cm   numeric,
  rssi_dbm      int,
  temp_c        numeric,
  reported_at   timestamptz default now()
);

-- Enable Row Level Security (RLS) — required by Supabase for anon access
alter table bookings        enable row level security;
alter table host_listings   enable row level security;
alter table sensor_readings enable row level security;

-- Allow anyone (anon key) to read and write — fine for a hackathon demo.
-- For production you'd restrict this to authenticated users / service role.
create policy "public read bookings"   on bookings        for select using (true);
create policy "public write bookings"  on bookings        for insert with check (true);

create policy "public read listings"   on host_listings    for select using (true);
create policy "public write listings"  on host_listings    for insert with check (true);
create policy "public update listings" on host_listings    for update using (true);

create policy "public read sensors"    on sensor_readings  for select using (true);
create policy "public write sensors"   on sensor_readings  for insert with check (true);

-- Enable realtime so the app can subscribe to live INSERTs
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table sensor_readings;
