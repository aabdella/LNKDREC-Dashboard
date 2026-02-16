import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Determine content type (defaults to PDF, but can handle images later if needed)
    const contentType = file.type || 'application/pdf';
    
    // Generate a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('candidates_resumes')
      .upload(filePath, file, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('candidates_resumes')
      .getPublicUrl(filePath);

    // Call Parsing Service (Placeholder for now - you can hook up your parser here)
    // For now, we'll return the URL so the frontend can use it or trigger a background job
    
    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      path: filePath
    });

  } catch (error: any) {
    console.error('Ingestion error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
