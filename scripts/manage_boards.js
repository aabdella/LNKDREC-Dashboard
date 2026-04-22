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
            board_name: 'RemoteOK',
            board_slug: 'remoteok',
            country_code: 'GB',
            base_url: 'https://remoteok.com',
            search_url_template: 'https://remoteok.com/api?tag={query}',
            scraper_type: 'web_fetch',
            is_active: true
        },
        {
            board_name: 'We Work Remotely',
            board_slug: 'weworkremotely',
            country_code: 'GB',
            base_url: 'https://weworkremotely.com',
            search_url_template: 'https://weworkremotely.com/remote-jobs.rss',
            scraper_type: 'web_fetch',
            is_active: true
        }
    ];

    const { data, error } = await supabase.from('leads_job_boards').insert(boards).select();

    if (error) {
        console.error('Error adding boards:', error);
    } else {
        console.log('Added/Updated boards:', data);
    }
}

const action = process.argv[2] || 'list';

if (action === 'list') {
    checkBoards();
} else if (action === 'add') {
    addBoards();
}
