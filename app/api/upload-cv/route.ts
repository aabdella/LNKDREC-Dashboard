import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const pdf = require('pdf2json');

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getSupabaseForUploadCv() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

// Regex only for universal patterns (contact info, URLs) — not for roles, tech, locations, etc.
const CONTACT_PATTERNS = {
  email:    /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/i,
  phone:    /[+]?[0-9][0-9 -]{8,15}[0-9]/,
  linkedin: /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i,
  behance:  /behance\.net\/[a-zA-Z0-9_-]+/i,
  dribbble: /dribbble\.com\/[a-zA-Z0-9_-]+/i,
  github:   /github\.com\/[a-zA-Z0-9_-]+/i,
};

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

const EXTRACTION_PROMPT = `You are a recruitment CV parser. Extract structured data from the resume text below.
Return ONLY valid JSON with no markdown or explanation.

Schema:
{
  "full_name": "string (candidate's full name, or empty if unclear)",
  "title": "string (current/most recent job title — NOT 'Candidate'. Be specific, e.g. 'Senior Frontend Engineer', 'Motion Designer')",
  "email": "string",
  "phone": "string",
  "location": "string (city, country, or 'Remote' if specified. Be specific)",
  "linkedin_url": "string (full URL)",
  "portfolio_url": "string (Behance, Dribbble, GitHub, personal website, or empty)",
  "years_experience_total": "number (total years of professional experience, 0 if unclear)",
  "brief": "string (2-3 sentence professional summary of their background and key strengths)",
  "education": "string (highest degree, university, field of study — e.g. 'BSc Computer Science, Cairo University'. Empty if not found)",
  "courses_certificates": "string (ALL courses, certifications, awards, and publications with full details — each on a SEPARATE LINE. Include dates, institutions, descriptions. Use newline \\n between entries)",
  "skills": "array of strings (ALL hard and soft skills mentioned — not just first few. Max 25)",
  "technologies": "array of { name: string, years: number } (ALL general skills and technologies — programming languages, frameworks, platforms, methodologies. NOT specific software tools. Max 20. Default years=1 if unclear)",
  "tools": "array of { name: string, years: number } (ALL specific software applications — Figma, Jira, Salesforce, Google Analytics, Photoshop, etc. Max 15. Default years=1 if unclear)",
  "work_history": "array of { company: string, title: string, start_date: string, end_date: string, brief: string } (ALL roles listed, max 8. Use actual company names and titles. dates as 'Mar 2020' or '2020' format. brief must include ALL responsibilities and achievements mentioned for that role — not just the first sentence)",
  "lnkd_notes": "string (any notable details — languages spoken, freelance status, notice period, salary expectations. Empty if not found)"
}

Rules:
- Extract ONLY what's explicitly in the text. Never invent.
- For "title": if they list a current role, use that exact title. Do NOT default to 'Candidate'.
- For "location": if they mention multiple, use the most recent.
- For "years_experience_total": look for explicit statements like "5+ years" or calculate from earliest role. Default 0.
- **Skill routing**: Distinguish general skills/technologies (e.g. React, Python, SQL, Docker) from specific tools (e.g. Figma, Jira, Photoshop, Google Analytics). Put each in the correct array.
- **work_history.brief**: Include ALL responsibilities and achievements mentioned for each role — not just the first sentence or bullet point.
- **courses_certificates**: Include ALL courses, certifications, awards AND publications with their full details (dates, institutions, descriptions).
- **skills/technologies/tools**: Extract ALL of them. Do not truncate to just the first few.
- If the text is empty or unreadable, return the schema with empty strings and empty arrays.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseForUploadCv();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `unvetted/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('candidates_resumes')
      .upload(filePath, buffer, { contentType: file.type || 'application/pdf', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from('candidates_resumes').getPublicUrl(filePath);

    // ── Extract raw text via pdf2json ──────────────────────────
    const pdfText = await new Promise<string>((resolve, reject) => {
      const pdfParser = new pdf(null, 1);
      pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
      pdfParser.on('pdfParser_dataReady', () => {
        try { resolve(pdfParser.getRawTextContent()); } catch (_) { resolve(''); }
      });
      pdfParser.parseBuffer(buffer);
    });

    // ── Regex extraction for universal patterns only ────────────
    const emailMatch    = pdfText.match(CONTACT_PATTERNS.email);
    const phoneMatch    = pdfText.match(CONTACT_PATTERNS.phone);
    const linkedinMatch = pdfText.match(CONTACT_PATTERNS.linkedin);
    const behanceMatch  = pdfText.match(CONTACT_PATTERNS.behance);
    const dribbbleMatch = pdfText.match(CONTACT_PATTERNS.dribbble);
    const githubMatch   = pdfText.match(CONTACT_PATTERNS.github);

    const fallbackLinkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : '';
    const fallbackPortfolioUrl = behanceMatch  ? `https://${behanceMatch[0]}` :
                                  dribbbleMatch ? `https://${dribbbleMatch[0]}` :
                                  githubMatch   ? `https://${githubMatch[0]}` : '';

    // ── LLM extraction for everything else ──────────────────────
    let llmData: Record<string, any> = {};
    let llmSucceeded = false;

    if (openai && pdfText.trim().length > 50) {
      try {
        const completion = await openai.chat.completions.create({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: pdfText.substring(0, 15000) }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 6000,
        });

        const raw = completion.choices[0]?.message?.content;
        if (raw) {
          llmData = JSON.parse(raw);
          llmSucceeded = true;
        }
      } catch (e) {
        console.error('LLM extraction failed:', e);
      }
    }

    // ── Merge: LLM wins, regex fills gaps ───────────────────────
    const extractedData = {
      full_name:             llmData.full_name             || pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0)[0]?.substring(0, 100) || file.name.replace('.pdf', '') || '',
      title:                 llmData.title                 || 'Candidate',
      email:                 llmData.email                 || (emailMatch ? emailMatch[0] : ''),
      phone:                 llmData.phone                 || (phoneMatch ? phoneMatch[0] : ''),
      location:              llmData.location              || 'Remote',
      years_experience_total: typeof llmData.years_experience_total === 'number' ? llmData.years_experience_total : 0,
      linkedin_url:          llmData.linkedin_url          || fallbackLinkedinUrl,
      portfolio_url:         llmData.portfolio_url         || fallbackPortfolioUrl,
      brief:                 llmData.brief                 || '',
      education:             llmData.education             || '',
      courses_certificates:  llmData.courses_certificates  || '',
      skills:                Array.isArray(llmData.skills)                ? llmData.skills                : [],
      technologies:          Array.isArray(llmData.technologies)          ? llmData.technologies          : [],
      tools:                 Array.isArray(llmData.tools)                 ? llmData.tools                 : [],
      work_history:          Array.isArray(llmData.work_history)          ? llmData.work_history.slice(0, 5) : [],
      lnkd_notes:            llmData.lnkd_notes            || '',
      resume_url:            publicUrl,
      resume_text:           pdfText,
      source:                'PDF Upload',
      match_score:           10,
      match_reason:          llmSucceeded ? 'Parsed from CV using AI extraction.' : 'Basic extraction (LLM unavailable). Please review.',
      status:                'New',
      uploaded_at:           new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      candidate: extractedData,
      table: 'none',
      extracted_only: true,
    });

  } catch (err: any) {
    console.error('Server Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
