-- Add to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'single_event',
  ADD COLUMN IF NOT EXISTS meeting_point text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supervisor_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supervisor_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS briefing_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS briefing_date date,
  ADD COLUMN IF NOT EXISTS briefing_time time,
  ADD COLUMN IF NOT EXISTS briefing_location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS briefing_slots jsonb DEFAULT '[]';

-- Add to assignments table
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS shift_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS survey_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS briefing_slot text,
  ADD COLUMN IF NOT EXISTS briefing_confirmed boolean NOT NULL DEFAULT false;

-- Surveys table
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.assignments(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id),
  worker_id uuid NOT NULL REFERENCES public.applicants(id),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  showed_up boolean,
  rating integer,
  would_work_again boolean,
  issues text NOT NULL DEFAULT '',
  feedback text NOT NULL DEFAULT '',
  submitted_at timestamptz
);
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
