const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addStartups() {
    const startups = [
        { company_number: 'FIN_001', company_name: 'Monzo', website_url: 'https://monzo.com', career_page_url: 'https://monzo.com/careers/', is_active: true },
        { company_number: 'FIN_002', company_name: 'Revolut', website_url: 'https://revolut.com', career_page_url: 'https://www.revolut.com/careers/', is_active: true },
        { company_number: 'FIN_003', company_name: 'Starling Bank', website_url: 'https://starlingbank.com', career_page_url: 'https://www.starlingbank.com/careers/', is_active: true },
        { company_number: 'FIN_004', company_name: 'Checkout.com', website_url: 'https://checkout.com', career_page_url: 'https://www.checkout.com/careers', is_active: true },
        { company_number: 'FIN_005', company_name: 'GoCardless', website_url: 'https://gocardless.com', career_page_url: 'https://gocardless.com/about/careers/', is_active: true },
        { company_number: 'FIN_006', company_name: 'Paddle', website_url: 'https://paddle.com', career_page_url: 'https://www.paddle.com/careers', is_active: true },
        { company_number: 'FIN_007', company_name: 'Zego', website_url: 'https://zego.com', career_page_url: 'https://www.zego.com/careers/', is_active: true },
        { company_number: 'FIN_008', company_name: 'Marshmallow', website_url: 'https://marshmallow.com', career_page_url: 'https://www.marshmallow.com/careers', is_active: true },
        { company_number: 'FIN_009', company_name: 'Thought Machine', website_url: 'https://thoughtmachine.net', career_page_url: 'https://thoughtmachine.net/careers', is_active: true },
        { company_number: 'SEC_001', company_name: 'Snyk', website_url: 'https://snyk.io', career_page_url: 'https://snyk.io/careers/', is_active: true }
    ];

    const { data, error } = await supabase.from('leads_companies').upsert(startups, { onConflict: 'company_number' }).select();
    if (error) console.error('Error:', error.message);
    else console.log(`Successfully added ${data.length} more startups.`);
}

addStartups();
