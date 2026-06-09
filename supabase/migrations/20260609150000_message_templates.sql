-- Reusable message snippets for the SMS/email composers.

CREATE TABLE IF NOT EXISTS public.message_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text        NOT NULL,
  channel     text        NOT NULL DEFAULT 'both',  -- both | sms | email
  subject     text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT ''
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
