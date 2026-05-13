-- Support multi-day events and permanent/ongoing positions.
-- event_end_date is optional; is_ongoing flags positions with no fixed end.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_date date,
  ADD COLUMN IF NOT EXISTS is_ongoing boolean NOT NULL DEFAULT false;
