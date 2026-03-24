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
      CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email text NOT NULL,
        full_name text,
        role text DEFAULT 'user',
        is_approved boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;

    console.log('✅ Profiles table created.');

    // Note: Creating actual auth.users requires the Supabase Admin API
    // We already ran the other script to create the users in Auth.
    // Now we'll just link them here in SQL.
    
    const admins = [
      { email: 'abdella@lnkd.ai', name: 'Meedo' },
      { email: 'mehairy@lnkd.ai', name: 'Mehairy' }
    ];

    for (const admin of admins) {
      console.log(`Linking admin: ${admin.email}...`);
      
      // Get the ID from auth.users
      const users = await sql`SELECT id FROM auth.users WHERE email = ${admin.email}`;
      if (users.length > 0) {
        const userId = users[0].id;
        await sql`
          INSERT INTO public.profiles (id, email, full_name, role, is_approved)
          VALUES (${userId}, ${admin.email}, ${admin.name}, 'super_admin', true)
          ON CONFLICT (id) DO UPDATE SET 
            role = 'super_admin',
            is_approved = true
        `;
        console.log(`✅ ${admin.email} linked and approved.`);
      } else {
        console.warn(`Could not find ${admin.email} in auth.users.`);
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

setupAuth();
