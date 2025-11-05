# Completion Forms Data Structure

## Overview

The completion forms system uses a **hybrid storage approach** to give you flexibility for both performance and data portability:

1. **JSONB Storage** (fast, flexible) - `job_completion_forms.form_data`
2. **Normalized Storage** (SQL Server compatible) - `job_completion_form_answers` table

Both are populated automatically when a form is submitted.

---

## Table Structure Comparison

### Your Current SQL Server Structure

```sql
JobAnswerId          (PK)
JobId                (FK to Jobs)
JobTypeFormAnswerId  (FK to answer options)
JobTypeFormQuestionId (FK to Questions)
Value                (TEXT - the actual answer)
FileCategory
FilePath
FileRef
FileSuffix
FileName
FileSize
SubmissionTypeId
```

### New PostgreSQL Structure (Compatible)

```sql
-- job_completion_form_answers table
id                   UUID PRIMARY KEY
completion_form_id   UUID (FK to job_completion_forms)
organization_id      UUID (FK to organizations)
job_id               UUID (FK to jobs)
question_id          UUID (FK to completion_form_template_questions)
answer_id            VARCHAR(100)  -- References answer option ID
value                TEXT          -- The actual answer value
value_numeric        INTEGER       -- For numeric answers
file_category        VARCHAR(100)  -- Matches your FileCategory
file_path            VARCHAR(500)  -- Matches your FilePath
file_ref             VARCHAR(255)  -- Matches your FileRef
file_suffix          VARCHAR(50)   -- Matches your FileSuffix
file_name            VARCHAR(255)  -- Matches your FileName
file_size            INTEGER       -- Matches your FileSize
submission_type_id   INTEGER       -- Matches your SubmissionTypeId
csv_question_id      INTEGER       -- Original CSV question ID (for reference)
csv_answer_id        INTEGER       -- Original CSV answer ID (for reference)
created_at           TIMESTAMP
updated_at           TIMESTAMP
```

---

## How Data is Stored

### When a Form is Submitted:

```typescript
// Mobile app sends form data
{
  "question_uuid_1": "Yes",
  "question_uuid_2": ["Option A", "Option B"],
  "question_uuid_3": 42,
  "question_uuid_4": "file:///path/to/photo.jpg"
}
```

### Backend Stores in BOTH Formats:

#### 1. JSONB Format (job_completion_forms table)
```json
{
  "form_data": {
    "uuid-1": "Yes",
    "uuid-2": ["Option A", "Option B"],
    "uuid-3": 42,
    "uuid-4": "https://blob.vercel.app/photo.jpg"
  },
  "status": "submitted",
  "completion_date": "2025-11-06T10:30:00Z"
}
```

**Advantages:**
- Fast to read entire form at once
- Easy to display in mobile app
- Flexible for conditional logic
- No joins required

#### 2. Normalized Format (job_completion_form_answers table)
```sql
-- Row 1: Text answer
INSERT INTO job_completion_form_answers (
  completion_form_id, organization_id, job_id, question_id,
  value, created_at
) VALUES (
  'form-uuid', 'org-uuid', 'job-uuid', 'question-uuid-1',
  'Yes', NOW()
);

-- Row 2: Multi-select (multiple rows)
INSERT INTO job_completion_form_answers (
  completion_form_id, organization_id, job_id, question_id,
  value, created_at
) VALUES
  ('form-uuid', 'org-uuid', 'job-uuid', 'question-uuid-2', 'Option A', NOW()),
  ('form-uuid', 'org-uuid', 'job-uuid', 'question-uuid-2', 'Option B', NOW());

-- Row 3: Numeric answer
INSERT INTO job_completion_form_answers (
  completion_form_id, organization_id, job_id, question_id,
  value, value_numeric, created_at
) VALUES (
  'form-uuid', 'org-uuid', 'job-uuid', 'question-uuid-3',
  '42', 42, NOW()
);

-- Row 4: File upload
INSERT INTO job_completion_form_answers (
  completion_form_id, organization_id, job_id, question_id,
  value, file_path, file_name, file_size, created_at
) VALUES (
  'form-uuid', 'org-uuid', 'job-uuid', 'question-uuid-4',
  'photo.jpg', 'https://blob.vercel.app/photo.jpg', 'photo.jpg', 1024000, NOW()
);
```

**Advantages:**
- Easy to export to SQL Server
- Standard SQL queries
- Direct mapping to your existing structure
- No JSON parsing required

