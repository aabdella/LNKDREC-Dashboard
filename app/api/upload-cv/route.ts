
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFParser from 'pdf2json';

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
    const filePath = `unvetted/${fileName}`; // Separate folder for unvetted

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

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('candidates_resumes')
      .getPublicUrl(filePath);

    // 2. Parse PDF Text with pdf2json (Pure JS, no native deps)
    const pdfText = await new Promise<string>((resolve, reject) => {
        const pdfParser = new (PDFParser as any)(null, 1); // 1 = text only mode

        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
             // Extract text from raw parsed data
             // pdf2json returns a complex object, we need to extract 'T' (text) fields
             try {
                // Simplified extraction: map pages -> texts -> decodeURIComponent
                const rawText = pdfParser.getRawTextContent();
                resolve(rawText);
             } catch (e) {
                // Fallback if getRawTextContent isn't available or fails
                resolve(""); 
             }
        });

        // Load buffer
        pdfParser.parseBuffer(buffer);
    });

    // 3. Extract Basic Data (Name, Email, Phone)
    const emailMatch = pdfText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    const phoneMatch = pdfText.match(/(\+?\d[\d -]{8,15}\d)/);
    
    // Attempt Name extraction: First non-empty line
    // Use String.fromCharCode(10) to safely split on newline without escape issues
    const lines = pdfText.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.length > 0);
    const potentialName = lines.length > 0 ? lines[0].substring(0, 100) : file.name.replace('.pdf', '');

    // 4. Insert into 'unvetted' table
    // If 'unvetted' table doesn't exist, this will fail. 
    // Fallback logic: Try inserting into 'candidates' with status='Unvetted' if 'unvetted' fails.
    
    let targetTable = 'unvetted';
    let payload: any = {
        full_name: potentialName,
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0] : null,
        resume_url: publicUrl,
        resume_text: pdfText, // Store raw text for later searching
        uploaded_at: new Date().toISOString(),
        status: 'New'
    };

    // Attempt insert to 'unvetted'
    const { data: unvettedData, error: unvettedError } = await supabase
        .from('unvetted')
        .insert(payload)
        .select()
        .single();

    if (unvettedError) {
        console.warn(`Table 'unvetted' insert failed (${unvettedError.code}). Falling back to 'candidates' table.`);
        
        // Fallback: Insert into main 'candidates' table
        targetTable = 'candidates';
        payload = {
            full_name: potentialName,
            // Map email/phone if columns exist, otherwise shove into notes
            lnkd_notes: `Email: ${payload.email}, Phone: ${payload.phone}

RAW_TEXT_PREVIEW: ${pdfText.substring(0, 500)}...`,
            linkedin_url: publicUrl, // Using this field for the CV URL for now
            source: 'PDF Upload',
            status: 'Unvetted',
            match_score: 10,
            match_reason: 'Manually uploaded PDF. Needs review.',
            years_experience_total: 0
        };

        const { data: candidateData, error: candidateError } = await supabase
            .from('candidates')
            .insert(payload)
            .select()
            .single();
        
        if (candidateError) {
            return NextResponse.json({ error: 'Database insert failed: ' + candidateError.message }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, candidate: candidateData, table: 'candidates' });
    }

    return NextResponse.json({ success: true, candidate: unvettedData, table: 'unvetted' });

  } catch (err: any) {
    console.error('Server Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
