-- Per-event background check requirement. The applicant-facing warning
-- ("All workers must pass a background check") only renders for groups
-- with this flag set, so coordinators can opt in event-by-event.
ALTER TABLE worker_groups
  ADD COLUMN IF NOT EXISTS bg_check_required boolean NOT NULL DEFAULT false;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS bg_check_required boolean NOT NULL DEFAULT false;

-- Clayton County Arena requires a background check.
UPDATE worker_groups
SET bg_check_required = true,
    updated_at = now()
WHERE code = 'clayton-county-arena-may-2026';
