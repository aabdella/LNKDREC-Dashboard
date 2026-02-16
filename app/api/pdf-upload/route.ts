import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    // Upload to bucket
    const { error: uploadError } = await supabase.storage
      .from('candidates_resumes')
      .upload(filePath, file, { contentType: file.type || 'application/pdf' });

    if (uploadError) throw uploadError;

    // Get URL
    const { data: { publicUrl } } = supabase.storage
      .from('candidates_resumes')
      .getPublicUrl(filePath);

    // Call Parser (Simulated)
    // In production: await fetch(PYTHON_PARSER_URL, { body: JSON.stringify({ url: publicUrl }) })
    const parsedData = {
        full_name: file.name.replace(/\.[^/.]+$/, ""), // Fallback name
        email: "",
        phone: "",
        skills: [],
        summary: "Parsed from PDF upload."
    };

    // Save to DB
    const { data: candidate, error: dbError } = await supabase
        .from('candidates')
        .insert({
            full_name: parsedData.full_name,
            resume_url: publicUrl,
            match_reason: parsedData.summary,
            source: 'PDF Upload',
            match_score: 50
        })
        .select()
        .single();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, candidate });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
