import axios from 'axios';
import * as cheerio from 'cheerio';
import { SCRAPER_BOARDS, type BoardConfig } from './boards';

export interface JobResult {
  board_slug: string;
  job_title: string;
  company_name: string | null;
  location: string | null;
  salary: string | null;
  job_url: string;
  raw_data: Record<string, unknown>;
}

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const TEXT_PARSE_PATTERNS = {
  title: /([A-Z][^\n]{10,120}?(?:Engineer|Developer|Manager|Analyst|Designer|Consultant|Specialist|Coordinator|Administrator))/gi,
  company: /(?:at|from|Company:?)\s+([A-Z][A-Za-z0-9&.,' -]{1,80})/gi,
  location: /(?:Location|based in|based at)[:\s]+([A-Za-z][A-Za-z,\s-]{1,80})/gi,
  url: /https?:\/\/[^\s"'<>]+/gi,
  salary: /(?:£|\$|EUR|USD)\s?[0-9]{2,6}(?:,[0-9]{3})*(?:\s?(?:k|K))?/gi,
};

function buildSearchUrl(config: BoardConfig, jobQuery: string): string {
  return config.search_url_template.replace('{query}', encodeURIComponent(jobQuery));
}

function toAbsoluteUrl(baseUrl: string, href: string | null | undefined): string {
  if (!href) return '';
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned : null;
}

function fallbackTitleFromUrl(url: string): string | null {
  const lastSegment = url.split('/').filter(Boolean).pop();
  if (!lastSegment) return null;
  const text = decodeURIComponent(lastSegment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b(job|jobs|careers|career|apply|role)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length >= 6 ? text : null;
}

/**
 * Scrape a job board and return array of job results.
 */
export async function scrapeBoard(
  boardSlug: string,
  jobQuery: string
): Promise<JobResult[]> {
  const config = SCRAPER_BOARDS[boardSlug];
  if (!config) {
    console.error(`[scrapers] Unknown board slug: ${boardSlug}`);
    return [];
  }

  const searchUrl = buildSearchUrl(config, jobQuery);

  try {
    switch (config.scraper_type) {
      case 'cheerio':
        return await scrapeWithCheerio(config, searchUrl, boardSlug);
      case 'web_fetch':
        return await scrapeWithWebFetch(config, searchUrl, boardSlug);
      case 'text_parse':
        return await scrapeWithTextParse(config, searchUrl, boardSlug);
      case 'api':
        return await scrapeWithApi(config, searchUrl, boardSlug);
      case 'rss':
        return await scrapeWithRss(config, searchUrl, boardSlug);
      case 'browser':
        console.warn(`[scrapers] 'browser' type not yet implemented for ${boardSlug}`);
        return [];
      default:
        return [];
    }
  } catch (err) {
    console.error(`[scrapers] Error scraping board ${boardSlug}:`, err);
    return [];
  }
}

async function scrapeWithCheerio(
  config: BoardConfig,
  searchUrl: string,
  boardSlug: string
): Promise<JobResult[]> {
  const results: JobResult[] = [];

  const { data } = await axios.get(searchUrl, {
    headers: REQUEST_HEADERS,
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const titleSelector = config.css_title_selector || 'h2';

  $(titleSelector).each((_, el) => {
    const titleElement = $(el);
    const title = cleanText(titleElement.text());
    if (!title || title.length < 4 || title.length > 140) return;

    const nestedLink = titleElement.is('a[href]')
      ? titleElement
      : titleElement.find('a[href]').first();
    const scopedLink = config.css_url_selector
      ? titleElement.closest('article, li, div, section').find(config.css_url_selector).first()
      : cheerio.load('<div></div>')('a');
    const fallbackLink = titleElement.closest('a[href]').first().add(titleElement.parent().find('a[href]').first()).first();
    const href = nestedLink.attr('href') || scopedLink.attr('href') || fallbackLink.attr('href');
    const jobUrl = toAbsoluteUrl(config.base_url, href);
    if (!jobUrl || !/\/job|\/jobs|job\/|jobs\//i.test(jobUrl)) return;

    const container = titleElement.closest('article, li, div, section');
    const companyName = config.css_company_selector
      ? cleanText(container.find(config.css_company_selector).first().text())
      : null;
    const location = config.css_location_selector
      ? cleanText(container.find(config.css_location_selector).first().text())
      : null;
    const salary = config.css_salary_selector
      ? cleanText(container.find(config.css_salary_selector).first().text())
      : null;

    results.push({
      board_slug: boardSlug,
      job_title: title,
      company_name: companyName,
      location,
      salary,
      job_url: jobUrl,
      raw_data: {
        scraper_type: 'cheerio',
        search_url: searchUrl,
        scraped_at: new Date().toISOString(),
      },
    });
  });

  return deduplicateResults(results);
}

async function scrapeWithWebFetch(
  config: BoardConfig,
  searchUrl: string,
  boardSlug: string
): Promise<JobResult[]> {
  const results: JobResult[] = [];

  try {
    const response = await fetch(searchUrl, {
      headers: REQUEST_HEADERS,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${searchUrl}: ${response.status}`);
    }

    const body = await response.text();
    const $ = cheerio.load(body);

    $('a[href]').each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr('href');
      const jobUrl = toAbsoluteUrl(config.base_url, href);
      if (!jobUrl || !/(job|career|vacancy|position|employment)/i.test(jobUrl)) return;

      const title = cleanText(anchor.text()) || fallbackTitleFromUrl(jobUrl);
      if (!title) return;

      const container = anchor.closest('article, li, div, section');
      const surroundingText = cleanText(container.text()) || '';
      const companyMatch = surroundingText.match(/(?:at|from|company)\s+([A-Z][A-Za-z0-9&.,' -]{1,80})/i);
      const locationMatch = surroundingText.match(/(?:location|based in|remote in)[:\s]+([A-Za-z][A-Za-z,\s-]{1,80})/i);
      const salaryMatch = surroundingText.match(/(?:£|\$|EUR|USD)\s?[0-9]{2,6}(?:,[0-9]{3})*(?:\s?(?:k|K))?/i);

      results.push({
        board_slug: boardSlug,
        job_title: title,
        company_name: cleanText(companyMatch?.[1]),
        location: cleanText(locationMatch?.[1]),
        salary: cleanText(salaryMatch?.[0]),
        job_url: jobUrl,
        raw_data: {
          scraper_type: 'web_fetch',
          search_url: searchUrl,
          scraped_at: new Date().toISOString(),
        },
      });
    });
  } catch (err) {
    console.error(`[scrapers] web_fetch failed for ${boardSlug}:`, err);
  }

  return deduplicateResults(results);
}

async function scrapeWithTextParse(
  config: BoardConfig,
  searchUrl: string,
  boardSlug: string
): Promise<JobResult[]> {
  const results: JobResult[] = [];

  try {
    const { data } = await axios.get(searchUrl, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
    });

    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const titles = body.match(TEXT_PARSE_PATTERNS.title) || [];
    const companies = body.match(TEXT_PARSE_PATTERNS.company) || [];
    const locations = body.match(TEXT_PARSE_PATTERNS.location) || [];
    const urls = body.match(TEXT_PARSE_PATTERNS.url) || [];
    const salaries = body.match(TEXT_PARSE_PATTERNS.salary) || [];

    for (let index = 0; index < titles.length; index += 1) {
      const title = cleanText(titles[index]);
      if (!title) continue;

      results.push({
        board_slug: boardSlug,
        job_title: title,
        company_name: cleanText(companies[index]?.replace(/^(at|from|Company:?)/i, '')),
        location: cleanText(locations[index]?.replace(/^(Location|based in|based at)[:\s]*/i, '')),
        salary: cleanText(salaries[index]),
        job_url: cleanText(urls[index]) || searchUrl,
        raw_data: {
          scraper_type: 'text_parse',
          search_url: searchUrl,
          scraped_at: new Date().toISOString(),
        },
      });
    }
  } catch (err) {
    console.error(`[scrapers] text_parse failed for ${boardSlug}:`, err);
  }

  return deduplicateResults(results);
}

async function scrapeWithApi(
  config: BoardConfig,
  searchUrl: string,
  boardSlug: string
): Promise<JobResult[]> {
  const results: JobResult[] = [];

  try {
    const { data } = await axios.get(searchUrl, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
    });

    if (Array.isArray(data)) {
      // RemoteOK structure: [ { legal: ... }, { job1 }, { job2 } ]
      // The first item is often a legal notice or meta
      for (const item of data) {
        if (!item.position || !item.url) continue;

        results.push({
          board_slug: boardSlug,
          job_title: item.position,
          company_name: item.company || null,
          location: item.location || null,
          salary: item.salary_min ? `${item.salary_min} - ${item.salary_max}` : null,
          job_url: item.url,
          raw_data: {
            ...item,
            scraper_type: 'api',
            scraped_at: new Date().toISOString(),
          },
        });
      }
    }
  } catch (err) {
    console.error(`[scrapers] API fetch failed for ${boardSlug}:`, err);
  }

  return deduplicateResults(results);
}

async function scrapeWithRss(
  config: BoardConfig,
  searchUrl: string,
  boardSlug: string
): Promise<JobResult[]> {
  const results: JobResult[] = [];

  try {
    const { data } = await axios.get(searchUrl, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(data, { xmlMode: true });

    $('item').each((_, el) => {
      const item = $(el);
      const fullTitle = cleanText(item.find('title').text()) || '';
      // WWR title format usually: "Company: Job Title"
      let companyName = null;
      let jobTitle = fullTitle;
      
      if (fullTitle.includes(':')) {
        const parts = fullTitle.split(':');
        companyName = parts[0].trim();
        jobTitle = parts.slice(1).join(':').trim();
      }

      const jobUrl = item.find('link').text();
      const location = item.find('region').text() || 'Remote';

      results.push({
        board_slug: boardSlug,
        job_title: jobTitle,
        company_name: companyName,
        location,
        salary: null,
        job_url: jobUrl,
        raw_data: {
          scraper_type: 'rss',
          search_url: searchUrl,
          scraped_at: new Date().toISOString(),
        },
      });
    });
  } catch (err) {
    console.error(`[scrapers] RSS fetch failed for ${boardSlug}:`, err);
  }

  return deduplicateResults(results);
}

/**
 * Deduplicate results by comparing job_title + company_name + job_url.
 */
export function deduplicateResults(results: JobResult[]): JobResult[] {
  const seen = new Set<string>();
  const deduped: JobResult[] = [];

  for (const r of results) {
    const key = `${r.job_title}|${r.company_name || ''}|${r.job_url}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  return deduped;
}