
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'REDACTED_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function ingest() {
    const candidate = {
        full_name: "Muhammammad Gamal",
        title: "Search Engine Optimization Specialist",
        location: "Qesm El Maadi, Egypt",
        linkedin_url: "https://eg.linkedin.com/in/muhammad-gamal-mg",
        skills: ["Search Engine Optimization (SEO)", "Search Engine Marketing (SEM)"],
        lnkd_notes: "Certified from Google, Meta, and HubSpot. Connection: 2nd",
        source: "LinkedIn JSON",
        match_score: 85,
        match_reason: "Sourced via LinkedIn JSON. SEO Specialist with Google/Meta/HubSpot certifications.",
        status: "Sourced"
    };

    const { data, error } = await supabase
        .from('candidates')
        .insert([candidate])
        .select();

    if (error) {
        console.error('Error ingesting candidate:', error);
    } else {
        console.log('Successfully ingested:', data[0].full_name);
    }
}

ingest();
