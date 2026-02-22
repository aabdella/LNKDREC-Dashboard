import postgres from './node_modules/postgres/src/index.js';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';

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

try {
  console.log('Connecting to Supabase...');
  const result = await sql`SELECT version()`;
  console.log('Connected! Version:', result[0].version.slice(0, 50));
  
  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at timestamptz DEFAULT now(),
      action text NOT NULL,
      entity_type text,
      entity_id text,
      entity_name text,
      details jsonb,
      source text DEFAULT 'web'
    )
  `;
  console.log('✅ Table activity_log created successfully!');
  
  // Verify
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log'`;
  console.log('Verification:', tables);
  
  // Insert a test row
  await sql`INSERT INTO activity_log (action, entity_type, entity_name, details, source) VALUES ('system_init', 'system', 'Activity Log', '{"message": "Table created"}', 'setup')`;
  console.log('✅ Test row inserted!');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await sql.end();
}
