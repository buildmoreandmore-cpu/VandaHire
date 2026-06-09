-- Gate the PCG authorization email behind payment confirmation (Option B).
-- Consent is captured at signing; the authorization is only emailed to PCG
-- after the worker confirms they completed the PCG payment.

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS bg_check_signature_name        text,
  ADD COLUMN IF NOT EXISTS bg_check_paid_at               timestamptz,
  ADD COLUMN IF NOT EXISTS bg_check_authorization_sent_at timestamptz;
