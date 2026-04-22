export type ScraperType = 'cheerio' | 'web_fetch' | 'text_parse' | 'browser' | 'api' | 'rss';

export interface BoardConfig {
  board_name: string;
  board_slug: string;
  base_url: string;
  search_url_template: string;
  scraper_type: ScraperType;
  css_title_selector?: string;
  css_company_selector?: string;
  css_location_selector?: string;
  css_url_selector?: string;
  css_salary_selector?: string;
}

export const SCRAPER_BOARDS: Record<string, BoardConfig> = {
  'reed': {
    board_name: 'Reed',
    board_slug: 'reed',
    base_url: 'https://www.reed.co.uk',
    search_url_template: 'https://www.reed.co.uk/jobs/{query}-jobs-in-united-kingdom',
    scraper_type: 'cheerio',
    css_title_selector: 'h3.job-card__title',
    css_company_selector: '.job-card__company-name',
    css_location_selector: '.job-card__location',
    css_url_selector: '.job-card a.job-card__link',
    css_salary_selector: '.job-card__salary',
  },
  'landing-jobs': {
    board_name: 'Landing.jobs',
    board_slug: 'landing-jobs',
    base_url: 'https://landing.jobs',
    search_url_template: 'https://landing.jobs/jobs?keywords={query}&location=london',
    scraper_type: 'cheerio',
    css_title_selector: 'h2.lj-jobcard-static__title a',
    css_company_selector: '.lj-jobcard-static__company a',
    css_location_selector: '.lj-jobcard-static__location',
    css_url_selector: '.lj-jobcard-static__title a[href]',
    css_salary_selector: '.lj-jobcard-static__salary',
  },
  'builtinlondon': {
    board_name: 'Built In London',
    board_slug: 'builtinlondon',
    base_url: 'https://builtinlondon.uk',
    search_url_template: 'https://builtinlondon.uk/jobs?search={query}',
    scraper_type: 'cheerio',
    css_title_selector: 'h2',
    css_company_selector: '.company-name, [class*="company"]',
    css_location_selector: '.location, [class*="location"]',
    css_url_selector: 'a[href*="/jobs/"]',
    css_salary_selector: '.salary, [class*="salary"]',
  },
  'pythonorg': {
    board_name: 'Python.org Jobs',
    board_slug: 'pythonorg',
    base_url: 'https://www.python.org',
    search_url_template: 'https://www.python.org/jobs/',
    scraper_type: 'cheerio',
    css_title_selector: 'h2',
    css_company_selector: '.company',
    css_location_selector: '.location',
    css_url_selector: 'h2 a[href]',
    css_salary_selector: '.salary',
  },
  'nodesk': {
    board_name: 'NoDesk',
    board_slug: 'nodesk',
    base_url: 'https://nodesk.co',
    search_url_template: 'https://nodesk.co/remote-jobs/uk/',
    scraper_type: 'text_parse',
  },
  'remoteok': {
    board_name: 'RemoteOK',
    board_slug: 'remoteok',
    base_url: 'https://remoteok.com',
    search_url_template: 'https://remoteok.com/api',
    scraper_type: 'api',
  },
  'weworkremotely': {
    board_name: 'We Work Remotely',
    board_slug: 'weworkremotely',
    base_url: 'https://weworkremotely.com',
    search_url_template: 'https://weworkremotely.com/remote-jobs.rss',
    scraper_type: 'rss',
  },
};
