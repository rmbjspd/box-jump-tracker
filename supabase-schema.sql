-- ============================================================
-- Project 36-Inch Counter — Supabase Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tuwmswxfwnxjzujuignq/sql
-- ============================================================

create table if not exists sessions (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  date        date not null,
  week        int not null,
  phase       int not null,
  type        text not null,
  box_height  int,
  squat_weight int,
  sets        int,
  reps        int,
  load        text,
  notes       text,
  cardio_type text,
  cardio_minutes int,
  bodyweight  int
);

-- Enable Row Level Security but allow all reads/writes with anon key
-- (single-user personal app — no auth needed)
alter table sessions enable row level security;

create policy "allow_all" on sessions
  for all
  using (true)
  with check (true);

-- Seed the baseline session
insert into sessions (date, week, phase, type, box_height, squat_weight, sets, reps, load, notes, bodyweight)
values (
  '2026-03-10', 1, 1,
  'Lower Strength (Deadlifts, Split Squats)',
  null, 81, 3, 10,
  'Squat 81 lbs / RDL 115 lbs / Calf 125 lbs',
  'Baseline session',
  255
);
