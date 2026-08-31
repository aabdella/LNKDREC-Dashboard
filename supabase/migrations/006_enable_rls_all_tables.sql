-- Migration 006: Enable RLS on all remaining tables
-- Tables that already have RLS: leads_countries, leads_job_boards, leads_searches,
--   leads_results, clients, projects, project_teams, team_members
-- This migration covers ALL remaining tables.

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- candidates_resumes does not exist (resume data is stored on candidates table)
ALTER TABLE unvetted ENABLE ROW LEVEL SECURITY;
ALTER TABLE vettings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualified_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies: authenticated users can do all (internal tool)
-- ============================================================

CREATE POLICY "Authenticated users can do all on candidates"
  ON candidates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE POLICY "Authenticated users can do all on unvetted"
  ON unvetted FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on vettings"
  ON vettings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on applications"
  ON applications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on candidate_interactions"
  ON candidate_interactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on activity_log"
  ON activity_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on impact_logs"
  ON impact_logs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on sourcing_sessions"
  ON sourcing_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on qualified_leads"
  ON qualified_leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do all on lead_contacts"
  ON lead_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);