# Phase 3: Core Job Management - Testing Checklist

## Overview
This document contains all the features built in Phase 3 and how to test them.

---

## 1. Live Timer Feature ⏱️

### What Was Built:
- Clock In/Out buttons on job detail page
- Real-time running timer display (HH:MM:SS)
- Automatic time calculation
- Break duration tracking
- Notes for work sessions

### How to Test:

**Start Timer:**
1. Go to any job: `/dashboard/jobs/[job-id]`
2. Click the blue **"Clock In - Start Timer"** button
3. ✅ Should see green timer widget appear with pulsing dot
4. ✅ Timer should start counting up in real-time

**Running Timer:**
1. While timer is running:
   - ✅ Timer updates every second
   - ✅ Shows in HH:MM:SS format
   - ✅ Green background indicates active
2. Refresh the page
   - ✅ Timer should continue from where it was (persisted)

**Stop Timer:**
1. Click red **"Clock Out"** button
2. Modal appears with:
   - Current elapsed time
   - Break duration field (optional)
   - Notes field (optional)
3. Enter break time (e.g., 30 minutes for lunch)
4. Add notes (e.g., "Installed new fixtures")
5. Click **"Stop Timer"**
6. ✅ Timer should disappear
7. ✅ Time log should appear in "Time" tab
8. ✅ Total hours should reflect: (elapsed time - break)/60

**Edge Cases to Test:**
- ❌ Try starting timer twice → Should show error "already have active timer"
- ✅ Start timer, close browser, reopen → Timer should still be running
- ✅ Stop timer with 0 break minutes → Should work fine
- ✅ Stop timer with notes → Notes should appear in time log

### API Endpoints Created:
- `POST /api/jobs/[id]/start-timer` - Start timer
- `POST /api/jobs/[id]/stop-timer` - Stop timer with break/notes
- `GET /api/jobs/[id]/active-timer` - Check for active timer

---

## 2. Job Completion Workflow ✅

### What Was Built:
- Complete Job button with validation
- Checks for pending approvals
- Warning system for unapproved items
- Create Invoice button (appears after completion)
- Status badge updates

### How to Test:

**Complete a Job (Clean Path):**
1. Go to a job with all time/materials approved
2. Click green **"Complete Job"** button
3. Confirm the dialog
4. ✅ Job status should change to "completed"
5. ✅ Status badge should show green "completed"
6. ✅ "Create Invoice" button should appear

**Complete with Pending Approvals:**
1. Add time log or material (will be "pending")
2. Click **"Complete Job"**
3. ✅ Should complete but show warning message:
   - "X time log(s) pending approval"
   - "X material(s) pending approval"
4. Job should still complete successfully

**After Completion:**
1. ✅ "Complete Job" button should disappear
2. ✅ Purple "Create Invoice" button should appear
3. Click "Create Invoice"
4. ✅ Should redirect to invoice creation with job pre-filled

**Permissions Test:**
- Test as Employee with `can_edit_all_jobs = false`
- ✅ Should show error "Not authorized to complete this job"

### API Endpoint Created:
- `POST /api/jobs/[id]/complete` - Mark job as completed

---

## 3. Existing Features (Already Built)

### Time Tracking (Manual Entry):
**Location:** Job Detail → Time Tab
1. Click **"Add Time Log"**
2. Enter start/end time manually
3. Enter break duration
4. Add notes
5. Submit
6. ✅ Time log appears with "pending" status
7. ✅ Total hours calculated correctly

**Approval (Owner/Admin only):**
1. Go to time log with "pending" status
2. Click **"Approve"** or **"Reject"**
3. ✅ Status should update
4. ✅ Approved logs count toward total cost

### Materials Tracking:
**Location:** Job Detail → Materials Tab
1. Click **"Add Material"**
2. Fill in:
   - Type (product/part/equipment)
   - Description
   - Supplier
   - Quantity & Unit Price
3. Submit
4. ✅ Total cost calculated automatically
5. ✅ Material appears with "pending" status

**Approval:**
1. Click **"Approve"** or **"Reject"**
2. ✅ Approved materials add to total cost

