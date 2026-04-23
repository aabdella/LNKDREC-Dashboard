-- qualified_leads: one row per unique company (deduplicated)
create table if not exists qualified_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_domain text,
  job_title text not null,
  job_url text,
  board_slug text,
  status text not null default 'new' check (status in ('new', 'enriched', 'emailed', 'replied')),
  enriched_at timestamptz,
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_name)
);

-- lead_contacts: enriched contacts per company
create table if not exists lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references qualified_leads(id) on delete cascade,
  name text,
  title text,
  email text,
  linkedin_url text,
  source text default 'apollo',
  created_at timestamptz not null default now()
);

-- indexes
create index if not exists idx_qualified_leads_status on qualified_leads(status);
create index if not exists idx_lead_contacts_lead_id on lead_contacts(lead_id);
