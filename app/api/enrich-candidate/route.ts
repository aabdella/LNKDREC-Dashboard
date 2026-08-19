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
  "courses_certificates": "string (certifications, courses — comma separated)",
  "skills": "array of strings (hard and soft skills. Max 15)",
  "technologies": "array of { name: string, years: number } (tech/tools. Max 15)",
  "tools": "array of { name: string, years: number } (software/tools. Max 10)",
  "work_history": "array of { company: string, title: string, start_date: string, end_date: string, brief: string } (max 5 most recent roles)",
  "lnkd_notes": "string (notable details — languages, freelance status, notice period, salary)"
}

Rules:
- Extract ONLY what's in the text. Never invent.
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
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: ENRICHMENT_PROMPT },
            { role: 'user', content: resume_text.substring(0, 8000) }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 2000,
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
