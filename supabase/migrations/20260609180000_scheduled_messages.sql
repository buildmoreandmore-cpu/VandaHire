-- Scheduled bulk messages. Processed by the daily cron (Hobby plan = once/day),
-- so a message goes out on the cron run on/after its send_at date.

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  send_at     timestamptz NOT NULL,
  channel     text        NOT NULL DEFAULT 'both',
  subject     text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT '',
  worker_ids  jsonb       NOT NULL DEFAULT '[]',
  status      text        NOT NULL DEFAULT 'pending',  -- pending | sent | cancelled
  sent_at     timestamptz,
  result      jsonb
);

CREATE INDEX IF NOT EXISTS scheduled_messages_due_idx ON public.scheduled_messages (status, send_at);
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
