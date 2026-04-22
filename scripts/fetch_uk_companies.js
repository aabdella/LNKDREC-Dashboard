const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const CH_API_KEY = 'd9f9eff2-a037-4670-b783-fb5c2cd823d6';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// SIC Codes: 62010 (Programming), 62020 (Consultancy), 58290 (Software Publishing)
const SIC_CODES = '62010,62020,58290';

async function fetchCompanies() {
    console.log('🚀 Starting UK Company Discovery...');
    
    // Auth: API Key is the username, password is empty
    const authHeader = Buffer.from(`${CH_API_KEY}:`).toString('base64');
    
    try {
        const response = await axios.get('https://api.company-information.service.gov.uk/advanced-search/companies', {
            params: {
                sic_codes: SIC_CODES,
                company_status: 'active',
                size: 50 // Fetch top 50 active software companies
            },
            headers: {
                'Authorization': `Basic ${authHeader}`
            }
        });

        const items = response.data.items || [];
        console.log(`Found ${items.length} companies.`);

        const companiesToInsert = items.map(c => ({
            company_number: c.company_number,
            company_name: c.company_name,
            sic_codes: c.sic_codes || [],
            company_status: c.company_status,
            date_of_creation: c.date_of_creation,
            registered_address: c.registered_office_address || {}
        }));

        const { data, error } = await supabase
            .from('leads_companies')
            .upsert(companiesToInsert, { onConflict: 'company_number' })
            .select();

        if (error) {
            console.error('Error saving to Supabase:', error.message);
        } else {
            console.log(`✅ Successfully synced ${data.length} companies to the database.`);
        }

    } catch (err) {
        console.error('Failed to fetch from Companies House:', err.response?.data || err.message);
    }
}

fetchCompanies();
