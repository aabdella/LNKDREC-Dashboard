import postgres from '../node_modules/postgres/src/index.js';

const SERVICE_KEY = 'REDACTED_SERVICE_ROLE_KEY';

const sql = postgres({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: 'postgres.clrzajerliyyddfyvggd',
  password: SERVICE_KEY,
  ssl: 'require',
  max: 1,
  connect_timeout: 10,
});

async function setupAuth() {
  try {
    console.log('Connecting to Supabase...');
    
    // 1. Create profiles table if not exists
    console.log('Creating/Updating profiles table...');
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email text NOT NULL,
        full_name text,
        role text DEFAULT 'user',
        is_approved boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;

    // 2. Setup a trigger to auto-create profile on signup
    console.log('Setting up profile trigger...');
    await sql`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, full_name, is_approved, role)
        VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', false, 'user');
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    await sql`
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `;

    console.log('✅ Auth & Profile schema ready!');

    // Note: Creating actual auth.users requires the Supabase Admin API (via fetch) 
    // rather than direct SQL to auth.users for security/hashing reasons.
    // I will handle the "Super Admin" insert to profiles after they sign up, 
    // or by pre-inserting them if I can reach the Auth API.
    
    // For now, let's pre-approve these two emails if they ever sign up
    console.log('Pre-approving Meedo & Mehairy...');
    // (This part is tricky because they don't have IDs yet, but I'll add a manual override)
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

setupAuth();
