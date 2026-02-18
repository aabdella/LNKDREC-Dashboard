
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI (Optional - if key exists)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: NextRequest) {
  try {
    const { candidate_id, resume_text } = await req.json();

    if (!candidate_id || !resume_text) {
      return NextResponse.json({ error: 'Missing candidate_id or resume_text' }, { status: 400 });
    }

    let extractedData = {};

    // 1. Try LLM Extraction first (if available)
    if (openai) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are a recruitment parser. Extract structured data from the resume text provided. Return ONLY valid JSON." },
                    { role: "user", content: `Resume Text:
${resume_text.substring(0, 3000)}

Extract the following JSON structure:
{
  "technologies": [{ "name": "React", "years": 2 }],
  "tools": [{ "name": "Figma", "years": 3 }],
  "work_history": [{ "company": "Google", "title": "Senior Engineer", "years": 2 }],
  "years_experience": 5
}` }
                ],
                response_format: { type: "json_object" }
            });
            
            extractedData = JSON.parse(completion.choices[0].message.content || '{}');
        } catch (e) {
            console.error('OpenAI Parsing Failed:', e);
            // Fallback to regex below
        }
    }

    // 2. Fallback: Regex Extraction (if LLM failed or not configured)
    if (Object.keys(extractedData).length === 0) {
        // Tech & Tools Keywords
        const commonTech = ['React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'SQL', 'NoSQL', 'AWS', 'Azure', 'Docker', 'Kubernetes'];
        const commonTools = ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Jira', 'Trello', 'Slack', 'Git'];

        const foundTech = commonTech.filter(t => new RegExp(`\b${t}\b`, 'i').test(resume_text)).map(t => ({ name: t, years: 1 }));
        const foundTools = commonTools.filter(t => new RegExp(`\b${t}\b`, 'i').test(resume_text)).map(t => ({ name: t, years: 1 }));

        // Simple Work History Parser (looks for dates)
        // Matches "Jan 2020 - Present" or "2019 - 2021"
        const historyRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–to]\s*(Present|Now|\d{4}))/gi;
        const work_history = [];
        let match;
        while ((match = historyRegex.exec(resume_text)) !== null) {
            // Grab surrounding text as context
            const start = Math.max(0, match.index - 50);
            const end = Math.min(resume_text.length, match.index + 100);
            const context = resume_text.substring(start, end).replace(/\s+/g, ' ').trim();
            work_history.push({ company: 'Unknown', title: context, years: 1 });
        }

        extractedData = {
            technologies: foundTech,
            tools: foundTools,
            work_history: work_history.slice(0, 3) // Limit to top 3
        };
    }

    // 3. Update Supabase Candidate
    const { error } = await supabase
        .from('candidates')
        .update(extractedData)
        .eq('id', candidate_id);

    if (error) throw error;

    return NextResponse.json({ success: true, data: extractedData });

  } catch (err: any) {
    console.error('Enrichment Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
