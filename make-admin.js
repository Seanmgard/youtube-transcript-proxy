const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env.local file:', error.message);
    return {};
  }
}

const env = loadEnv();

async function makeAdmin() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get your email from the command line
    const email = process.argv[2];
    
    if (!email) {
      console.error('Please provide your email address:');
      console.log('Usage: node make-admin.js your-email@example.com');
      return;
    }

    console.log(`Making user with email ${email} an admin...`);

    // Update the user's profile to make them an admin
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('email', email)
      .select();

    if (error) {
      console.error('Error updating profile:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Successfully made user an admin!');
      console.log('You can now access the admin dashboard at /dashboard/admin/promoters');
    } else {
      console.log('❌ User not found. Please check the email address.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

makeAdmin(); 