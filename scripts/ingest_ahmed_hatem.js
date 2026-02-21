
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function ingest() {
    const candidate = {
        full_name: "Ahmed Hatem",
        title: "Art Director",
        location: "GCC/MENA (Remote)",
        skills: ["Branding", "Web Design", "Marketing", "Advertising", "Digital Design", "Video Editing", "Motion Design"],
        tools: [
            { name: "Photoshop", years: 12 },
            { name: "Illustrator", years: 12 },
            { name: "Figma", years: 10 },
            { name: "After Effects", years: 6 },
            { name: "WordPress", years: 10 },
            { name: "Final Cut Pro", years: 12 }
        ],
        technologies: [
            { name: "HTML", years: 10 },
            { name: "CSS", years: 10 },
            { name: "PHP", years: 5 }
        ],
        years_experience_total: 12,
        match_score: 90,
        match_reason: "Art Director with 12+ years experience in digital artistry and strategic brand management. Expert in Branding, Web Design, and Advertising.",
        source: "LinkedIn JSON",
        status: "Sourced",
        lnkd_notes: "Certified Strategic Brand Manager. Expert in Photoshop, Figma, and Video Editing."
    };

    const { data, error } = await supabase
        .from('candidates')
        .insert([candidate])
        .select();

    if (error) {
        console.error('Error ingesting candidate:', JSON.stringify(error, null, 2));
    } else {
        console.log('Successfully ingested:', data[0].full_name);
    }
}

ingest();
