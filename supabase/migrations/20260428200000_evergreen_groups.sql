-- Evergreen / "always hiring" recruitment groups: stay pinned on the
-- public landing's Upcoming Events block regardless of date. Useful for
-- ongoing roles at a fixed location (e.g. warehouse, regional crew pool).
ALTER TABLE worker_groups
  ADD COLUMN IF NOT EXISTS evergreen boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS worker_groups_evergreen_featured_idx
  ON worker_groups (evergreen, featured)
  WHERE evergreen = true AND featured = true AND archived = false;
