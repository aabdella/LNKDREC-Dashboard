
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';
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
