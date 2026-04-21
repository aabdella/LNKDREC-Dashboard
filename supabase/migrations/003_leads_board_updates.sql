update leads_job_boards
set
  search_url_template = 'https://builtinlondon.uk/jobs?search={query}',
  scraper_type = 'cheerio',
  css_title_selector = 'h2',
  css_company_selector = '.company-name, [class*=company]',
  css_location_selector = '.location, [class*=location]',
  css_url_selector = 'a[href*="/jobs/"]',
  css_salary_selector = '.salary, [class*=salary]',
  is_active = true
where board_slug = 'builtinlondon';

insert into leads_job_boards (
  country_code,
  board_name,
  board_slug,
  base_url,
  search_url_template,
  scraper_type,
  is_active
)
values (
  'GB',
  'Remote Rocketship',
  'remoterocketship',
  'https://www.remoterocketship.com',
  'https://www.remoterocketship.com/jobs?q={query}',
  'web_fetch',
  true
)
on conflict (board_slug) do update set
  country_code = excluded.country_code,
  board_name = excluded.board_name,
  base_url = excluded.base_url,
  search_url_template = excluded.search_url_template,
  scraper_type = excluded.scraper_type,
  is_active = excluded.is_active;