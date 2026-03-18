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
  instagram_connected boolean not null default false,
  facebook_connected boolean not null default false,
  tiktok_connected boolean not null default false,
  linkedin_connected boolean not null default false,
  instagram_data jsonb,
  facebook_data jsonb,
  tiktok_data jsonb,
  linkedin_data jsonb,
  ai_score integer,
  score_breakdown jsonb,
  status text not null default 'pending',
  email_sent_at timestamptz
);

-- Row-level security: only service role can read/write (no client-side access)
alter table public.applicants enable row level security;

-- No public policies — all access is via service role key in API routes only
