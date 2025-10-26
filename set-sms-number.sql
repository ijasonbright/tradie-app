-- Update all organizations to use the Tall Bob sending number
UPDATE organizations
SET sms_phone_number = '+61409757940'
WHERE sms_phone_number IS NULL OR sms_phone_number = '';

-- Verify the update
SELECT id, name, sms_phone_number, sms_credits
FROM organizations;
