-- Mirror the three featured worker_groups (Clayton County Arena, Rolling Loud
-- Orlando, Bonnaroo) into the events table so the coordinator dashboard can
-- manage shifts/workers/payments for them. Idempotent: only inserts when
-- no event already exists for the same title+date.

INSERT INTO events (title, organizer, contact_name, contact_email, contact_phone,
                    event_date, start_time, end_time, location, city,
                    workers_needed, role_types, status, service_tier, service_type)
SELECT 'Clayton County Arena', 'V&A Hire — Featured', 'V&A Hire', 'mfessbar@gmail.com', '',
       '2026-05-01', '12:00:00', '23:00:00',
       'Clayton County International Park', 'Jonesboro, GA',
       20, ARRAY['general_labor', 'setup_breakdown'], 'pending', 'labor_supply', 'single_event'
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE title = 'Clayton County Arena' AND event_date = '2026-05-01'
);

INSERT INTO events (title, organizer, contact_name, contact_email, contact_phone,
                    event_date, start_time, end_time, location, city,
                    workers_needed, role_types, status, service_tier, service_type)
SELECT 'Rolling Loud Orlando', 'V&A Hire — Featured', 'V&A Hire', 'mfessbar@gmail.com', '',
       '2026-05-08', '12:00:00', '23:00:00',
       'Tinker Field', 'Orlando, FL',
       40, ARRAY['general_labor', 'cleanup', 'setup_breakdown'], 'pending', 'labor_supply', 'single_event'
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE title = 'Rolling Loud Orlando' AND event_date = '2026-05-08'
);

INSERT INTO events (title, organizer, contact_name, contact_email, contact_phone,
                    event_date, start_time, end_time, location, city,
                    workers_needed, role_types, status, service_tier, service_type)
SELECT 'Bonnaroo Music & Arts Festival', 'V&A Hire — Featured', 'V&A Hire', 'mfessbar@gmail.com', '',
       '2026-06-11', '10:00:00', '23:00:00',
       'Great Stage Park', 'Manchester, TN',
       50, ARRAY['general_labor', 'cleanup', 'setup_breakdown'], 'pending', 'labor_supply', 'single_event'
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE title = 'Bonnaroo Music & Arts Festival' AND event_date = '2026-06-11'
);
