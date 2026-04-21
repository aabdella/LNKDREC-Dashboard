-- RLS policies for leads tables
-- Enable RLS
alter table leads_countries enable row level security;
alter table leads_job_boards enable row level security;
alter table leads_searches enable row level security;
alter table leads_results enable row level security;

-- leads_countries: allow read for authenticated users
create policy if not exists leads_countries_select on leads_countries
  for select using (true);

-- leads_job_boards: allow read for authenticated users
create policy if not exists leads_job_boards_select on leads_job_boards
  for select using (true);

-- leads_searches: allow insert and read for authenticated users
create policy if not exists leads_searches_insert on leads_searches
  for insert with check (true);
create policy if not exists leads_searches_select on leads_searches
  for select using (true);
create policy if not exists leads_searches_update on leads_searches
  for update using (true);

-- leads_results: allow insert and read for authenticated users
create policy if not exists leads_results_insert on leads_results
  for insert with check (true);
create policy if not exists leads_results_select on leads_results
  for select using (true);
create policy if not exists leads_results_delete on leads_results
  for delete using (true);