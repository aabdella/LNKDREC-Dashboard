import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const pdf = require('pdf2json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Regex helpers built WITHOUT backslash escaping issues ───────────────────
// Instead of \d, use [0-9]. Instead of \w, use [a-zA-Z0-9_]. Instead of \s, use [ \t\r\n].
// This avoids ANY tool/build-time backslash stripping.

const R = {
  email:    new RegExp('[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+[.][a-zA-Z0-9_-]+', 'i'),
  phone:    new RegExp('[+]?[0-9][0-9 -]{8,15}[0-9]', 'i'),
  linkedin: new RegExp('linkedin[.]com/in/[a-zA-Z0-9_-]+', 'i'),
  behance:  new RegExp('behance[.]net/[a-zA-Z0-9_-]+', 'i'),
  dribbble: new RegExp('dribbble[.]com/[a-zA-Z0-9_-]+', 'i'),
  github:   new RegExp('github[.]com/[a-zA-Z0-9_-]+', 'i'),
  location: new RegExp('Cairo|Alexandria|Giza|Remote|Egypt|Maadi|Nasr City|October|Zayed', 'i'),
  exp:      new RegExp('([0-9]+)[+]?[ \t]*(years?|yrs?)', 'i'),
};

// Safe tech keyword matcher — no backslashes needed
function matchesTech(tech: string, text: string): boolean {
  try {
    // Escape only chars that are special in regex but NOT backslash-based
    const safe = tech
      .split('+').join('[+]')
      .split('.').join('[.]')
      .split('(').join('[(]')
      .split(')').join('[)]')
      .split('#').join('[#]');
    return new RegExp(safe, 'i').test(text);
  } catch (_) {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // 1. Upload to Supabase Storage
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

    // 2. Parse PDF Text
    const pdfText = await new Promise<string>((resolve, reject) => {
      const pdfParser = new pdf(null, 1);
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", () => {
        try { resolve(pdfParser.getRawTextContent()); } catch (_) { resolve(''); }
      });
      pdfParser.parseBuffer(buffer);
    });

    // 3. Extract fields using backslash-free regex
    const emailMatch    = pdfText.match(R.email);
    const phoneMatch    = pdfText.match(R.phone);
    const linkedinMatch = pdfText.match(R.linkedin);
    const behanceMatch  = pdfText.match(R.behance);
    const dribbbleMatch = pdfText.match(R.dribbble);
    const githubMatch   = pdfText.match(R.github);
    const locationMatch = pdfText.match(R.location);
    const expMatch      = pdfText.match(R.exp);

    const linkedinUrl  = linkedinMatch  ? `https://${linkedinMatch[0]}`  : '';
    const portfolioUrl = behanceMatch   ? `https://${behanceMatch[0]}`   :
                         dribbbleMatch  ? `https://${dribbbleMatch[0]}`  :
                         githubMatch    ? `https://${githubMatch[0]}`    : '';
    const location     = locationMatch  ? locationMatch[0]               : 'Remote';
    let   yearsExp     = expMatch       ? parseInt(expMatch[1])          : 0;
    if (yearsExp > 40) yearsExp = 0;

    // Title
    const roles = ['Graphic Designer','UI/UX','Product Designer','Frontend','Backend','Full Stack','Art Director','Senior Designer','Junior Designer'];
    const titleMatch = pdfText.match(new RegExp('(' + roles.join('|') + ')', 'i'));
    const title = titleMatch ? titleMatch[0] : 'Candidate';

    // Name: first non-empty line
    const lines = pdfText.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.length > 0);
    const potentialName = lines.length > 0 ? lines[0].substring(0, 100) : file.name.replace('.pdf', '');

    // Technologies
    const techKeywords = ['React','Next.js','Node.js','TypeScript','JavaScript','Python','Django','Flask','SQL','PostgreSQL','MongoDB','AWS','Docker','Kubernetes','Git','Figma','Adobe XD','Photoshop','Illustrator','InDesign','After Effects','Premiere','Blender','Unity','C#','C++','Java','Spring','Kotlin','Swift','Flutter','Dart'];
    const technologies = techKeywords
      .filter(t => matchesTech(t, pdfText))
      .map(t => ({ name: t, years: 1 }));

    // Work History: look for date ranges using character classes only
    const workHistory: any[] = [];
    const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
    const dateRangeRegex = new RegExp(
      '((' + months + ')?[ \t]*[0-9]{4}[ \t]*(-|to)[ \t]*(Present|Now|Current|(' + months + ')?[ \t]*[0-9]{4}))',
      'gi'
    );
    let m;
    while ((m = dateRangeRegex.exec(pdfText)) !== null) {
      const ctx = pdfText.substring(Math.max(0, m.index - 50), Math.min(pdfText.length, m.index + 100))
        .replace(/[ \t\r\n]+/g, ' ').trim();
      workHistory.push({ company: 'Unknown Company', title: ctx, years: 1 });
    }

    const extractedData = {
      full_name: potentialName,
      title,
      email:    emailMatch ? emailMatch[0] : '',
      phone:    phoneMatch ? phoneMatch[0] : '',
      location,
      years_experience_total: yearsExp,
      linkedin_url:  linkedinUrl,
      portfolio_url: portfolioUrl,
      resume_url:    publicUrl,
      resume_text:   pdfText,
      source:        'PDF Upload',
      match_score:   10,
      match_reason:  'Parsed from PDF. Please review extracted fields.',
      status:        'New',
      uploaded_at:   new Date().toISOString(),
      technologies,
      tools:         [],
      work_history:  workHistory.slice(0, 3),
    };

    const { data: unvettedRow, error: unvettedError } = await supabase
      .from('unvetted').insert(extractedData).select().single();

    if (unvettedError) {
      const { data: candidateRow, error: candidateError } = await supabase
        .from('candidates').insert({ ...extractedData, status: 'Unvetted' }).select().single();
      if (candidateError) return NextResponse.json({ error: 'DB insert failed: ' + candidateError.message }, { status: 500 });
      return NextResponse.json({ success: true, candidate: candidateRow, table: 'candidates' });
    }

    return NextResponse.json({ success: true, candidate: unvettedRow, table: 'unvetted' });

  } catch (err: any) {
    console.error('Server Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
