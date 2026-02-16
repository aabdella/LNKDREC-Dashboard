
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `resumes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('candidates_resumes')
            .upload(filePath, file, { contentType: file.type || 'application/pdf', upsert: false });

        if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

        const { data: { publicUrl } } = supabase.storage
            .from('candidates_resumes')
            .getPublicUrl(filePath);

        // 2. Parse PDF (Simulated for now - replace with actual parser call)
        const parsedData = {
            full_name: file.name.replace('.pdf', ''),
            email: 'parsed@example.com',
            phone: '+201xxxxxxxxx',
            skills: ['Skill 1', 'Skill 2'],
            summary: 'Auto-extracted summary from PDF.'
        };

        // 3. Save to Database
        const { data: candidate, error: dbError } = await supabase
            .from('candidates')
            .insert({
                full_name: parsedData.full_name,
                email: parsedData.email,
                phone: parsedData.phone,
                resume_url: publicUrl,
                match_reason: parsedData.summary,
                source: 'PDF Upload',
                match_score: 50,
                years_experience_total: 0
            })
            .select()
            .single();

        if (dbError) throw new Error('DB Insert failed: ' + dbError.message);

        return NextResponse.json({ success: true, candidate });

    } catch (error: any) {
        console.error('Ingestion error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
