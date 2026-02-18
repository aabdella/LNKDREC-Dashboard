
const { createClient } = require('@supabase/supabase-js');

// Hardcoded keys from MEMORY.md
const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBackfill() {
    console.log('Starting backfill for PDF Upload candidates...');
    
    // 1. Fetch Candidates (limit to 100)
    const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, resume_text, full_name, technologies, tools, work_history')
        .eq('source', 'PDF Upload')
        .not('resume_text', 'is', null)
        .limit(100);

    if (error) {
        console.error('Error fetching candidates:', error);
        return;
    }

    if (!candidates || candidates.length === 0) {
        console.log('No candidates found with source="PDF Upload" and resume_text.');
        return;
    }

    console.log(`Found ${candidates.length} candidates to process.`);

    // Tech & Tools Keywords
    const commonTech = ['React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'SQL', 'NoSQL', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Ruby'];
    const commonTools = ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Jira', 'Trello', 'Slack', 'Git', 'GitHub', 'GitLab', 'Linear'];

    // 2. Process Each
    for (const candidate of candidates) {
        const text = candidate.resume_text || '';
        
        // Skip if already populated
        // if (candidate.technologies?.length || candidate.work_history?.length) continue;

        // Regex Logic
        const foundTech = commonTech
            .filter(t => new RegExp(`\b${t}\b`, 'i').test(text))
            .map(t => ({ name: t, years: 1 }));
            
        const foundTools = commonTools
            .filter(t => new RegExp(`\b${t}\b`, 'i').test(text))
            .map(t => ({ name: t, years: 1 }));

        // Simple Work History Parser
        const historyRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–to]\s*(Present|Now|\d{4}))/gi;
        const work_history = [];
        let match;
        
        // Reset regex index
        historyRegex.lastIndex = 0;
        
        while ((match = historyRegex.exec(text)) !== null) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(text.length, match.index + 100);
            const context = text.substring(start, end).replace(/\s+/g, ' ').trim();
            work_history.push({ company: 'Unknown', title: context, years: 1 });
            
            if (work_history.length >= 3) break; // Limit to 3
        }

        if (foundTech.length > 0 || foundTools.length > 0 || work_history.length > 0) {
            console.log(`Updating ${candidate.full_name}: ${foundTech.length} tech, ${foundTools.length} tools, ${work_history.length} jobs.`);
            
            const { error: updateError } = await supabase
                .from('candidates')
                .update({
                    technologies: foundTech,
                    tools: foundTools,
                    work_history: work_history
                })
                .eq('id', candidate.id);
            
            if (updateError) console.error(`Failed to update ${candidate.id}:`, updateError.message);
        } else {
            console.log(`No significant data found for ${candidate.full_name}. Skipping.`);
        }
    }

    console.log('Backfill complete.');
}

runBackfill();
