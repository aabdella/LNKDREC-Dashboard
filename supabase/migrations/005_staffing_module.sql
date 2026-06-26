-- Migration 005: Staffing Module
-- Team Staffing & Project Quoting tables

-- Clients table (reusable across projects)
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  contact_email text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  project_type text NOT NULL CHECK (project_type IN ('feature', 'module', 'full_solution')),
  offering_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'active', 'on_hold', 'completed', 'lost')),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

-- Project Teams
CREATE TABLE IF NOT EXISTS project_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  overhead_multiplier numeric(4,2) NOT NULL DEFAULT 1.30,
  blended_sell_rate numeric(10,2),
  hours_per_month integer DEFAULT 160,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Team Members (links to existing candidates table)
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  role_on_project text NOT NULL,
  allocation_pct integer NOT NULL DEFAULT 100 CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  outsourcing_salary_usd numeric(10,2) NOT NULL,
  hours_per_month integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all 4 tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow all operations for authenticated users (internal only)
CREATE POLICY "Authenticated users can do all on clients"
  ON clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on projects"
  ON projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on project_teams"
  ON project_teams FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on team_members"
  ON team_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
