const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBoards() {
  const { data, error } = await supabase.from('leads_job_boards').select('*');
  if (error) {
    console.error('Error fetching boards:', error);
    return;
  }
  console.log('Current boards in DB:');
  console.table(data);
}

async function addRemoteRocketship() {
    const { data, error } = await supabase.from('leads_job_boards').update({
        scraper_type: 'cheerio',
        css_title_selector: 'h2, h3, [class*="jobTitle"]',
        css_company_selector: '.company, [class*="companyName"]',
        css_location_selector: '.location, [class*="location"]',
        css_url_selector: 'a[href*="/jobs/"]',
    }).eq('board_slug', 'remoterocketship');

    if (error) {
        console.error('Error updating board:', error);
    } else {
        console.log('Updated board:', data);
    }
}

const action = process.argv[2] || 'list';

if (action === 'list') {
    checkBoards();
} else if (action === 'add') {
    addRemoteRocketship();
}
