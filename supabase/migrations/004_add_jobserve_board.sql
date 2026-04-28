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
  'Jobserve',
  'jobserve',
  'https://www.jobserve.com',
  'https://www.jobserve.com/gb/en/JobSearch.aspx?q={query}&l=London',
  'cheerio',
  true
)
on conflict (board_slug) do update set
  country_code = excluded.country_code,
  board_name = excluded.board_name,
  base_url = excluded.base_url,
  search_url_template = excluded.search_url_template,
  scraper_type = excluded.scraper_type,
  is_active = excluded.is_active;