---

## Data Export to SQL Server

### Option 1: Direct SQL Query (Simple Export)

```sql
-- Export all answers for a specific job
SELECT
  jcfa.id as JobAnswerId,
  jcfa.job_id as JobId,
  jcfa.answer_id as JobTypeFormAnswerId,
  jcfa.question_id as JobTypeFormQuestionId,
  jcfa.value as Value,
  jcfa.file_category as FileCategory,
  jcfa.file_path as FilePath,
  jcfa.file_ref as FileRef,
  jcfa.file_suffix as FileSuffix,
  jcfa.file_name as FileName,
  jcfa.file_size as FileSize,
  jcfa.submission_type_id as SubmissionTypeId
FROM job_completion_form_answers jcfa
WHERE jcfa.job_id = 'your-job-id';
```

### Option 2: API Endpoint (Automated Sync)

We can create an API endpoint that returns data in your exact SQL Server format:

```typescript
// GET /api/jobs/:jobId/completion-form/export
{
  "JobAnswers": [
    {
      "JobAnswerId": "uuid",
      "JobId": 101018,
      "JobTypeFormAnswerId": 1513,
      "JobTypeFormQuestionId": 583,
      "Value": "Yes",
      "FileCategory": null,
      "FilePath": null,
      "FileRef": null,
      "FileSuffix": null,
      "FileName": null,
      "FileSize": 0,
      "SubmissionTypeId": 0
    },
    // ... more answers
  ]
}
```

### Option 3: Automated Sync Script

Create a scheduled job that:
1. Queries `job_completion_form_answers` for new/updated answers
2. Transforms UUIDs to integer IDs (via mapping table)
3. Inserts into SQL Server via ODBC/REST API
4. Marks as synced

---

## Field Type Mapping

| Field Type | Storage in `value` | Storage in `file_*` | Notes |
|------------|-------------------|---------------------|-------|
| text | Plain text | - | Single line text |
| textarea | Plain text | - | Multi-line text |
| number | String representation | Also in `value_numeric` | Integer or decimal |
| email | Email address | - | Validated email |
| phone | Phone number | - | Formatted phone |
| date | ISO 8601 date | - | YYYY-MM-DD |
| time | ISO 8601 time | - | HH:MM:SS |
| datetime | ISO 8601 datetime | - | YYYY-MM-DDTHH:MM:SSZ |
| dropdown | Selected option text | - | Single selection |
| radio | Selected option text | - | Single selection |
| checkbox | "true" or "false" | - | Boolean value |
| multi_checkbox | One row per selection | - | Multiple rows for same question |
| file | File URL | file_path, file_name, file_size, etc. | One row per file |
| signature | Signature image URL | file_path, file_name | Stored as image |
| rating | Number as string | Also in `value_numeric` | 1-5 stars |

---

## Question and Answer ID Mapping

### CSV to UUID Mapping

The system maintains CSV IDs for backward compatibility:

```sql
-- Get original CSV question ID for a question
SELECT
  q.id as question_uuid,
  q.csv_question_id as original_csv_id,
  q.question_text
FROM completion_form_template_questions q
WHERE q.csv_question_id = 583;

-- Get original CSV answer ID from answer_options
SELECT
  q.answer_options::jsonb as options
FROM completion_form_template_questions q
WHERE q.id = 'question-uuid';

-- Result:
{
  "answer_options": [
    {"id": "1532", "text": "Yes", "sortOrder": 1},
    {"id": "1533", "text": "No", "sortOrder": 2}
  ]
}
```

### When Exporting to SQL Server:

```sql
-- Join with template questions to get CSV IDs
SELECT
  jcfa.id,
  jcfa.job_id,
  jcfa.csv_question_id as JobTypeFormQuestionId,  -- Original CSV ID
  jcfa.csv_answer_id as JobTypeFormAnswerId,      -- Original CSV ID
  jcfa.value,
  q.question_text,
  t.name as template_name
FROM job_completion_form_answers jcfa
JOIN completion_form_template_questions q ON q.id = jcfa.question_id
JOIN completion_form_templates t ON t.id = q.template_id
WHERE jcfa.job_id = 'your-job-uuid';
```

---

## Example Queries

### Get All Answers for a Job

