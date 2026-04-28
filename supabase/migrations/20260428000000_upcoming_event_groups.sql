-- Upcoming Event Groups: extend worker_groups so a recruitment group can
-- represent a real event displayed on the landing page.
ALTER TABLE worker_groups
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS event_end_date date,
  ADD COLUMN IF NOT EXISTS event_location text,
  ADD COLUMN IF NOT EXISTS event_city text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS worker_groups_featured_event_date_idx
  ON worker_groups (featured, event_date)
  WHERE featured = true AND archived = false;

-- Seed the three current upcoming events (idempotent on code uniqueness)
INSERT INTO worker_groups (name, code, type, description, featured, event_date, event_end_date, event_location, event_city)
VALUES
  ('Clayton County Arena',
   'clayton-county-arena-may-2026',
   'recruitment',
   'Crew sign-up for Clayton County Arena event on May 1, 2026.',
   true,
   '2026-05-01', NULL,
   'Clayton County International Park',
   'Jonesboro, GA'),
  ('Rolling Loud Orlando',
   'rolling-loud-orlando-may-2026',
   'recruitment',
   'Crew sign-up for Rolling Loud Orlando, May 8–10, 2026.',
   true,
   '2026-05-08', '2026-05-10',
   'Tinker Field',
   'Orlando, FL'),
  ('Bonnaroo Music & Arts Festival',
   'bonnaroo-june-2026',
   'recruitment',
   'Crew sign-up for Bonnaroo Music & Arts Festival, June 11–14, 2026.',
   true,
   '2026-06-11', '2026-06-14',
   'Great Stage Park',
   'Manchester, TN')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  featured = EXCLUDED.featured,
  event_date = EXCLUDED.event_date,
  event_end_date = EXCLUDED.event_end_date,
  event_location = EXCLUDED.event_location,
  event_city = EXCLUDED.event_city,
  archived = false,
  updated_at = now();
