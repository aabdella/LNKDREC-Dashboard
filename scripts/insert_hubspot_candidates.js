
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const candidates = [
  {
    full_name: 'Mohamed Abdallah',
    title: 'HubSpot Administrator',
    location: 'Cairo, Egypt',
    years_experience_total: 3,
    match_score: 95,
    match_reason: 'Highly relevant experience as a HubSpot Administrator (3+ years). Expert in Sales Hub and automations. Based in Cairo.',
    source: 'LinkedIn (Manual Sourcing)',
    linkedin_url: 'https://www.linkedin.com/in/mo-abdallah/',
    status: 'Unvetted'
  },
  {
    full_name: 'Nouran El-Gendy',
    title: 'Marketing Ops & HubSpot Specialist',
    location: 'Giza, Egypt',
    years_experience_total: 2,
    match_score: 92,
    match_reason: 'Strong focus on HubSpot Marketing Hub and Inbound strategy (2+ years). Ideal for operations-heavy marketing roles. Based in Giza.',
    source: 'LinkedIn (Manual Sourcing)',
    linkedin_url: 'https://www.linkedin.com/in/nouran-elgendy/',
    status: 'Unvetted'
  },
  {
    full_name: 'Ahmed Refaat',
    title: 'CRM Specialist (HubSpot Expert)',
    location: 'Alexandria, Egypt',
    years_experience_total: 4,
    match_score: 98,
    match_reason: 'Senior level HubSpot expert (4+ years) with deep technical skills in data migration and API integrations. Based in Alexandria.',
    source: 'LinkedIn (Manual Sourcing)',
    linkedin_url: 'https://www.linkedin.com/in/arefaat/',
    status: 'Unvetted'
  },
  {
    full_name: 'Sarah Mansour',
    title: 'HubSpot Specialist',
    location: 'Cairo, Egypt',
    years_experience_total: 1, // Changed from 1.5 to 1 to match integer type
    match_score: 88,
    match_reason: 'Solid foundation in lead scoring and HubSpot dashboarding (1.5 years). Meets the 1+ year experience requirement. Based in Cairo.',
    source: 'LinkedIn (Manual Sourcing)',
    linkedin_url: 'https://www.linkedin.com/in/sarah-mansour-hubspot/',
    status: 'Unvetted'
  },
  {
    full_name: 'Hisham Zaki',
    title: 'Senior HubSpot Specialist',
    location: 'Cairo, Egypt',
    years_experience_total: 5,
    match_score: 99,
    match_reason: 'Veteran HubSpot specialist (5+ years) with advanced knowledge of Custom Objects and Operations Hub (RevOps). Based in Cairo.',
    source: 'LinkedIn (Manual Sourcing)',
    linkedin_url: 'https://www.linkedin.com/in/hisham-zaki/',
    status: 'Unvetted'
  },
  {
    full_name: 'Mariam Aly',
    title: 'HubSpot Marketing Manager',
    location: 'Giza, Egypt',
    years_experience_total: 2,
    match_score: 90,
    match_reason: 'Specializes in HubSpot CMS and inbound marketing (2+ years). Strong track record in email marketing and landing page optimization. Based in Giza.',
    source: 'LinkedIn (Manual Sourcing)',
    linkedin_url: 'https://www.linkedin.com/in/mariam-aly-marketing/',
    status: 'Unvetted'
  }
];

async function insertCandidates() {
  console.log('Inserting HubSpot Specialists into Supabase...');
  const { data, error } = await supabase
    .from('candidates')
    .insert(candidates)
    .select();

  if (error) {
    console.error('Error inserting candidates:', error);
    process.exit(1);
  }

  console.log(`Successfully inserted ${data.length} candidates.`);
}

insertCandidates();
