const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addStartups() {
    const startups = [
        { company_number: 'STARTUP_001', company_name: 'Omnea', website_url: 'https://www.omnea.co', career_page_url: 'https://jobs.ashbyhq.com/omnea/', is_active: true },
        { company_number: 'STARTUP_002', company_name: 'HIVED', website_url: 'https://hived.com', career_page_url: 'https://hived.com/careers', is_active: true },
        { company_number: 'STARTUP_003', company_name: 'Magic', website_url: 'https://magic.dev', career_page_url: 'https://magic.dev/careers', is_active: true },
        { company_number: 'STARTUP_004', company_name: 'Unitary AI', website_url: 'https://unitary.ai', career_page_url: 'https://unitary.ai/careers', is_active: true },
        { company_number: 'STARTUP_005', company_name: 'Synthace', website_url: 'https://synthace.com', career_page_url: 'https://synthace.com/careers', is_active: true }
    ];

    const { data, error } = await supabase.from('leads_companies').upsert(startups, { onConflict: 'company_number' }).select();
    if (error) console.error('Error:', error.message);
    else console.log('Successfully added startups.');
}

addStartups();
