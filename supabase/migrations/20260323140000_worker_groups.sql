-- Worker Groups table
CREATE TABLE IF NOT EXISTS worker_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('crew', 'recruitment')),
  description text DEFAULT '',
  archived boolean DEFAULT false
);

-- Worker Group Members junction table
CREATE TABLE IF NOT EXISTS worker_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  group_id uuid REFERENCES worker_groups(id) ON DELETE CASCADE NOT NULL,
  worker_id uuid REFERENCES applicants(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(group_id, worker_id)
);

-- Source group tracking on applicants
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS source_group_id uuid REFERENCES worker_groups(id) ON DELETE SET NULL;
