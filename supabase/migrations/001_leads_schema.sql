-- Enable UUID extension
create extension if not exists pgcrypto;

-- Countries table
create table if not exists leads_countries (
  id uuid primary key default gen_random_uuid(),
  country_code text unique not null,
  country_name text not null,
  flag_emoji text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Job boards per country
create table if not exists leads_job_boards (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references leads_countries(country_code),
  board_name text not null,
  board_slug text unique not null,
  base_url text not null,
  search_url_template text not null,
  css_title_selector text,
  css_company_selector text,
  css_location_selector text,
  css_url_selector text,
  css_salary_selector text,
  scraper_type text not null check (scraper_type in ('cheerio', 'web_fetch', 'text_parse', 'browser')),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Search runs
create table if not exists leads_searches (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  job_title text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  total_results integer default 0,
  boards_searched text[] default '{}',
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Individual job results
create table if not exists leads_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references leads_searches(id) on delete cascade,
  board_slug text not null,
  job_title text not null,
  company_name text,
  location text,
  salary text,
  job_url text,
  raw_data jsonb,
  is_deduplicated boolean default false,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_leads_results_search_id on leads_results(search_id);
create index if not exists idx_leads_results_board_slug on leads_results(board_slug);
create index if not exists idx_leads_job_boards_country on leads_job_boards(country_code);
create index if not exists idx_leads_searches_status on leads_searches(status);

-- Seed GB country
insert into leads_countries (country_code, country_name, flag_emoji) 
values ('GB', 'United Kingdom', '🇬🇧')
on conflict (country_code) do nothing;

-- Seed Phase 1 boards for GB
insert into leads_job_boards (country_code, board_name, board_slug, base_url, search_url_template, scraper_type, css_title_selector, css_company_selector, css_location_selector, css_url_selector, css_salary_selector) values
('GB', 'Reed', 'reed', 'https://www.reed.co.uk', 'https://www.reed.co.uk/jobs/{query}-jobs-in-united-kingdom', 'cheerio', 'h3.job-card__title', '.job-card__company-name', '.job-card__location', '.job-card a.job-card__link', '.job-card__salary'),
('GB', 'Landing.jobs', 'landing-jobs', 'https://landing.jobs', 'https://landing.jobs/jobs?keywords={query}&location=london', 'cheerio', 'h2.lj-jobcard-static__title a', '.lj-jobcard-static__company a', '.lj-jobcard-static__location', '.lj-jobcard-static__title a[href]', '.lj-jobcard-static__salary'),
('GB', 'Built In London', 'builtinlondon', 'https://builtinlondon.uk', 'https://builtinlondon.uk/jobs', 'web_fetch', 'h2', 'h2 + p, [class*=company]', '[class*=location]', 'a[href*="/jobs/"]', '[class*=salary]'),
('GB', 'Python.org Jobs', 'pythonorg', 'https://www.python.org', 'https://www.python.org/jobs/', 'cheerio', 'h2', '.company', '.location', 'h2 a[href]', '.salary'),
('GB', 'NoDesk', 'nodesk', 'https://nodesk.co', 'https://nodesk.co/remote-jobs/uk/', 'text_parse', null, null, null, null, null)
on conflict (board_slug) do nothing;
