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

async function removeRemoteRocketship() {
    const { data, error } = await supabase.from('leads_job_boards').delete().eq('board_slug', 'remoterocketship');
    if (error) {
        console.error('Error removing board:', error);
    } else {
        console.log('Removed board:', data);
    }
}

const action = process.argv[2] || 'list';

if (action === 'list') {
    checkBoards();
} else if (action === 'remove-rocket') {
    removeRemoteRocketship();
}
