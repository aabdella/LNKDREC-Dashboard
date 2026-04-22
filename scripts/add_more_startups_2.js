const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addStartups() {
    const startups = [
        { company_number: 'FIN_010', company_name: 'Curve', website_url: 'https://www.curve.com', career_page_url: 'https://www.curve.com/careers/', is_active: true },
        { company_number: 'FIN_011', company_name: 'Wise', website_url: 'https://wise.com', career_page_url: 'https://wise.jobs/', is_active: true },
        { company_number: 'PAY_001', company_name: 'Primer', website_url: 'https://primer.io', career_page_url: 'https://primer.io/careers', is_active: true },
        { company_number: 'SEC_002', company_name: 'Tessian', website_url: 'https://www.tessian.com', career_page_url: 'https://www.tessian.com/careers/', is_active: true },
        { company_number: 'SEC_003', company_name: 'Darktrace', website_url: 'https://darktrace.com', career_page_url: 'https://darktrace.com/careers', is_active: true },
        { company_number: 'AI_001', company_name: 'Graphcore', website_url: 'https://www.graphcore.ai', career_page_url: 'https://www.graphcore.ai/careers', is_active: true },
        { company_number: 'AI_002', company_name: 'Wayve', website_url: 'https://wayve.ai', career_page_url: 'https://wayve.ai/careers/', is_active: true },
        { company_number: 'INS_001', company_name: 'Stable', website_url: 'https://stableprice.com', career_page_url: 'https://stableprice.com/careers', is_active: true },
        { company_number: 'ECOM_001', company_name: 'Lyst', website_url: 'https://www.lyst.com', career_page_url: 'https://www.lyst.com/careers/', is_active: true },
        { company_number: 'FOOD_001', company_name: 'Deliveroo', website_url: 'https://deliveroo.co.uk', career_page_url: 'https://deliveroo.design/careers/', is_active: true }
    ];

    const { data, error } = await supabase.from('leads_companies').upsert(startups, { onConflict: 'company_number' }).select();
    if (error) console.error('Error:', error.message);
    else console.log(`Successfully added ${data.length} more startups.`);
}

addStartups();
