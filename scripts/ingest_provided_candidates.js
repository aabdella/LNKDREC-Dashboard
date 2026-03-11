const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'REDACTED_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const candidates = [
  {
    full_name: "Maysara Khaled",
    location: "Cairo, Egypt",
    title: "Senior Graphic Designer",
    portfolio_url: "https://www.behance.net/maysarakhaled1",
    linkedin_url: "https://www.linkedin.com/in/maysara-khaled-381b282a5",
    match_reason: "Saudi national/founding day projects. Specializes in social media design & campaigns. Ex-A2Z Media.",
    match_score: 95
  },
  {
    full_name: "Nada Eid",
    location: "Egypt",
    title: "Senior Graphic Designer",
    portfolio_url: "https://www.behance.net/Nadasdesigns",
    linkedin_url: "https://www.linkedin.com/in/nadaeid",
    match_reason: "Direct Saudi exp at Jawa HR. Specialized in social media ads & campaigns since 2019.",
    match_score: 95
  },
  {
    full_name: "Medhat Labib",
    location: "Egypt",
    title: "Art Director / Graphic Designer",
    portfolio_url: "https://www.behance.net/med7atlabib",
    match_reason: "7+ yrs exp. Projects: Saudi AI Campaign, Sushi/Airlines campaigns. Uses AI tools (Firefly).",
    match_score: 95
  },
  {
    full_name: "Abdelrahim Amer",
    location: "Alexandria, Egypt",
    title: "Graphic Designer & Creative AI Specialist",
    portfolio_url: "https://www.behance.net/abdelrahim_amer",
    match_reason: "10+ yrs exp. Senior GD in Saudi (Nadrh). Expertise in brand strategy & AI-enhanced campaigns.",
    match_score: 95
  }
];

async function ingest() {
  console.log('📥 Adding specific candidates to unvetted queue...');
  for (const c of candidates) {
    const row = {
      ...c,
      source: 'Sourced',
      status: 'New',
      uploaded_at: new Date().toISOString()
    };
    const { error } = await supabase.from('unvetted').insert(row);
    if (error) console.error(`❌ Failed: ${c.full_name}`, error.message);
    else console.log(`✅ Added: ${c.full_name}`);
  }
  console.log('🏁 Done.');
}

ingest();