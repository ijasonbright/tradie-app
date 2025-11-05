import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function verify() {
  console.log('🔍 Verifying Completion Forms Import\n')

  // Count templates
  const templates = await sql`SELECT COUNT(*) as count FROM completion_form_templates`
  console.log(`📋 Templates: ${templates[0].count}`)

  // Count groups
  const groups = await sql`SELECT COUNT(*) as count FROM completion_form_template_groups`
  console.log(`📁 Groups: ${groups[0].count}`)

  // Count questions
  const questions = await sql`SELECT COUNT(*) as count FROM completion_form_template_questions`
  console.log(`❓ Questions: ${questions[0].count}`)

  // Show sample templates
  console.log('\n📝 Sample Templates:')
  const sampleTemplates = await sql`
    SELECT id, name, description, is_global, is_active
    FROM completion_form_templates
    ORDER BY name
    LIMIT 5
  `
  sampleTemplates.forEach((t: any) => {
    const status = t.is_active ? 'Active' : 'Inactive'
    const scope = t.is_global ? 'Global' : 'Org-specific'
    console.log(`   - ${t.name} (${status}, ${scope})`)
  })

  // Show a complete form structure example
  console.log('\n🏗️  Sample Form Structure (First Template):')
  const firstTemplate = await sql`
    SELECT * FROM completion_form_templates ORDER BY name LIMIT 1
  `
  if (firstTemplate.length > 0) {
    const templateId = firstTemplate[0].id
    console.log(`   Template: ${firstTemplate[0].name}`)

    const templateGroups = await sql`
      SELECT COUNT(*) as count FROM completion_form_template_groups WHERE template_id = ${templateId}
    `
    console.log(`   Groups: ${templateGroups[0].count}`)

    const templateQuestions = await sql`
      SELECT COUNT(*) as count FROM completion_form_template_questions WHERE template_id = ${templateId}
    `
    console.log(`   Questions: ${templateQuestions[0].count}`)
  }

  console.log('\n✅ Import verification complete!')
}

verify().catch(console.error)