```sql
SELECT
  jcf.id as completion_form_id,
  jcf.status,
  jcf.completion_date,
  t.name as template_name,
  g.name as group_name,
  g.sort_order as group_order,
  q.question_text,
  q.field_type,
  q.sort_order as question_order,
  jcfa.value,
  jcfa.value_numeric,
  jcfa.file_name
FROM job_completion_forms jcf
JOIN completion_form_templates t ON t.id = jcf.template_id
JOIN job_completion_form_answers jcfa ON jcfa.completion_form_id = jcf.id
JOIN completion_form_template_questions q ON q.id = jcfa.question_id
JOIN completion_form_template_groups g ON g.id = q.group_id
WHERE jcf.job_id = 'your-job-uuid'
ORDER BY g.sort_order, q.sort_order;
```

### Get Multi-Select Answers

```sql
-- Find questions with multiple answers (multi-checkbox)
SELECT
  q.question_text,
  STRING_AGG(jcfa.value, ', ' ORDER BY jcfa.created_at) as selected_options
FROM job_completion_form_answers jcfa
JOIN completion_form_template_questions q ON q.id = jcfa.question_id
WHERE jcfa.completion_form_id = 'form-uuid'
GROUP BY jcfa.question_id, q.question_text
HAVING COUNT(*) > 1;
```

### Get File Uploads

```sql
SELECT
  q.question_text,
  jcfa.file_name,
  jcfa.file_path,
  jcfa.file_size,
  jcfa.file_suffix
FROM job_completion_form_answers jcfa
JOIN completion_form_template_questions q ON q.id = jcfa.question_id
WHERE jcfa.completion_form_id = 'form-uuid'
  AND jcfa.file_path IS NOT NULL;
```

---

## Data Sync Strategy

### Recommended Approach:

1. **Real-time Sync (Webhook)**
   - When form submitted → trigger webhook to your SQL Server API
   - POST form data in your expected format
   - Update `job_completion_forms.synced_to_legacy_system = true`

2. **Batch Sync (Scheduled)**
   - Nightly job queries unsynced forms
   - Bulk export to SQL Server
   - Mark as synced

3. **On-Demand Export**
   - API endpoint: `GET /api/jobs/:jobId/export-to-legacy`
   - Returns data in SQL Server format
   - Can be called from external systems

---

## Migration Path

### Phase 1: Dual Storage (Current)
- Both JSONB and normalized storage
- No disruption to existing systems
- Easy testing and validation

### Phase 2: Data Validation
- Compare JSONB vs normalized data
- Ensure 100% match
- Fix any discrepancies

### Phase 3: Legacy System Integration
- Build sync endpoints
- Test with subset of data
- Rollout to production

### Phase 4: Full Cutover
- All new forms sync automatically
- Legacy system becomes secondary
- This system is source of truth

---

## Benefits of This Approach

### For Your Current System:
✅ **Zero breaking changes** - Data exports in exact same format
✅ **Easy migration** - Direct SQL queries match your structure
✅ **Backward compatible** - CSV IDs preserved for reference
✅ **File handling** - Same fields for uploads (FileCategory, FilePath, etc.)

### For New System:
✅ **Fast performance** - JSONB for quick form display
✅ **Flexible storage** - Easy to add new field types
✅ **Modern features** - Conditional logic, dynamic forms
✅ **Mobile-friendly** - Optimized for mobile app

---

## Next Steps

1. **Apply Migration** - Creates both storage tables
2. **Import CSV Data** - Populates templates
3. **Test Form Submission** - Verify both storage methods work
4. **Build Export API** - Create endpoint for SQL Server format
5. **Setup Sync** - Automated or manual sync to legacy system

---

## Questions?

Common scenarios to consider:

**Q: Can I query by answer value?**
Yes, use the normalized table:
```sql
SELECT * FROM job_completion_form_answers
WHERE value = 'Yes' AND question_id = 'uuid';
```

**Q: How do I handle file uploads?**
Files stored in Vercel Blob, URLs in `file_path`:
```sql
SELECT file_path, file_name FROM job_completion_form_answers
WHERE file_path IS NOT NULL;
```

**Q: What about conditional logic?**
Stored in `completion_form_template_questions.conditional_logic` (JSONB):
```json
{
  "enabled": true,
  "rules": [
    {"question_id": "uuid", "operator": "equals", "value": "Yes"}
  ],
  "logic": "and"
}
```

**Q: Can I add custom fields later?**
Yes! Just add columns to `job_completion_form_answers` table.

---

**Last Updated:** 2025-11-06
**Status:** Ready for migration
