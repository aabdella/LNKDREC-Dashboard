const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getCareerPages() {
    const { data, error } = await supabase
        .from('leads_companies')
        .select('company_name, career_page_url')
        .not('career_page_url', 'is', null)
        .eq('is_active', true);
    
    if (error) throw error;
    return data;
}

async function scrapeWithBrowser(url) {
    console.log(`📡 Scraping: ${url}`);
    try {
        const result = execSync(`python3 projects/LNKDREC/dashboard/scripts/bridge.py "${url}"`).toString();
        const data = JSON.parse(result);
        return data.result?.result?.value || [];
    } catch (err) {
        console.error(`Failed to scrape ${url}:`, err.message);
        return [];
    }
}

async function main() {
    const pages = await getCareerPages();
    console.log(`Found ${pages.length} career pages to crawl.`);

    // Create a search record for this crawl
    const { data: search, error: searchError } = await supabase
        .from('leads_searches')
        .insert({
            job_title: 'Career Crawler',
            country_code: 'UK',
            boards_searched: ['career-crawler'],
            status: 'running'
        })
        .select('id')
        .single();

    if (searchError) throw searchError;
    const searchId = search.id;

    for (const page of pages) {
        const rawJobs = await scrapeWithBrowser(page.career_page_url);
        const keywords = ["Engineer", "Developer", "Manager", "Analyst", "Designer", "Lead", "Software", "Product"];
        
        const jobs = rawJobs.filter(j => {
            const title = (j.title || '').trim();
            return title.length > 5 && title.length < 80 && keywords.some(k => title.toLowerCase().includes(k.toLowerCase()));
        }).map(j => ({
            search_id: searchId,
            board_slug: 'career-crawler',
            job_title: j.title.trim().replace(/\n/g, ' '),
            company_name: page.company_name,
            location: 'Remote/UK',
            job_url: j.url,
            raw_data: { scraped_at: new Date().toISOString() }
        }));

        if (jobs.length > 0) {
            console.log(`✅ Extracted ${jobs.length} jobs from ${page.company_name}`);
            await supabase.from('leads_results').insert(jobs);
        }
    }

    await supabase.from('leads_searches').update({ status: 'complete', completed_at: new Date().toISOString() }).eq('id', searchId);
    console.log('🏁 Crawl finished.');
}

main();
