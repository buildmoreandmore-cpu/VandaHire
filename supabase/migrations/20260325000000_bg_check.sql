-- Background check onboarding step
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_legal_name text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_address text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_city text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_state text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_zip text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_sex text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_race text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_dob text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_ssn_encrypted text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_ssn_last4 text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_consent_type text DEFAULT '90_days';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_signed_at timestamptz;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_ip text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_cleared boolean DEFAULT false;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_result_url text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS bg_check_reminder_count integer DEFAULT 0;
