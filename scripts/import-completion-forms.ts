/**
 * CSV Import Script for Completion Forms
 *
 * This script imports completion form templates from CSV files:
 * - JobTypeForm.csv → completion_form_templates
 * - JobTypeFormGroup.csv → completion_form_template_groups
 * - JobTypeFormQuestion.csv → completion_form_template_questions
 * - JobTypeFormAnswer.csv → Embedded in questions as answer_options
 *
 * Usage:
 * 1. Ensure CSV files are in /data/completion-forms-import/
 * 2. Run: npx tsx scripts/import-completion-forms.ts
 * 3. Verify import by checking database
 */

import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import { neon } from '@neondatabase/serverless'

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

// CSV file paths
const CSV_DIR = path.join(process.cwd(), 'data', 'completion-forms-import')
const FORMS_CSV = path.join(CSV_DIR, 'JobTypeForm.csv')
const GROUPS_CSV = path.join(CSV_DIR, 'JobTypeFormGroup.csv')
const QUESTIONS_CSV = path.join(CSV_DIR, 'JobTypeFormQuestion.csv')
const ANSWERS_CSV = path.join(CSV_DIR, 'JobTypeFormAnswer.csv')

// Mapping of CSV field types to our field types
const FIELD_TYPE_MAP: Record<string, string> = {
  'textbox': 'text',
  'textarea': 'textarea',
  'radioboxlist': 'radio',
  'dropdown': 'dropdown',
  'file': 'file',
  'datepicker': 'date',
  'checkboxlist': 'multi_checkbox',
  'checkbox': 'checkbox',
  'iscompliant': 'radio', // Special case: compliant yes/no
  'hidden': 'hidden',
  'number': 'number',
  'email': 'email',
  'phone': 'phone',
  'datetime': 'datetime',
  'time': 'time',
  'signature': 'signature',
  'rating': 'rating',
  'html': 'html',
}

interface CsvForm {
  JobTypeFormId: string
  Name: string
  SiteId: string
  JobTypeId: string
  Description: string
  FormTypeId: string
  Code: string
  SiteGroupId: string
}

interface CsvGroup {
  JobTypeFormGroupId: string
  JobTypeFormId: string
  Name: string
  Description: string
  SortOrder: string
  IsCompletionGroup: string
}

interface CsvQuestion {
  JobTypeFormQuestionId: string
  JobTypeFormId: string
  GroupNo: string
  Description: string
  AnswerFormat: string
  Required: string
  SortOrder: string
  PlaceHolder: string
  ValidationMessage: string
  Config: string
  Field: string
  HelpUrl: string
  DefaultText: string
}

interface CsvAnswer {
  JobTypeFormAnswerId: string
  JobTypeFormQuestionId: string
  Description: string
  SortOrder: string
  ColorCodeId: string
  ActionsRequired: string
}

// Helper to read and parse CSV
function readCsv<T>(filePath: string): T[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    // Remove BOM if present
    const cleanContent = content.replace(/^\uFEFF/, '')
    return parse(cleanContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  } catch (error) {
    console.error(`❌ Error reading ${path.basename(filePath)}:`, error)
    return []
  }
}

// Helper to generate UUID (v4)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Parse config string from CSV (e.g., "types:*.jpeg,*.jpg,*.png;size:40960")
function parseConfig(configStr: string): any {
  if (!configStr || configStr === 'NULL') return null

  const config: any = {}
  const parts = configStr.split(';')

  for (const part of parts) {
    const [key, value] = part.split(':')
    if (key && value) {
      if (key === 'types') {
        config.allowedTypes = value.split(',').map((t) => t.trim())
      } else if (key === 'size') {
        config.maxSize = parseInt(value, 10)
      } else {
        config[key] = value
      }
    }
  }

  return Object.keys(config).length > 0 ? config : null
}

