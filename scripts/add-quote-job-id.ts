import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  // Check if job_id column already exists
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'job_id'
  `;

  if (cols.length === 0) {
    await sql`ALTER TABLE quotes ADD COLUMN job_id UUID REFERENCES jobs(id)`;
    console.log('Added job_id column to quotes table');
  } else {
    console.log('job_id column already exists');
  }
}

run().catch(console.error);
