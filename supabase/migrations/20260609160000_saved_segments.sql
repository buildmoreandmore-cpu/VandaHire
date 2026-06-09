-- Saved worker-list filter combinations (city/state/role/availability/status).

CREATE TABLE IF NOT EXISTS public.saved_segments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text        NOT NULL,
  filters     jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.saved_segments ENABLE ROW LEVEL SECURITY;
