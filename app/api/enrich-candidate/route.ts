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

// Try OpenAI key first, fall back to OpenRouter key
const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openai = openaiKey
  ? new OpenAI({
      apiKey: openaiKey,
      baseURL: process.env.OPENAI_API_KEY
        ? undefined
        : 'https://openrouter.ai/api/v1',
    })
  : null;
const LLM_MODEL = process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';

const ENRICHMENT_PROMPT = `You are a recruitment CV parser. Extract structured data from the resume text below.
Return ONLY valid JSON with no markdown or explanation.

Schema:
{
  "full_name": "string (candidate's full name, or empty if unclear)",
  "title": "string (current/most recent job title — be specific, e.g. 'Senior Frontend Engineer')",
  "location": "string (city, country, or 'Remote')",
  "years_experience_total": "number (total years of professional experience, 0 if unclear)",
  "brief": "string (2-3 sentence professional summary)",
  "education": "string (highest degree, university, field of study — e.g. 'BSc Computer Science, Cairo University')",
  "courses_certificates": "string (ALL courses, certifications, awards, and publications with full details — dates, institutions, descriptions)",
  "skills": "array of strings (ALL hard and soft skills. Max 25)",
  "technologies": "array of { name: string, years: number } (ALL general skills/technologies — programming languages, frameworks, platforms. NOT specific tools. Max 20)",
  "tools": "array of { name: string, years: number } (ALL specific software applications — Figma, Jira, Salesforce, etc. Max 15)",
  "work_history": "array of { company: string, title: string, start_date: string, end_date: string, brief: string } (ALL roles, max 8. brief includes ALL responsibilities and achievements — not just first line)",
  "lnkd_notes": "string (notable details — languages, freelance status, notice period, salary)"
}

Rules:
- Extract ONLY what's in the text. Never invent.
- **Skill routing**: General skills/tech (React, Python, SQL, AWS) → technologies. Specific tools (Figma, Jira, Photoshop) → tools.
- **work_history.brief**: Include a short description of what they did in each role.
- **courses_certificates**: Include courses, certifications, awards AND publications.
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
          temperature: 0.1,
          max_tokens: 3000,
        });

        const raw = completion.choices[0]?.message?.content;
        if (raw) {
          extractedData = JSON.parse(raw);
        }
      } catch (e) {
        console.error('LLM enrichment failed:', e);
      }
    }

    // Build the update payload — only what the LLM extracted
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
