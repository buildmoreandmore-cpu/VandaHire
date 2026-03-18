-- Run this in your Supabase SQL editor to create the applicants table

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  zip text not null,
  roles text[] not null default '{}',
  availability text[] not null default '{}',
  answer_experience text not null default '',
  answer_availability text not null default '',
  answer_reliability text not null default '',
  score_breakdown jsonb,
  status text not null default 'pending',
  email_sent_at timestamptz
);

-- Row-level security: only service role can read/write (no client-side access)
alter table public.applicants enable row level security;

-- No public policies — all access is via service role key in API routes only

-- Migration from previous schema (run if upgrading existing table):
--
-- ALTER TABLE public.applicants
--   ADD COLUMN IF NOT EXISTS answer_experience text not null default '',
--   ADD COLUMN IF NOT EXISTS answer_availability text not null default '',
--   ADD COLUMN IF NOT EXISTS answer_reliability text not null default '',
--   DROP COLUMN IF EXISTS instagram_connected,
--   DROP COLUMN IF EXISTS facebook_connected,
--   DROP COLUMN IF EXISTS tiktok_connected,
--   DROP COLUMN IF EXISTS linkedin_connected,
--   DROP COLUMN IF EXISTS instagram_data,
--   DROP COLUMN IF EXISTS facebook_data,
--   DROP COLUMN IF EXISTS tiktok_data,
--   DROP COLUMN IF EXISTS linkedin_data,
--   DROP COLUMN IF EXISTS ai_score;