async function main() {
  console.log('🚀 Starting CSV Import for Completion Forms\n')

  // Read all CSV files
  console.log('📖 Reading CSV files...')
  const forms = readCsv<CsvForm>(FORMS_CSV)
  const groups = readCsv<CsvGroup>(GROUPS_CSV)
  const questions = readCsv<CsvQuestion>(QUESTIONS_CSV)
  const answers = readCsv<CsvAnswer>(ANSWERS_CSV)

  console.log(`   Forms: ${forms.length}`)
  console.log(`   Groups: ${groups.length}`)
  console.log(`   Questions: ${questions.length}`)
  console.log(`   Answers: ${answers.length}\n`)

  // Create mappings for foreign key relationships
  const formIdMap = new Map<string, string>() // csvId -> uuid
  const groupIdMap = new Map<string, string>() // csvId -> uuid
  const questionIdMap = new Map<string, string>() // csvId -> uuid

  // Group answers by question ID
  const answersByQuestion = new Map<string, CsvAnswer[]>()
  for (const answer of answers) {
    const questionId = answer.JobTypeFormQuestionId
    if (!answersByQuestion.has(questionId)) {
      answersByQuestion.set(questionId, [])
    }
    answersByQuestion.get(questionId)!.push(answer)
  }

  try {
    // Import Forms
    console.log('📝 Importing forms...')
    for (const form of forms) {
      const uuid = generateUuid()
      formIdMap.set(form.JobTypeFormId, uuid)

      const isGlobal = true // All CSV forms are global templates
      const formTypeId = parseInt(form.FormTypeId || '1', 10)
      const isActive = formTypeId === 1 // FormTypeId 1 = completion form, 0 = edit form

      await sql`
        INSERT INTO completion_form_templates (
          id,
          organization_id,
          name,
          description,
          code,
          job_type,
          is_global,
          is_active,
          navigation_type,
          site_id,
          csv_job_type_id,
          csv_form_type_id,
          site_group_id,
          created_at,
          updated_at
        ) VALUES (
          ${uuid},
          NULL,
          ${form.Name || 'Untitled Form'},
          ${form.Description || null},
          ${form.Code || null},
          NULL,
          ${isGlobal},
          ${isActive},
          'tabs',
          ${parseInt(form.SiteId, 10) || null},
          ${parseInt(form.JobTypeId, 10) || null},
          ${formTypeId},
          ${parseInt(form.SiteGroupId, 10) || null},
          NOW(),
          NOW()
        )
      `
    }
    console.log(`   ✅ Imported ${forms.length} forms\n`)

    // Import Groups
    console.log('📝 Importing groups...')
    for (const group of groups) {
      const uuid = generateUuid()
      groupIdMap.set(group.JobTypeFormGroupId, uuid)

      const templateId = formIdMap.get(group.JobTypeFormId)
      if (!templateId) {
        console.warn(`   ⚠️  Skipping group ${group.JobTypeFormGroupId}: Template not found`)
        continue
      }

      await sql`
        INSERT INTO completion_form_template_groups (
          id,
          template_id,
          name,
          description,
          sort_order,
          is_collapsible,
          is_completion_group,
          csv_group_id,
          created_at,
          updated_at
        ) VALUES (
          ${uuid},
          ${templateId},
          ${group.Name || 'Untitled Group'},
          ${group.Description || null},
          ${parseInt(group.SortOrder, 10) || 0},
          true,
          ${group.IsCompletionGroup === '1'},
          ${parseInt(group.JobTypeFormGroupId, 10)},
          NOW(),
          NOW()
        )
      `
    }
    console.log(`   ✅ Imported ${groups.length} groups\n`)

    // Import Questions
    console.log('📝 Importing questions...')
    let importedCount = 0
    for (const question of questions) {
      const uuid = generateUuid()
      questionIdMap.set(question.JobTypeFormQuestionId, uuid)

      const templateId = formIdMap.get(question.JobTypeFormId)
      if (!templateId) {
        console.warn(`   ⚠️  Skipping question ${question.JobTypeFormQuestionId}: Template not found`)
        continue
      }

      // Find group by GroupNo (which is the CSV group ID)
      const groupId = groupIdMap.get(question.GroupNo)
      if (!groupId) {
        console.warn(`   ⚠️  Skipping question ${question.JobTypeFormQuestionId}: Group ${question.GroupNo} not found`)
        continue
      }

      // Map field type
      const fieldType = FIELD_TYPE_MAP[question.AnswerFormat] || 'text'

      // Parse config
      const config = parseConfig(question.Config)

      // Get answer options for this question
      const questionAnswers = answersByQuestion.get(question.JobTypeFormQuestionId) || []
      const answerOptions = questionAnswers.length > 0
        ? questionAnswers.map((a) => ({
            id: a.JobTypeFormAnswerId,
            text: a.Description,
            sortOrder: parseInt(a.SortOrder, 10) || 0,
            colorCode: a.ColorCodeId || null,
            actionsRequired: a.ActionsRequired || null,
          }))
        : null

      await sql`
        INSERT INTO completion_form_template_questions (
          id,
          template_id,
          group_id,
          question_text,
          placeholder,
          help_text,
          help_url,
          default_value,
          field_type,
          config,
          is_required,
          validation_message,
          validation_rules,
          sort_order,
          column_span,
          conditional_logic,
          answer_options,
          csv_question_id,
          csv_group_no,
          csv_field,
          created_at,
          updated_at
        ) VALUES (
          ${uuid},
          ${templateId},
          ${groupId},
          ${question.Description || 'Untitled Question'},
          ${question.PlaceHolder || null},
          NULL,
          ${question.HelpUrl || null},
          ${question.DefaultText || null},
          ${fieldType},
          ${JSON.stringify(config)},
          ${question.Required === '1'},
          ${question.ValidationMessage || null},
          NULL,
          ${parseInt(question.SortOrder, 10) || 0},
          1,
          NULL,
          ${answerOptions ? JSON.stringify(answerOptions) : null},
          ${parseInt(question.JobTypeFormQuestionId, 10)},
          ${parseInt(question.GroupNo, 10) || null},
          ${question.Field || null},
          NOW(),
          NOW()
        )
      `
      importedCount++
    }
    console.log(`   ✅ Imported ${importedCount} questions\n`)

    console.log('✨ Import completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   Templates: ${forms.length}`)
    console.log(`   Groups: ${groups.length}`)
    console.log(`   Questions: ${importedCount}`)
    console.log(`   Answer Options: Embedded in questions`)

  } catch (error) {
    console.error('\n❌ Import failed:', error)
    throw error
  }
}

// Run the import
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
