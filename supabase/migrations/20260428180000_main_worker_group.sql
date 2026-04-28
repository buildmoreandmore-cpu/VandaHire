-- Master roster: every applicant is auto-enrolled here on submit, in addition
-- to any event/recruitment group they came in through.
INSERT INTO worker_groups (name, code, type, description, featured, archived)
VALUES (
  'All Workers',
  'all-workers',
  'recruitment',
  'Master roster — every applicant is auto-added on signup.',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  archived = false,
  updated_at = now();

-- Backfill: enroll every existing applicant into the master roster (idempotent
-- thanks to the unique (group_id, worker_id) constraint).
INSERT INTO worker_group_members (group_id, worker_id)
SELECT g.id, a.id
FROM worker_groups g
CROSS JOIN applicants a
WHERE g.code = 'all-workers'
ON CONFLICT (group_id, worker_id) DO NOTHING;
