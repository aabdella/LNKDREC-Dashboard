
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Fail-safe imports for CommonJS (build compatibility)
const pdf = require('pdf2json');

// Initialize Supabase Client with fail-safe for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 1. Upload to Supabase Storage (Bucket: candidates_resumes)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `unvetted/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('candidates_resumes')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('candidates_resumes')
      .getPublicUrl(filePath);

    // 2. Parse PDF Text with pdf2json
    const pdfText = await new Promise<string>((resolve, reject) => {
        const pdfParser = new pdf(null, 1);
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
             try {
                const rawText = pdfParser.getRawTextContent();
                resolve(rawText);
             } catch (e) {
                resolve(""); 
             }
        });
        pdfParser.parseBuffer(buffer);
    });

    // 3. ENHANCED EXTRACTION LOGIC
    
    // Email & Phone
    const emailMatch = pdfText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    const phoneMatch = pdfText.match(/(\+?\d[\d -]{8,15}\d)/);
    
    // LinkedIn
    const linkedinMatch = pdfText.match(/(linkedin\.com/in/[\w-]+)/i);
    const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : '';

    // Portfolio (Behance, Dribbble, GitHub)
    const behanceMatch = pdfText.match(/(behance\.net/[\w-]+)/i);
    const dribbbleMatch = pdfText.match(/(dribbble\.com/[\w-]+)/i);
    const githubMatch = pdfText.match(/(github\.com/[\w-]+)/i);
    const portfolioUrl = behanceMatch ? `https://${behanceMatch[0]}` : 
                         dribbbleMatch ? `https://${dribbbleMatch[0]}` :
                         githubMatch ? `https://${githubMatch[0]}` : '';

    // Location (Common Egyptian Cities + Remote)
    const locationRegex = /(Cairo|Alexandria|Giza|Remote|Egypt|Maadi|Nasr City|October|Zayed)/i;
    const locationMatch = pdfText.match(locationRegex);
    const location = locationMatch ? locationMatch[0] : 'Remote';

    // Years of Experience (Basic guess: look for "X years" near the top or "Experience" section)
    const expRegex = /(\d+)\+?\s*(years?|yrs?)/i;
    const expMatch = pdfText.match(expRegex);
    let yearsExp = expMatch ? parseInt(expMatch[1]) : 0;
    if (yearsExp > 40) yearsExp = 0; // Sanity check

    // Title (Look for common roles)
    const roles = ['Graphic Designer', 'UI/UX', 'Product Designer', 'Frontend', 'Backend', 'Full Stack', 'Art Director', 'Senior Designer', 'Junior Designer'];
    const titleRegex = new RegExp(`(${roles.join('|')})`, 'i');
    const titleMatch = pdfText.match(titleRegex);
    const title = titleMatch ? titleMatch[0] : 'Candidate';

    // Name Extraction (First non-empty line usually works best for PDFs)
    const lines = pdfText.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.length > 0);
    const potentialName = lines.length > 0 ? lines[0].substring(0, 100) : file.name.replace('.pdf', '');

    // 4. Payload for Frontend & Unvetted Table
    const extractedData = {
        full_name: potentialName,
        title: title,
        email: emailMatch ? emailMatch[0] : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        location: location,
        years_experience_total: yearsExp,
        linkedin_url: linkedinUrl,
        portfolio_url: portfolioUrl,
        resume_url: publicUrl,
        resume_text: pdfText,
        source: 'PDF Upload',
        match_score: 10, // Default low score until manually vetted
        match_reason: "Parsed from PDF. Please review extracted fields.",
        status: 'New',
        uploaded_at: new Date().toISOString()
    };

    // 5. Insert into Unvetted Table (or Fallback)
    let finalData = extractedData;
    let tableUsed = 'unvetted';

    const { data: unvettedRow, error: unvettedError } = await supabase
        .from('unvetted')
        .insert(extractedData)
        .select()
        .single();

    if (unvettedError) {
        console.warn(`Unvetted insert failed (${unvettedError.code}), falling back to candidates table.`);
        tableUsed = 'candidates';
        
        // Adjust payload for candidates table if schema differs slightly
        const candidatePayload = {
            ...extractedData,
            status: 'Unvetted',
            lnkd_notes: `Parsed Data:
Email: ${extractedData.email}
Phone: ${extractedData.phone}

Raw Text Preview:
${pdfText.substring(0, 500)}...`
        };

        const { data: candidateRow, error: candidateError } = await supabase
            .from('candidates')
            .insert(candidatePayload)
            .select()
            .single();

        if (candidateError) {
            return NextResponse.json({ error: 'Database insert failed: ' + candidateError.message }, { status: 500 });
        }
        finalData = { ...candidateRow, id: candidateRow.id }; // Ensure ID is returned
    } else {
        finalData = { ...unvettedRow, id: unvettedRow.id };
    }

    return NextResponse.json({ success: true, candidate: finalData, table: tableUsed });

  } catch (err: any) {
    console.error('Server Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
