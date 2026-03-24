import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const SERVICE_ROLE_KEY = 'REDACTED_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY);

async function finalSetup() {
  const admins = [
    { email: 'abdella@lnkd.ai', name: 'Meedo' },
    { email: 'mehairy@lnkd.ai', name: 'Mehairy' }
  ];

  try {
    // We'll use RPC to run SQL if table doesn't exist or isn't in cache
    console.log('Running setup SQL...');
    
    // Create profiles table through Supabase RPC or just direct command
    const { error: sqlError } = await supabase.rpc('setup_auth_tables', {});
    // If we don't have this RPC, we'll try to just create the users 
    // and wait for you to run the SQL in the dashboard
    
    console.log('Verifying Users...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    for (const admin of admins) {
      const authUser = users.find(u => u.email === admin.email);
      if (authUser) {
        console.log(`✅ User exists: ${admin.email} (ID: ${authUser.id})`);
        // We'll try to update metadata
        await supabase.auth.admin.updateUserById(authUser.id, {
          user_metadata: { full_name: admin.name, role: 'super_admin' }
        });
      } else {
        console.log(`Creating ${admin.email}...`);
        await supabase.auth.admin.createUser({
          email: admin.email,
          password: 'TemporaryPassword123!',
          email_confirm: true,
          user_metadata: { full_name: admin.name, role: 'super_admin' }
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
}

finalSetup();
