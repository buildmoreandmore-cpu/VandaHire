-- VandaHire staffing platform schema
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
  bill_rate numeric(10,2),          -- what Vandahire charges the client per worker/hr
  total_bill_amount numeric(10,2),  -- total service-fee invoice amount
  invoice_status text not null default 'not_sent',  -- not_sent | sent | paid | overdue
  payment_status text not null default 'unpaid',    -- unpaid | partial | paid

  -- Stripe integration (Vandahire service-fee collection)
  stripe_checkout_session_id text,  -- Stripe Checkout Session ID
  stripe_payment_url text,          -- Stripe-hosted payment link URL
  stripe_payment_id text,           -- Stripe Payment Intent ID (set after payment)
  stripe_paid_at timestamptz,       -- when Stripe payment succeeded

  -- Status lifecycle: pending → approved → staffing → confirmed → completed | cancelled
  --   (awaiting_payment is used when approved but service fee not yet paid)
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
--
-- -- Add Stripe fields to events (Vandahire service-fee collection)
-- ALTER TABLE public.events
--   ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
--   ADD COLUMN IF NOT EXISTS stripe_payment_url text,
--   ADD COLUMN IF NOT EXISTS stripe_payment_id text,
--   ADD COLUMN IF NOT EXISTS stripe_paid_at timestamptz;

-- ============================================================
-- MIGRATION: Geofencing + Check-In/Out
-- ============================================================
-- Run this in Supabase SQL editor to add geofence + check-in fields:
--
-- ALTER TABLE public.events
--   ADD COLUMN IF NOT EXISTS latitude double precision,
--   ADD COLUMN IF NOT EXISTS longitude double precision,
--   ADD COLUMN IF NOT EXISTS geofence_radius_meters integer NOT NULL DEFAULT 200;
--
-- ALTER TABLE public.assignments
--   ADD COLUMN IF NOT EXISTS check_in_time timestamptz,
--   ADD COLUMN IF NOT EXISTS check_out_time timestamptz,
--   ADD COLUMN IF NOT EXISTS check_in_lat double precision,
--   ADD COLUMN IF NOT EXISTS check_in_lng double precision,
--   ADD COLUMN IF NOT EXISTS check_out_lat double precision,
--   ADD COLUMN IF NOT EXISTS check_out_lng double precision,
--   ADD COLUMN IF NOT EXISTS hours_tracked numeric(6,2);
--
-- -- Add supervisor flag to assignments
-- ALTER TABLE public.assignments
--   ADD COLUMN IF NOT EXISTS is_supervisor boolean NOT NULL DEFAULT false;
--
-- -- Add service tier to events (labor_supply | managed_labor)
-- ALTER TABLE public.events
--   ADD COLUMN IF NOT EXISTS service_tier text NOT NULL DEFAULT 'labor_supply';
--
-- -- Create incident log table
-- CREATE TABLE IF NOT EXISTS public.incident_log (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   created_at timestamptz NOT NULL DEFAULT now(),
--   event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
--   reporter_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
--   incident_type text NOT NULL DEFAULT 'other',
--   description text NOT NULL DEFAULT '',
--   resolved boolean NOT NULL DEFAULT false
-- );
-- ALTER TABLE public.incident_log ENABLE ROW LEVEL SECURITY;
-- CREATE INDEX IF NOT EXISTS idx_incident_log_event ON public.incident_log(event_id);
