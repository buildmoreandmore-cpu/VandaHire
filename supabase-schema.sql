-- Porter staffing platform schema
-- Run in Supabase SQL editor

-- ============================================================
-- APPLICANTS (workers)
-- ============================================================
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  zip text not null,
  roles text[] not null default '{}',
  availability text[] not null default '{}',
  experience_types text[] not null default '{}',
  availability_windows text[] not null default '{}',
  has_transportation text not null default '',
  short_notice text not null default '',
  notes text not null default '',
  photo_url text,
  score_breakdown jsonb,
  -- Status lifecycle: pending → qualified/needs_review/not_a_fit → approved/rejected
  status text not null default 'pending',
  email_sent_at timestamptz
);

alter table public.applicants enable row level security;

-- ============================================================
-- EVENTS (staffing requests from event holders)
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Event details
  title text not null,
  organizer text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null,
  city text not null,

  -- Staffing requirements
  workers_needed integer not null default 1,
  role_types text[] not null default '{}',
  pay_rate text not null default '',
  dress_code text not null default '',
  notes text not null default '',

  -- Billing / client payment tracking
  bill_rate numeric(10,2),          -- what Porter charges the client per worker/hr
  total_bill_amount numeric(10,2),  -- total invoice amount
  invoice_status text not null default 'not_sent',  -- not_sent | sent | paid | overdue
  payment_status text not null default 'unpaid',    -- unpaid | partial | paid

  -- Status lifecycle: pending → approved → staffing → confirmed → completed | cancelled
  status text not null default 'pending'
);

alter table public.events enable row level security;

-- ============================================================
-- ASSIGNMENTS (worker ↔ event link)
-- ============================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  worker_id uuid not null references public.applicants(id) on delete cascade,
  -- Status: invited → confirmed/declined | checked_in → completed | cancelled
  status text not null default 'invited',
  notes text not null default '',

  -- Worker pay tracking
  pay_rate numeric(10,2),           -- what the worker gets paid per hour
  hours_worked numeric(6,2),        -- actual hours worked
  payout_amount numeric(10,2),      -- total payout to worker
  payout_status text not null default 'pending',  -- pending | approved | paid

  -- Worker confirmation token (for self-service confirm/decline links)
  confirmation_token text,

  unique(event_id, worker_id)
);

alter table public.assignments enable row level security;

-- Index for fast token lookups (worker confirmation flow)
create index if not exists idx_assignments_confirmation_token
  on public.assignments(confirmation_token)
  where confirmation_token is not null;

-- No public policies — all access via service role key in API routes

-- ============================================================
-- Storage buckets (create in Supabase Dashboard → Storage)
-- ============================================================
-- 'applicant-photos' — public bucket for worker selfie photos

-- ============================================================
-- MIGRATION from previous version
-- ============================================================
-- If upgrading from the original schema, run:
--
-- -- Add billing fields to events
-- ALTER TABLE public.events
--   ADD COLUMN IF NOT EXISTS bill_rate numeric(10,2),
--   ADD COLUMN IF NOT EXISTS total_bill_amount numeric(10,2),
--   ADD COLUMN IF NOT EXISTS invoice_status text not null default 'not_sent',
--   ADD COLUMN IF NOT EXISTS payment_status text not null default 'unpaid';
--
-- -- Add pay/payout fields to assignments
-- ALTER TABLE public.assignments
--   ADD COLUMN IF NOT EXISTS pay_rate numeric(10,2),
--   ADD COLUMN IF NOT EXISTS hours_worked numeric(6,2),
--   ADD COLUMN IF NOT EXISTS payout_amount numeric(10,2),
--   ADD COLUMN IF NOT EXISTS payout_status text not null default 'pending',
--   ADD COLUMN IF NOT EXISTS confirmation_token text;
--
-- CREATE INDEX IF NOT EXISTS idx_assignments_confirmation_token
--   ON public.assignments(confirmation_token)
--   WHERE confirmation_token IS NOT NULL;
