
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
// Using the exact key from .env.local
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';
const supabase = createClient(supabaseUrl, supabaseKey);

const candidates = [
  {
    full_name: "Stephanie Jupiter Jacca",
    title: "CRM Specialist (HubSpot Certified)",
    location: "Cairo, Egypt",
    linkedin_url: "https://www.linkedin.com/in/stephanie-jupiter-jacca",
    skills: ["IT Consulting", "Marketing Consulting", "Business Analytics", "SaaS Development", "Data Reporting"],
    lnkd_notes: "CRM Specialist (HubSpot Certified) | Building AI-Driven Applications for Revenue... Connection: 3rd+",
    source: "LinkedIn JSON",
    match_score: 85,
    match_reason: "CRM Specialist with HubSpot certification and AI application focus.",
    status: "Sourced"
  },
  {
    full_name: "Ganna Ibrahim",
    title: "Marketing & Brand Specialist",
    location: "Giza, Egypt",
    linkedin_url: "https://eg.linkedin.com/in/ganna-ibrahim-29212b1b6",
    skills: ["CRM (HubSpot)", "Digital Campaigns", "E-commerce Growth"],
    lnkd_notes: "Marketing & Brand Specialist | CRM (HubSpot) · Digital Campaigns · E-commerce Growth. Verified Profile. Connection: 3rd+",
    source: "LinkedIn JSON",
    match_score: 80,
    match_reason: "Marketing & Brand Specialist with HubSpot and E-commerce growth experience.",
    status: "Sourced"
  },
  {
    full_name: "Ramy Gaber",
    title: "Sr. Marketing Specialist",
    location: "Alexandria (Sidi Gaber), Egypt",
    linkedin_url: "https://eg.linkedin.com/in/ramygaber",
    skills: ["Google Certified", "HubSpot Certified"],
    lnkd_notes: "Sr. Marketing Specialist | Google Certified | HubSpot Certified. Verified Profile. 3K followers. Connection: 2nd",
    source: "LinkedIn JSON",
    match_score: 85,
    match_reason: "Senior Marketing Specialist with double certification (Google & HubSpot).",
    status: "Sourced"
  },
  {
    full_name: "Tarek Hassan",
    title: "HubSpot Specialist",
    location: "Alexandria, Egypt",
    linkedin_url: "https://eg.linkedin.com/in/tarek-hassan",
    skills: ["HubSpot Management"],
    lnkd_notes: "HubSpot Specialist. Verified Profile. Mutual connections: Daryn Smith, Sherif Elmaghraby. Connection: 2nd",
    source: "LinkedIn JSON",
    match_score: 80,
    match_reason: "HubSpot Specialist with relevant local connections.",
    status: "Sourced"
  },
  {
    full_name: "Sawsan Sadek",
    title: "Senior Email Marketing Specialist",
    location: "Cairo, Egypt",
    linkedin_url: "https://eg.linkedin.com/in/sawsan-sadek-86129a132",
    skills: ["Lead Nurturing", "Growth Marketing", "Omnichannel Strategy"],
    lnkd_notes: "Senior Email Marketing Specialist | Nurturing Leads | Growth Marketing | Omnichannel. 1K followers. Mutual connections: Fady Ramzy, Mostafa Abou Gamrah.",
    source: "LinkedIn JSON",
    match_score: 80,
    match_reason: "Senior Email Marketing Specialist with Omnichannel and Lead Nurturing experience.",
    status: "Sourced"
  }
];

async function ingestBatch() {
    const { data, error } = await supabase
        .from('candidates')
        .insert(candidates)
        .select();

    if (error) {
        console.error('Error ingesting batch:', JSON.stringify(error, null, 2));
    } else {
        console.log(`Successfully ingested ${data.length} candidates:`);
        data.forEach(c => console.log(`- ${c.full_name}`));
    }
}

ingestBatch();
