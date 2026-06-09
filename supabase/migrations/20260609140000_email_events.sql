-- Resend delivery/open/click/bounce events for sent emails.

CREATE TABLE IF NOT EXISTS public.email_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resend_id   text,                       -- Resend's email id
  email       text        NOT NULL,       -- recipient (lowercased)
  type        text        NOT NULL,       -- sent | delivered | opened | clicked | bounced | complained | delivery_delayed
  subject     text,
  meta        jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS email_events_email_idx ON public.email_events (email, created_at DESC);
CREATE INDEX IF NOT EXISTS email_events_resend_idx ON public.email_events (resend_id);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
