import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const SERVICE_ROLE_KEY = 'REDACTED_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSuperAdmins() {
  const users = [
    { email: 'abdella@lnkd.ai', password: 'TemporaryPassword123!', name: 'Meedo' },
    { email: 'mehairy@lnkd.ai', password: 'TemporaryPassword123!', name: 'Mehairy' }
  ];

  for (const user of users) {
    console.log(`Creating user: ${user.email}...`);
    
    // Create the user in Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.name }
    });

    if (authError) {
      if (authError.message.includes('already has been registered')) {
        console.warn(`User ${user.email} already exists in Auth.`);
      } else {
        console.error(`Error creating ${user.email}:`, authError.message);
        continue;
      }
    }

    // Now, let's manually update/insert into our profiles table
    // (Note: The SQL trigger we wrote earlier will handle NEW signups, 
    // but we can ensure these are Super Admins here)
    
    // We need to wait for a moment for the trigger to fire, or just upsert it.
    console.log(`Updating profile for ${user.email} to Super Admin...`);
    
    // To update the profile, we need the user ID. 
    // If authUser was created, we get it from there. 
    // If they already existed, we fetch it.
    let userId = authUser?.user?.id;
    if (!userId) {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      userId = existingUser.users.find(u => u.email === user.email)?.id;
    }

    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          email: user.email, 
          full_name: user.name, 
          role: 'super_admin', 
          is_approved: true 
        });

      if (profileError) {
        console.error(`Error updating profile for ${user.email}:`, profileError.message);
      } else {
        console.log(`✅ ${user.email} is now a Super Admin.`);
      }
    }
  }
}

createSuperAdmins();
