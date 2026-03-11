import postgres from 'postgres';

// SERVICE_KEY used as password for postgres direct connection
const SERVICE_KEY = 'REDACTED_SERVICE_ROLE_KEY';

const sql = postgres({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543, // Transaction pooler
  database: 'postgres',
  username: 'postgres.clrzajerliyyddfyvggd', // Full username for pooler
  password: SERVICE_KEY,
  ssl: 'require',
  prepare: false // Critical for poolers
});

async function run() {
  try {
    console.log('Adding column is_highlighted...');
    await sql`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false`;
    console.log('✅ Column added successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

run();