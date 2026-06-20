import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getSupabaseClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { candidate_id, resume_text } = await req.json();

    if (!candidate_id || !resume_text) {
      return NextResponse.json({ error: 'Missing candidate_id or resume_text' }, { status: 400 });
    }

    let extractedData: any = {};

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a recruitment parser. Extract structured data from the resume text provided. Return ONLY valid JSON.' },
            { role: 'user', content: `Resume Text:\n${resume_text.substring(0, 3000)}\n\nExtract the following JSON structure:\n{\n  "technologies": [{ "name": "React", "years": 2 }],\n  "tools": [{ "name": "Figma", "years": 3 }],\n  "work_history": [{ "company": "Google", "title": "Senior Engineer", "years": 2 }],\n  "years_experience": 5\n}` }
          ],
          response_format: { type: 'json_object' }
        });

        extractedData = JSON.parse(completion.choices[0].message.content || '{}');
      } catch (e) {
        console.error('OpenAI Parsing Failed:', e);
      }
    }

    if (Object.keys(extractedData).length === 0) {
      const commonTech = ['React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'SQL', 'NoSQL', 'AWS', 'Azure', 'Docker', 'Kubernetes'];
      const commonTools = ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Jira', 'Trello', 'Slack', 'Git'];

      const foundTech = commonTech.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(resume_text)).map(t => ({ name: t, years: 1 }));
      const foundTools = commonTools.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(resume_text)).map(t => ({ name: t, years: 1 }));

      const historyRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–to]\s*(Present|Now|\d{4}))/gi;
      const work_history = [];
      let match;
      while ((match = historyRegex.exec(resume_text)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(resume_text.length, match.index + 100);
        const context = resume_text.substring(start, end).replace(/\s+/g, ' ').trim();
        work_history.push({ company: 'Unknown', title: context, years: 1 });
      }

      extractedData = {
        technologies: foundTech,
        tools: foundTools,
        work_history: work_history.slice(0, 3)
      };
    }

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
