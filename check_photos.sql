-- Check if there are any job photos for this job
SELECT COUNT(*) as total_photos FROM job_photos WHERE job_id = '0f1facdb-b4cb-4ad7-8861-c291dd23c2a8';

-- Check the form_data to see if it has photo references
SELECT form_data FROM job_completion_forms WHERE job_id = '0f1facdb-b4cb-4ad7-8861-c291dd23c2a8';
