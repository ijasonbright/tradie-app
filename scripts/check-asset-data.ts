import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const jobs = await sql`SELECT id, status, report_data, completion_notes, completed_date FROM asset_register_jobs ORDER BY id DESC LIMIT 2`;
  console.log('TradieApp asset_register_jobs:');
  jobs.forEach((j: any) => {
    console.log('Job', j.id, '- Status:', j.status);
    console.log('  report_data:', JSON.stringify(j.report_data)?.substring(0, 500));
    console.log('  completion_notes:', j.completion_notes);
    console.log('  completed_date:', j.completed_date);
  });

  const forms = await sql`SELECT id, form_data FROM asset_register_completion_forms ORDER BY id DESC LIMIT 2`;
  console.log('\nTradieApp asset_register_completion_forms:');
  forms.forEach((f: any) => {
    console.log('Form', f.id);
    console.log('  form_data:', JSON.stringify(f.form_data)?.substring(0, 500));
  });
}

main();
