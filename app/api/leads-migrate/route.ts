import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    // Seed countries
    const { error: countryError } = await supabase.from('leads_countries').upsert([
      { country_code: 'GB', country_name: 'United Kingdom', flag_emoji: '🇬🇧' }
    ], { onConflict: 'country_code' });

    if (countryError) {
      return NextResponse.json({ 
        error: 'Seed failed — tables may not exist yet',
        detail: countryError.message,
        hint: 'Create tables first in Supabase SQL editor using the migration file, then retry this endpoint.'
      }, { status: 400 });
    }

    // Seed boards
    const { error: boardError } = await supabase.from('leads_job_boards').upsert([
      {
        country_code: 'GB', board_name: 'Reed', board_slug: 'reed',
        base_url: 'https://www.reed.co.uk',
        search_url_template: 'https://www.reed.co.uk/jobs/{query}-jobs-in-united-kingdom',
        scraper_type: 'cheerio',
        css_title_selector: 'h3.job-card__title',
        css_company_selector: '.job-card__company-name',
        css_location_selector: '.job-card__location',
        css_url_selector: '.job-card a.job-card__link',
        css_salary_selector: '.job-card__salary'
      },
      {
        country_code: 'GB', board_name: 'Landing.jobs', board_slug: 'landing-jobs',
        base_url: 'https://landing.jobs',
        search_url_template: 'https://landing.jobs/jobs?keywords={query}&location=london',
        scraper_type: 'cheerio',
        css_title_selector: 'h2.lj-jobcard-static__title a',
        css_company_selector: '.lj-jobcard-static__company a',
        css_location_selector: '.lj-jobcard-static__location',
        css_url_selector: '.lj-jobcard-static__title a[href]',
        css_salary_selector: '.lj-jobcard-static__salary'
      },
      {
        country_code: 'GB', board_name: 'Built In London', board_slug: 'builtinlondon',
        base_url: 'https://builtinlondon.uk',
        search_url_template: 'https://builtinlondon.uk/jobs',
        scraper_type: 'web_fetch'
      },
      {
        country_code: 'GB', board_name: 'Python.org Jobs', board_slug: 'pythonorg',
        base_url: 'https://www.python.org',
        search_url_template: 'https://www.python.org/jobs/',
        scraper_type: 'cheerio',
        css_title_selector: 'h2',
        css_company_selector: '.company',
        css_location_selector: '.location',
        css_url_selector: 'h2 a[href]',
        css_salary_selector: '.salary'
      },
      {
        country_code: 'GB', board_name: 'NoDesk', board_slug: 'nodesk',
        base_url: 'https://nodesk.co',
        search_url_template: 'https://nodesk.co/remote-jobs/uk/',
        scraper_type: 'text_parse'
      }
    ], { onConflict: 'board_slug' });

    if (boardError) {
      return NextResponse.json({ error: 'Country seeded but boards failed', detail: boardError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      message: 'Seed data applied successfully',
      boards: 5,
      countries: 1
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}