### Job Photos:
**Location:** Job Detail → Photos Tab
1. Click **"Upload Photo"**
2. Select image file
3. Add caption (optional)
4. Select type (before/during/after/issue/completion)
5. Submit
6. ✅ Photo appears in gallery
7. ✅ Shows caption and upload date

**View Photos:**
1. Click on any photo
2. ✅ Should display full size (basic view for now)

### Notes:
**Location:** Job Detail → Notes Tab
1. Click **"Add Note"**
2. Enter note text
3. Select type (general/issue/client_request/internal)
4. Submit
5. ✅ Note appears with timestamp and author
6. ✅ Notes sorted by date (newest first)

---

## 4. Integration Testing

### Full Workflow Test:
1. **Create Job**
   - Go to Jobs → New Job
   - Fill in all details
   - Assign to yourself or team member

2. **Work on Job**
   - Clock in (start timer)
   - Take "before" photo
   - Add material used
   - Let timer run for a few minutes
   - Take "during" photo
   - Clock out (add break time + notes)

3. **Review Work**
   - Check Time tab → Approve time log (if admin)
   - Check Materials tab → Approve materials
   - Check Photos tab → Verify all photos
   - Add final note

4. **Complete Job**
   - Click "Complete Job"
   - Verify status changes
   - Click "Create Invoice"

5. **Verify Costs**
   - Labor Cost = (hours - break) × hourly rate
   - Materials Cost = sum of approved materials
   - Total Cost = Labor + Materials

---

## 5. Known Limitations / Future Enhancements

### Photo Gallery:
- ❌ No lightbox (opens in basic view)
- ❌ No before/after comparison view
- ✅ **Future**: Add image modal with zoom, swipe, etc.

### Materials:
- ❌ No receipt photo upload yet
- ✅ **Future**: Add receipt photo to materials

### Timer:
- ✅ Works perfectly for single user
- ❌ No team view (can't see who's clocked in)
- ✅ **Future**: Dashboard widget showing active timers

### Invoicing:
- ❌ Invoice creation not yet built (Phase 5)
- ✅ Button is there, ready for Phase 5

---

## 6. Testing Checklist Summary

### Critical Tests ⭐
- [ ] Start timer → Shows running timer
- [ ] Stop timer → Creates time log with correct hours
- [ ] Complete job → Status changes to completed
- [ ] Approve time log → Adds to total cost
- [ ] Approve material → Adds to total cost
- [ ] Upload photo → Appears in gallery

### Permission Tests
- [ ] Employee can clock in/out on assigned jobs
- [ ] Employee cannot complete jobs (without permission)
- [ ] Owner/Admin can approve time logs
- [ ] Owner/Admin can approve materials
- [ ] Owner/Admin can complete jobs

### Data Integrity Tests
- [ ] Timer survives page refresh
- [ ] Break time correctly deducted from total
- [ ] Hourly rate captured at time of clock-in
- [ ] Materials total = quantity × unit price
- [ ] Job total cost = labor + materials

### UI/UX Tests
- [ ] Timer is visible and prominent
- [ ] Complete button shows only for incomplete jobs
- [ ] Create Invoice button shows only after completion
- [ ] All tabs load data correctly
- [ ] Mobile responsive (test on phone)

---

## 7. Deployment Notes

### Environment Variables Needed:
- `DATABASE_URL` - Already set ✅
- `CLERK_SECRET_KEY` - Already set ✅
- All existing vars remain the same

### Database:
- No new migrations needed ✅
- Uses existing `job_time_logs` table
- Uses existing `jobs` table

### API Routes Created:
```
/api/jobs/[id]/start-timer     (POST)
/api/jobs/[id]/stop-timer      (POST)
/api/jobs/[id]/active-timer    (GET)
/api/jobs/[id]/complete        (POST)
```

---

## 8. What to Test First

### Priority Order:
1. **Timer Feature** (most important)
   - Start/stop timer on a test job
   - Verify time calculation

2. **Job Completion**
   - Complete a job
   - Check status updates

3. **Approval Workflows**
   - Approve time logs
   - Approve materials

4. **Full Workflow**
   - Do complete start-to-finish job
   - Verify all data flows correctly

---

## Need Help?

If you encounter any issues:
1. Check browser console for errors
2. Check Vercel logs for API errors
3. Verify user has correct permissions
4. Check database for data consistency

**Happy Testing! 🚀**
