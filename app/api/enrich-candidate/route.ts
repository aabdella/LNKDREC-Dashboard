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

const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openai = openaiKey
  ? new OpenAI({
      apiKey: openaiKey,
      baseURL: process.env.OPENAI_API_KEY ? undefined : 'https://openrouter.ai/api/v1',
    })
  : null;
const LLM_MODEL = process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';

const ENRICHMENT_PROMPT = `You are a recruitment CV parser. Extract structured data from the resume text below. Return ONLY valid JSON with no markdown or explanation.

Schema:
{
  "full_name": "string (candidate's full name, or empty if unclear)",
  "title": "string (current/most recent job title — be specific, e.g. 'Senior Frontend Engineer')",
  "location": "string (city, country, or 'Remote')",
  "years_experience_total": "number (total years of professional experience, 0 if unclear)",
  "brief": "string (2-3 sentence professional summary)",
  "education": "string (highest degree, university, field of study)",
  "courses_certificates": "string (ALL courses, certifications, awards, and publications with full details. Each entry starts with '- ' and is on its own separate line via \\n)",
  "skills": "array of strings (List EVERY single individual skill mentioned anywhere in the CV. Read through the entire text carefully. Extract each and every skill — do NOT skip any, do NOT select only important ones)",
  "technologies": "array of { name: string, years: number } (EVERY technology mentioned — programming languages, frameworks, platforms. List ALL)",
  "tools": "array of { name: string, years: number } (EVERY specific software tool mentioned — Figma, Jira, etc. List ALL)",
  "work_history": "array of { company: string, title: string, start_date: string, end_date: string, brief: string } (ALL roles. brief: each bullet/sentence starts with '- ' on its own line via \\n. Include COMPLETE description)",
  "lnkd_notes": "string (notable details — languages, freelance status, notice period, salary)"
}

Rules:
- Extract ONLY what's in the text. Never invent.
- Skill routing: General skills/tech (React, Python, SQL) → technologies. Specific tools (Figma, Jira, Photoshop) → tools.
- Formatting: work_history brief lines and courses_certificates entries must each start with '- ' and be on separate lines via \\n.
- skills: Extract EVERY individual skill. Do not skip any.
- technologies/tools: Extract ALL technologies and ALL tools. Every single one.
- If text is empty, return schema with empty strings/arrays.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { candidate_id, resume_text } = await req.json();

    if (!candidate_id || !resume_text) {
      return NextResponse.json({ error: 'Missing candidate_id or resume_text' }, { status: 400 });
    }

    let extractedData: Record<string, any> = {};

    if (openai && resume_text.trim().length > 50) {
      try {
        const completion = await openai.chat.completions.create({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: ENRICHMENT_PROMPT },
            { role: 'user', content: resume_text.substring(0, 15000) }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 16000,
        });

        const raw = completion.choices[0]?.message?.content;
        if (raw) {
          extractedData = JSON.parse(raw);
        }
      } catch (e) {
        console.error('LLM enrichment failed:', e);
      }
    }

    const updatePayload: Record<string, any> = {};
    const fields: Array<keyof typeof extractedData> = [
      'full_name', 'title', 'location', 'years_experience_total',
      'brief', 'education', 'courses_certificates', 'skills',
      'technologies', 'tools', 'work_history', 'lnkd_notes',
    ];
    for (const field of fields) {
      if (extractedData[field] !== undefined) {
        updatePayload[field] = extractedData[field];
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from('candidates')
        .update(updatePayload)
        .eq('id', candidate_id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true, data: extractedData });
  } catch (err: any) {
    console.error('Enrichment Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
