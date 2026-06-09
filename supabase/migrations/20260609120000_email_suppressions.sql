-- Email unsubscribe / suppression list. Addresses here are skipped on bulk sends.

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email       text        PRIMARY KEY,
  reason      text        NOT NULL DEFAULT 'unsubscribe',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
