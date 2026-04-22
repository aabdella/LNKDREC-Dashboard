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

async function addBoards() {
    const boards = [
        {
            board_name: 'Career Crawler',
            board_slug: 'career-crawler',
            country_code: 'GB',
            base_url: 'https://lnkdrec.ai',
            search_url_template: 'https://lnkdrec.ai/crawler',
            scraper_type: 'web_fetch',
            is_active: true
        }
    ];
    const { data, error } = await supabase.from('leads_job_boards').insert(boards).select();
    if (error) console.error('Error:', error.message);
    else console.log('Added Career Crawler board.');
}

const action = process.argv[2] || 'list';

if (action === 'list') {
    checkBoards();
} else if (action === 'add-crawler') {
    addBoards();
}
