-- Coordinator contact log per worker. One row per touchpoint so we can
-- see who reached out, when, and what they said.

CREATE TABLE IF NOT EXISTS public.applicant_notes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  applicant_id  uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  author        text        NOT NULL DEFAULT '',
  note          text        NOT NULL
);

CREATE INDEX IF NOT EXISTS applicant_notes_applicant_idx
  ON public.applicant_notes (applicant_id, created_at DESC);

ALTER TABLE public.applicant_notes ENABLE ROW LEVEL SECURITY;
