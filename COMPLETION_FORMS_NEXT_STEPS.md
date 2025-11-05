# Completion Forms - Next Steps ⚡

## ✅ Phase 1 Complete!

You're ready to apply the database migration and import the form templates.

---

## 🚀 Step 1: Apply Database Migration

### Option A: Via Web Dashboard (Recommended)

1. **Navigate to the migration page:**
   ```
   https://tradie-app-web.vercel.app/dashboard/migrate
   ```

2. **Click "Run Migration Now"**
   - You should see "✓ Migration Completed Successfully"
   - Look for the new completion forms tables being created
   - Any "skipped (already exists)" messages are normal

### Option B: Via Direct API Call

```bash
curl -X POST https://tradie-app-web.vercel.app/api/migrate
```

---

## 🚀 Step 2: Import Form Templates from CSV

Once the migration is successful, run the import script:

```bash
cd /Users/jasonbright/Documents/tradie-app
npx tsx scripts/import-completion-forms.ts
```

**Expected Output:**
```
🚀 Starting CSV Import for Completion Forms

📖 Reading CSV files...
   Forms: 20
   Groups: 89
   Questions: 2000+
   Answers: 1000+

📝 Importing forms...
   ✅ Imported 20 forms

📝 Importing groups...
   ✅ Imported 89 groups

📝 Importing questions...
   ✅ Imported 2000+ questions

✨ Import completed successfully!

📊 Summary:
   Templates: 20
   Groups: 89
   Questions: 2000+
   Answer Options: Embedded in questions
```

---

## 🔍 Step 3: Verify Import

Check the database to ensure data was imported correctly:

```sql
-- Count templates
SELECT COUNT(*) FROM completion_form_templates;
-- Expected: 20

-- Count groups
SELECT COUNT(*) FROM completion_form_template_groups;
-- Expected: 89

-- Count questions
SELECT COUNT(*) FROM completion_form_template_questions;
-- Expected: 2000+

-- View sample templates
SELECT id, name, description, is_active
FROM completion_form_templates
ORDER BY name
LIMIT 10;

-- View a complete form structure
SELECT
  t.name as template_name,
  g.name as group_name,
  q.question_text,
  q.field_type,
  q.is_required
FROM completion_form_templates t
JOIN completion_form_template_groups g ON g.template_id = t.id
JOIN completion_form_template_questions q ON q.group_id = g.id
WHERE t.name = 'Maintenance Completion Form'
ORDER BY g.sort_order, q.sort_order
LIMIT 20;
```

---

## 🎯 What's Next: Phase 2

Once the migration and import are complete, let me know and I'll start building:

### Backend APIs (Week 2)
1. **Template Management Endpoints**
   - `GET /api/completion-forms/templates` - List all templates
   - `GET /api/completion-forms/templates/:id` - Get template with groups and questions
   - `POST /api/completion-forms/templates` - Create custom template (future)

2. **Job Completion Form Endpoints**
   - `GET /api/jobs/:jobId/completion-form` - Get form for job
   - `POST /api/jobs/:jobId/completion-form` - Save draft
   - `PUT /api/jobs/:jobId/completion-form/submit` - Submit final
   - `POST /api/jobs/:jobId/completion-form/photos` - Upload photos
   - `POST /api/jobs/:jobId/completion-form/signatures` - Upload signatures

3. **PDF Generation**
   - Generate professional PDFs from completed forms
   - Include photos, signatures, formatted answers
   - Email to clients

---

## 📊 Form Templates Available

After import, you'll have these 20 global templates:

1. **Rentsafe Rental Standards** - Rental property inspections
2. **Maintenance Completion Form** - General maintenance work
3. **Energy Upgrade** - Energy efficiency upgrades
4. **Smoke Alarm Service** - Smoke alarm maintenance
5. **Pool Compliance** - Pool safety compliance checks
6. **RentRepair Completion Form** - Rental repair work
7. **Property Care Group Form** - Property maintenance
8. **Rentsafe Inspection New** - Updated rental inspections
9. **Minimum Housing Standards Qld** - Queensland compliance
10. **Heater Service** - Heating system maintenance
11. **Minimum Rental Standards Check - Tenant** - Tenant compliance
12. **Air Con Clean and Smoke Alarm Check** - Combined service
13. **Arlan Completion Form** - Custom completion form
14. **Property Audit** - Property and appliance audit
15. And more...

Each template includes:
- Multiple sections/groups
- 50-150+ questions per template
- Various field types (text, radio, dropdown, file upload, signature, etc.)
- Answer options for choice-based questions
- Required field validation

---

## 🐛 Troubleshooting

### Migration Fails
**Error:** `relation "completion_form_templates" already exists`
**Solution:** This is normal if you've run the migration before. The system skips existing tables.

### Import Script Fails
**Error:** `Cannot find CSV files`
**Solution:** Ensure CSV files are in `/data/completion-forms-import/`:
```bash
ls -la /Users/jasonbright/Documents/tradie-app/data/completion-forms-import/
```

**Error:** `relation "completion_form_templates" does not exist`
**Solution:** Run the migration first (Step 1) before running the import.

**Error:** `duplicate key value violates unique constraint`
**Solution:** Tables already have data. To re-import, clear tables first:
```sql
TRUNCATE TABLE completion_form_template_questions CASCADE;
TRUNCATE TABLE completion_form_template_groups CASCADE;
TRUNCATE TABLE completion_form_templates CASCADE;
```

---

## 📝 Key Implementation Notes

### Snake_case Convention
**CRITICAL:** All API data uses snake_case (not camelCase)
- Database columns: `snake_case`
- API requests: `snake_case`
- API responses: `snake_case`
- Mobile app data: `snake_case`

### Authentication Pattern
All completion form APIs will use:
- **Dual authentication:** Clerk (web) + JWT (mobile)
- **Raw Neon SQL:** NOT Drizzle ORM (to avoid build issues)
- **Middleware registration:** All routes added to `isMobileApiRoute` matcher

### Data Storage
- **Form templates:** Static, read-only for global templates
- **Form instances:** `form_data` JSONB field stores all answers
- **Photos:** Vercel Blob Storage with URLs in database
- **Signatures:** Vercel Blob Storage as images
- **PDFs:** Generated on-demand, cached in Vercel Blob

---

## 📞 Ready to Continue?

Once you've:
1. ✅ Applied the migration successfully
2. ✅ Run the CSV import successfully
3. ✅ Verified data in database

**Let me know and I'll immediately start building:**
- Backend API endpoints
- PDF generation library
- Mobile form renderer

The foundation is solid - now we build! 🚀
