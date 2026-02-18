
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables (manual simple dotenv)
const envPath = path.resolve(__dirname, '../../.env.local');
let supabaseUrl, supabaseKey;

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('
').forEach(line => {
    const [key, val] = line.split('=');
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = val;
  });
} catch (e) {
  console.log('No .env.local found, checking process.env...');
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Ensure .env.local exists or vars are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Regex Logic (Same as backend API)
function extractData(resume_text) {
    if (!resume_text) return {};

    // Tech & Tools Keywords
    const commonTech = ['React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'SQL', 'NoSQL', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Ruby'];
    const commonTools = ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Jira', 'Trello', 'Slack', 'Git', 'GitHub', 'GitLab', 'Linear'];

    const foundTech = commonTech.filter(t => new RegExp(`\b${t}\b`, 'i').test(resume_text)).map(t => ({ name: t, years: 1 }));
    const foundTools = commonTools.filter(t => new RegExp(`\b${t}\b`, 'i').test(resume_text)).map(t => ({ name: t, years: 1 }));

    // Simple Work History Parser (looks for dates)
    const historyRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–to]\s*(Present|Now|\d{4}))/gi;
    const work_history = [];
    let match;
    while ((match = historyRegex.exec(resume_text)) !== null) {
        // Grab surrounding text as context
        const start = Math.max(0, match.index - 50);
        const end = Math.min(resume_text.length, match.index + 100);
        const context = resume_text.substring(start, end).replace(/\s+/g, ' ').trim();
        // Naive title extraction (just the context line)
        work_history.push({ company: 'Unknown', title: context, years: 1 });
    }

    return {
        technologies: foundTech,
        tools: foundTools,
        work_history: work_history.slice(0, 3)
    };
}

async function runBackfill() {
    console.log('Starting backfill for PDF Upload candidates...');
    
    // 1. Fetch Candidates
    const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, resume_text, full_name')
        .eq('source', 'PDF Upload')
        .not('resume_text', 'is', null);

    if (error) {
        console.error('Error fetching candidates:', error);
        return;
    }

    console.log(`Found ${candidates.length} candidates to process.`);

    // 2. Process Each
    for (const candidate of candidates) {
        console.log(`Processing ${candidate.full_name} (${candidate.id})...`);
        const extraction = extractData(candidate.resume_text);

        if (extraction.technologies.length > 0 || extraction.tools.length > 0 || extraction.work_history.length > 0) {
            const { error: updateError } = await supabase
                .from('candidates')
                .update(extraction)
                .eq('id', candidate.id);
            
            if (updateError) console.error(`Failed to update ${candidate.id}:`, updateError.message);
            else console.log(`Updated ${candidate.full_name}: ${extraction.technologies.length} tech, ${extraction.work_history.length} jobs.`);
        } else {
            console.log(`No significant data found for ${candidate.full_name}. Skipping.`);
        }
    }

    console.log('Backfill complete.');
}

runBackfill();
