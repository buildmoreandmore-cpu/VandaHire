-- Manual geofence activation per event + re-entry follow-up tracking.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS geofence_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.exit_records
  ADD COLUMN IF NOT EXISTS reply           text,
  ADD COLUMN IF NOT EXISTS reply_at        timestamptz,
  ADD COLUMN IF NOT EXISTS reentered_at    timestamptz,
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;
