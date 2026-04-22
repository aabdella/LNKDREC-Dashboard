const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/LNKDREC/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResults() {
    console.log('--- Checking Leads Results ---');
    
    // Total count
    const { count, error: countError } = await supabase
        .from('leads_results')
        .select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error('Error getting count:', countError.message);
    } else {
        console.log(`Total rows in leads_results: ${count}`);
    }

    // Latest results from career-crawler
    const { data, error } = await supabase
        .from('leads_results')
        .select('id, board_slug, job_title, company_name, created_at')
        .eq('board_slug', 'career-crawler')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching results:', error.message);
    } else {
        console.log(`Latest 10 career-crawler results:`);
        console.table(data);
    }

    // Check searches
    const { data: searches, error: searchError } = await supabase
        .from('leads_searches')
        .select('id, job_title, status, total_results, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (searchError) {
        console.error('Error fetching searches:', searchError.message);
    } else {
        console.log(`Latest 5 searches:`);
        console.table(searches);
    }
}

checkResults();
