-- TCR/A2P compliance: record when a worker affirmatively opted in to SMS
-- (checked the consent box on the application). Null = no SMS consent on file.

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz;
