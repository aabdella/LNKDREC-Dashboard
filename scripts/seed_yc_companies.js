const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchYCCompanies() {
    console.log('Fetching YC companies based in UK/Europe that are hiring...');
    
    const allCompanies = [];
    let page = 1;
    
    while (true) {
        const url = `https://api.ycombinator.com/v0.1/companies?isHiring=true&page=${page}&limit=100`;
        const res = await fetch(url);
        const data = await res.json();
        const companies = data.companies || [];
        
        if (companies.length === 0) break;
        
        // Filter for UK/Europe or remote-friendly companies
        const relevant = companies.filter(c => {
            const locations = (c.locations || []).join(' ').toLowerCase();
            const regions = (c.regions || []).join(' ').toLowerCase();
            const isUK = locations.includes('london') || locations.includes('uk') || locations.includes('united kingdom');
            const isEurope = regions.includes('europe');
            const isRemote = locations.includes('remote') || regions.includes('remote');
            return (isUK || isEurope || isRemote) && c.status === 'Active';
        });
        
        allCompanies.push(...relevant);
        console.log(`Page ${page}: ${companies.length} total, ${relevant.length} UK/EU/Remote`);
        
        if (companies.length < 100) break;
        page++;
        await new Promise(r => setTimeout(r, 300)); // rate limit
    }
    
    console.log(`\nTotal relevant YC companies: ${allCompanies.length}`);
    return allCompanies;
}

async function seedYCCompanies() {
    const companies = await fetchYCCompanies();
    
    if (companies.length === 0) {
        console.log('No companies found.');
        return;
    }
    
    const rows = companies.map(c => ({
        company_number: `YC_${c.id}`,
        company_name: c.name,
        website_url: c.website || null,
        career_page_url: c.website ? `${c.website.replace(/\/$/, '')}/careers` : null,
        is_active: true,
    }));
    
    // Upsert in batches of 50
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { data, error } = await supabase
            .from('leads_companies')
            .upsert(batch, { onConflict: 'company_number', ignoreDuplicates: true })
            .select('id');
        
        if (error) {
            console.error(`Batch ${i}-${i+50} error:`, error.message);
        } else {
            inserted += data?.length || 0;
        }
    }
    
    console.log(`\n✅ Inserted ${inserted} new YC companies into leads_companies.`);
}

seedYCCompanies().catch(console.error);
