-- Update tc_form_id values in completion_form_templates table
-- Based on JobTypeForm.csv - match by form name
-- Run this after applying migration 0011_tiny_weapon_omega.sql

-- Only update completion forms (FormTypeId = 1), skip edit forms (FormTypeId = 0)

UPDATE completion_form_templates SET tc_form_id = 70 WHERE name = 'Rentsafe Rental Standards';
UPDATE completion_form_templates SET tc_form_id = 71 WHERE name = 'Maintenance Completion Form';
UPDATE completion_form_templates SET tc_form_id = 72 WHERE name = 'Energy Upgrade';
UPDATE completion_form_templates SET tc_form_id = 73 WHERE name = 'Smoke Alarm Service';
-- Skip 74: Job Edit - Standard (FormTypeId = 0, edit form)
UPDATE completion_form_templates SET tc_form_id = 75 WHERE name = 'Pool Compliance';
UPDATE completion_form_templates SET tc_form_id = 76 WHERE name = 'RentRepair Completion Form' AND site_id = 2232;
UPDATE completion_form_templates SET tc_form_id = 77 WHERE name = 'Property Care Group Form';
-- Skip 78: Job Property Edit - Standard (FormTypeId = 0, edit form)
UPDATE completion_form_templates SET tc_form_id = 79 WHERE name = 'RentRepair Completion Form' AND (site_id = 0 OR site_id IS NULL);
UPDATE completion_form_templates SET tc_form_id = 80 WHERE name = 'Rentsafe Inspection New';
UPDATE completion_form_templates SET tc_form_id = 81 WHERE name = 'Minimum Housing Standards Qld';
-- Skip 82: Job Wizard (FormTypeId = 0 or has job_create_wizard code)
-- Skip 83: Job Edit - Warranty (FormTypeId = 0, edit form)
UPDATE completion_form_templates SET tc_form_id = 84 WHERE name = 'Heater Service';
UPDATE completion_form_templates SET tc_form_id = 85 WHERE name = 'Minimum Rental Standards Check - Tenant';
UPDATE completion_form_templates SET tc_form_id = 88 WHERE name = 'Air Con Clean and Smoke Alarm Check';
UPDATE completion_form_templates SET tc_form_id = 89 WHERE name = 'Arlan Completion Form';
UPDATE completion_form_templates SET tc_form_id = 90 WHERE name = 'Property Audit';

-- Verify the updates
SELECT id, name, tc_form_id FROM completion_form_templates WHERE tc_form_id IS NOT NULL ORDER BY tc_form_id;
