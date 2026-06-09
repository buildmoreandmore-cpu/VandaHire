-- Records each bulk email send so we can later resend to non-openers.

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  subject     text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT '',
  channel     text        NOT NULL DEFAULT 'email',
  recipients  jsonb       NOT NULL DEFAULT '[]',   -- array of recipient emails
  sent_count  integer     NOT NULL DEFAULT 0
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
