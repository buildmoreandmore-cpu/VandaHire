-- Vanda Hire staffing platform — complete schema
-- Reflects the live database as of 2026-03-19
-- Run in Supabase SQL editor on a fresh project (uses CREATE TABLE IF NOT EXISTS throughout)

-- ============================================================
-- APPLICANTS (workers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.applicants (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- Personal details
  first_name           text        NOT NULL,
  last_name            text        NOT NULL,
  email                text        NOT NULL,
  phone                text        NOT NULL,
  city                 text        NOT NULL,
  zip                  text        NOT NULL,

  -- Worker profile
  roles                text[]      NOT NULL DEFAULT '{}',
  availability         text[]      NOT NULL DEFAULT '{}',

  -- Social media connections
  instagram_connected  boolean     NOT NULL DEFAULT false,
  facebook_connected   boolean     NOT NULL DEFAULT false,
  tiktok_connected     boolean     NOT NULL DEFAULT false,
  linkedin_connected   boolean     NOT NULL DEFAULT false,
  instagram_data       jsonb,
  facebook_data        jsonb,
  tiktok_data          jsonb,
  linkedin_data        jsonb,

  -- AI scoring
  ai_score             integer,
  score_breakdown      jsonb,

  -- Status lifecycle: pending → approved | rejected
  status               text        NOT NULL DEFAULT 'pending',
  email_sent_at        timestamptz,

  -- Approval tracking
  approved_at          timestamptz,

  -- ID verification
  id_photo_url         text,

  -- W-9 tax form
  w9_legal_name        text,
  w9_business_name     text,
  w9_tax_class         text,
  w9_address           text,
  w9_city              text,
  w9_state             text        CHECK (length(w9_state) = 2),
  w9_zip               text        CHECK (w9_zip ~ '^\d{5}$'),
  w9_tin_encrypted     text,
  w9_tin_last4         text        CHECK (length(w9_tin_last4) = 4),
  w9_signed_at         timestamptz,
  w9_ip                text,
  w9_reminder_count    integer     NOT NULL DEFAULT 0,

  -- Bench system
  strikes              integer     NOT NULL DEFAULT 0
);

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EVENTS (staffing requests from event holders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- Event details
  title                       text        NOT NULL,
  organizer                   text        NOT NULL,
  contact_name                text        NOT NULL,
  contact_email               text        NOT NULL,
  contact_phone               text        NOT NULL,
  event_date                  date        NOT NULL,
  start_time                  time        NOT NULL,
  end_time                    time        NOT NULL,
  location                    text        NOT NULL,
  city                        text        NOT NULL,

  -- Staffing requirements
  workers_needed              integer     NOT NULL DEFAULT 1,
  role_types                  text[]      NOT NULL DEFAULT '{}',
  pay_rate                    text        NOT NULL DEFAULT '',
  dress_code                  text        NOT NULL DEFAULT '',
  notes                       text        NOT NULL DEFAULT '',

  -- Service configuration
  service_type                text        NOT NULL DEFAULT 'single_event',
  service_tier                text        NOT NULL DEFAULT 'labor_supply',  -- labor_supply | managed_labor
  meeting_point               text        NOT NULL DEFAULT '',
  supervisor_name             text        NOT NULL DEFAULT '',
  supervisor_phone            text        NOT NULL DEFAULT '',

  -- Briefing / pre-event session
  briefing_required           boolean     NOT NULL DEFAULT false,
  briefing_date               date,
  briefing_time               time,
  briefing_location           text        NOT NULL DEFAULT '',
  briefing_slots              jsonb                DEFAULT '[]',  -- array of slot objects

  -- Geofencing for check-in/out
  latitude                    double precision,
  longitude                   double precision,
  geofence_radius_meters      integer     NOT NULL DEFAULT 200,

  -- Billing / client payment tracking
  bill_rate                   numeric(10,2),          -- what Vanda Hire charges client per worker/hr
  total_bill_amount           numeric(10,2),          -- total service-fee invoice amount
  invoice_status              text        NOT NULL DEFAULT 'not_sent',   -- not_sent | sent | paid | overdue
  payment_status              text        NOT NULL DEFAULT 'unpaid',     -- unpaid | partial | paid

  -- Stripe integration (Vanda Hire service-fee collection)
  stripe_checkout_session_id  text,
  stripe_payment_url          text,
  stripe_payment_id           text,
  stripe_paid_at              timestamptz,
  stripe_customer_id          text,

  -- Bench system
  bench_coverage_threshold    numeric(5,2) NOT NULL DEFAULT 80.00,  -- % threshold to trigger escalation
  bench_pool_size             integer     NOT NULL DEFAULT 0,

  -- Status lifecycle: pending → approved → staffing → confirmed → completed | cancelled
  status                      text        NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ASSIGNMENTS (worker ↔ event link)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assignments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  event_id             uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  worker_id            uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,

  -- Status: invited → confirmed/declined | checked_in → completed | cancelled
  status               text        NOT NULL DEFAULT 'invited',
  notes                text        NOT NULL DEFAULT '',

  -- Briefing confirmation
  briefing_slot        text,
  briefing_confirmed   boolean     NOT NULL DEFAULT false,

  -- Geofenced check-in/out
  check_in_time        timestamptz,
  check_out_time       timestamptz,
  check_in_lat         double precision,
  check_in_lng         double precision,
  check_out_lat        double precision,
  check_out_lng        double precision,
  hours_tracked        numeric(6,2),   -- calculated from check-in → check-out

  -- Supervisor flag
  is_supervisor        boolean     NOT NULL DEFAULT false,

  -- Worker pay tracking
  pay_rate             numeric(10,2),  -- what the worker gets paid per hour
  hours_worked         numeric(6,2),   -- actual hours worked (mirrors hours_tracked on checkout)
  payout_amount        numeric(10,2),  -- total payout to worker
  payout_status        text        NOT NULL DEFAULT 'pending',  -- pending | approved | paid

  -- Notification timestamps
  shift_sent_at        timestamptz,   -- when shift-details SMS/email was sent
  survey_sent_at       timestamptz,   -- when post-event survey was sent

  -- Worker self-service confirmation link
  confirmation_token   text,

  UNIQUE(event_id, worker_id)
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assignments_confirmation_token
  ON public.assignments(confirmation_token)
  WHERE confirmation_token IS NOT NULL;

-- ============================================================
-- SURVEYS (post-event worker performance feedback)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.surveys (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  token           text        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  assignment_id   uuid        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  event_id        uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  worker_id       uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,

  -- Survey responses
  showed_up       boolean,
  rating          integer,             -- 1–5 star rating
  would_work_again boolean,
  issues          text        NOT NULL DEFAULT '',
  feedback        text        NOT NULL DEFAULT '',

  submitted_at    timestamptz,

  UNIQUE(assignment_id)
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_surveys_token
  ON public.surveys(token);

-- ============================================================
-- INCIDENT LOG (supervisor-reported on-site incidents)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incident_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  event_id        uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reporter_id     uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,

  -- incident_type: worker_issue | client_request | venue_issue | no_show | early_departure | other
  incident_type   text        NOT NULL DEFAULT 'other',
  description     text        NOT NULL DEFAULT '',
  resolved        boolean     NOT NULL DEFAULT false
);

ALTER TABLE public.incident_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_incident_log_event
  ON public.incident_log(event_id);

-- ============================================================
-- BENCH ASSIGNMENTS (standby worker pool per event)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bench_assignments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  event_id             uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  worker_id            uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,

  -- Bench status: standby → called_in → confirmed/declined/cancelled
  status               text        NOT NULL DEFAULT 'standby',
  tier                 integer     NOT NULL DEFAULT 1,       -- dispatch priority (1 = first called)
  standby_fee          numeric(10,2) NOT NULL DEFAULT 25.00, -- fee paid for being on standby
  notes                text        NOT NULL DEFAULT '',

  -- Dispatch tracking
  called_in_at         timestamptz,
  released_worker_id   uuid        REFERENCES public.applicants(id),

  UNIQUE(event_id, worker_id)
);

ALTER TABLE public.bench_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bench_assignments_event
  ON public.bench_assignments(event_id);

-- ============================================================
-- EXIT RECORDS (departure tracking + pay calculation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exit_records (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  event_id             uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  worker_id            uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  assignment_id        uuid        REFERENCES public.assignments(id) ON DELETE SET NULL,

  -- Exit details
  exit_reason          text        NOT NULL DEFAULT 'completed',
  -- exit_reason values: completed, early_with_notice, done, break_return, no_response,
  --   emergency, released_performance, released_downsized, released_client_request, released_unsafe

  hours_worked         numeric(6,2),
  scheduled_hours      numeric(6,2),
  pay_rate             numeric(10,2),
  pay_amount           numeric(10,2),
  strikes_applied      integer     NOT NULL DEFAULT 0,

  -- Worker reply (for geofence exit protocol)
  worker_reply         text,         -- break, done, emergency
  worker_reply_at      timestamptz,

  -- Dispute
  disputed             boolean     NOT NULL DEFAULT false,
  dispute_notes        text        NOT NULL DEFAULT '',

  -- Flags
  flag_organizer       boolean     NOT NULL DEFAULT false
);

ALTER TABLE public.exit_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_exit_records_event ON public.exit_records(event_id);
CREATE INDEX IF NOT EXISTS idx_exit_records_worker ON public.exit_records(worker_id);

-- ============================================================
-- QUOTES (event quotes with line items)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  event_id             uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Line items
  worker_count         integer     NOT NULL,
  hours_estimated      numeric(6,2) NOT NULL,
  bill_rate_per_hour   numeric(10,2) NOT NULL,
  labor_subtotal       numeric(10,2) NOT NULL,
  supervisor_fee       numeric(10,2) NOT NULL DEFAULT 0,
  bench_fee            numeric(10,2) NOT NULL DEFAULT 0,
  platform_fee         numeric(10,2) NOT NULL DEFAULT 0,
  roster_hold_fee      numeric(10,2) NOT NULL DEFAULT 0,
  processing_fee       numeric(10,2) NOT NULL DEFAULT 0,
  total                numeric(10,2) NOT NULL,

  -- Deposit = bench fees + labor + roster hold; Balance = total - deposit (Net 15)
  deposit_amount       numeric(10,2) NOT NULL,
  balance_amount       numeric(10,2) NOT NULL,

  -- Status: draft → sent → accepted → expired
  status               text        NOT NULL DEFAULT 'draft',
  accepted_at          timestamptz,
  expires_at           timestamptz,

  UNIQUE(event_id)
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PAYMENTS (deposit/balance tracking with Stripe refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  event_id                uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- payment_type: deposit, balance, full_prepay, refund
  payment_type            text        NOT NULL,
  amount                  numeric(10,2) NOT NULL,

  -- Stripe references
  stripe_payment_intent_id text,
  stripe_checkout_url     text,

  -- Status: pending → succeeded → failed | refunded
  status                  text        NOT NULL DEFAULT 'pending',
  paid_at                 timestamptz,

  -- Refund tracking
  refund_amount           numeric(10,2) DEFAULT 0,
  refund_reason           text,
  refunded_at             timestamptz
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payments_event ON public.payments(event_id);

-- ============================================================
-- NEW COLUMNS ON EVENTS (deposit/balance system)
-- ============================================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deposit_amount    numeric(10,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS balance_amount    numeric(10,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deposit_status    text NOT NULL DEFAULT 'none';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS balance_due_date  date;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_tier       text NOT NULL DEFAULT 'new';

-- ============================================================
-- PHASE 2: STRIPE CONNECT + WORKER PAYOUTS
-- ============================================================
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS stripe_connect_id text;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS total_earnings numeric(10,2) DEFAULT 0;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS shifts_completed integer DEFAULT 0;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS reliability_score numeric(3,2) DEFAULT 5.00;

CREATE TABLE IF NOT EXISTS public.worker_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  worker_id uuid NOT NULL REFERENCES public.applicants(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  assignment_id uuid REFERENCES public.assignments(id),
  hours_worked numeric(6,2) NOT NULL,
  pay_rate numeric(10,2) NOT NULL,
  gross_amount numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) NOT NULL DEFAULT 0,
  net_amount numeric(10,2) NOT NULL,
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz
);

ALTER TABLE public.worker_payouts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_worker_payouts_worker ON public.worker_payouts(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_payouts_event ON public.worker_payouts(event_id);

-- ============================================================
-- PHASE 4: CLIENT SURVEY COLUMNS ON EVENTS
-- ============================================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_rating integer;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_feedback text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_would_rebook boolean;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_survey_at timestamptz;

-- ============================================================
-- PHASE 2: SURGE PRICING COLUMNS ON QUOTES
-- ============================================================
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS surge_multiplier numeric(4,2) DEFAULT 1.00;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS surge_reasons text[] DEFAULT '{}';

-- ============================================================
-- NOTES
-- ============================================================
-- All tables use service role key for API access (no public RLS policies needed).
-- avg_rating and total_shifts for a worker are computed at query time via:
--   SELECT worker_id, AVG(rating) AS avg_rating, COUNT(*) AS total_shifts
--   FROM surveys WHERE showed_up = true GROUP BY worker_id;
--
-- Deposit covers: bench worker standby fees + labor cost + roster hold fee
-- Balance: Net 15 — due 15 days after the event
--
-- Storage bucket required:
--   'applicant-photos' — public bucket for worker selfie/profile photos
