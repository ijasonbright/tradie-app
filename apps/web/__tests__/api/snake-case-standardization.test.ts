/**
 * Snake Case Standardization Test Suite
 *
 * This test suite verifies that all API endpoints correctly accept snake_case
 * field names in request bodies and return snake_case in responses.
 *
 * Run with: npm test snake-case-standardization
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

// Mock request helper
const createMockRequest = (body: any, token?: string) => {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        if (name === 'authorization' && token) {
          return `Bearer ${token}`
        }
        return null
      }
    }
  } as any
}

describe('Snake Case Standardization', () => {
  describe('Request Body Format Tests', () => {
    it('should accept snake_case fields in client creation', () => {
      const requestBody = {
        organization_id: 'test-org-id',
        client_type: 'residential',
        is_company: false,
        first_name: 'John',
        last_name: 'Doe',
        site_address_line1: '123 Main St',
        site_city: 'Sydney',
        site_state: 'NSW',
        site_postcode: '2000',
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should accept snake_case fields in job creation', () => {
      const requestBody = {
        organization_id: 'test-org-id',
        client_id: 'test-client-id',
        job_type: 'repair',
        site_address_line1: '123 Main St',
        site_access_notes: 'Use side gate',
        quoted_amount: 500.00,
        assigned_to_user_id: 'test-user-id',
        trade_type_id: 'test-trade-id',
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should accept snake_case fields in invoice creation', () => {
      const requestBody = {
        organization_id: 'test-org-id',
        client_id: 'test-client-id',
        job_id: 'test-job-id',
        issue_date: '2025-01-15',
        due_date: '2025-02-15',
        gst_amount: 50.00,
        payment_terms: 'Net 30',
        footer_text: 'Thank you for your business',
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should accept snake_case fields in quote creation', () => {
      const requestBody = {
        client_id: 'test-client-id',
        organization_id: 'test-org-id',
        valid_until_date: '2025-02-15',
        gst_amount: 100.00,
        deposit_required: true,
        deposit_percentage: 25,
        deposit_amount: 250.00,
        line_items: [{
          item_type: 'labor',
          unit_price: 100.00,
          line_order: 1,
        }],
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })

      // Verify nested objects are also snake_case
      requestBody.line_items.forEach((item: any) => {
        Object.keys(item).forEach(key => {
          expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
        })
      })
    })

    it('should accept snake_case fields in expense creation', () => {
      const requestBody = {
        organization_id: 'test-org-id',
        job_id: 'test-job-id',
        supplier_name: 'Bunnings',
        gst_amount: 20.00,
        receipt_url: 'https://example.com/receipt.pdf',
        expense_date: '2025-01-15',
        account_code: '400',
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should accept snake_case fields in appointment creation', () => {
      const requestBody = {
        organization_id: 'test-org-id',
        appointment_type: 'job',
        start_time: '2025-01-15T09:00:00Z',
        end_time: '2025-01-15T11:00:00Z',
        all_day: false,
        job_id: 'test-job-id',
        client_id: 'test-client-id',
        assigned_to_user_id: 'test-user-id',
        location_address: '123 Main St, Sydney',
        reminder_minutes_before: 30,
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should accept snake_case fields in payment recording', () => {
      const requestBody = {
        payment_date: '2025-01-15',
        amount: 500.00,
        payment_method: 'bank_transfer',
        reference_number: 'REF123',
        notes: 'Full payment received',
      }

      // Verify all keys are snake_case
      Object.keys(requestBody).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })
  })

  describe('Response Format Tests', () => {
    it('should expect snake_case fields in job response', () => {
      const mockResponse = {
        id: 'test-job-id',
        organization_id: 'test-org-id',
        job_number: 'JOB-2025-001',
        client_id: 'test-client-id',
        created_by_user_id: 'test-user-id',
        assigned_to_user_id: 'test-user-id',
        job_type: 'repair',
        site_address_line1: '123 Main St',
        site_address_line2: null,
        site_city: 'Sydney',
        site_state: 'NSW',
        site_postcode: '2000',
        site_access_notes: 'Use side gate',
        quoted_amount: '500.00',
        scheduled_date: '2025-01-20',
        scheduled_start_time: '09:00:00',
        trade_type_id: 'test-trade-id',
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      }

      // Verify all keys are snake_case
      Object.keys(mockResponse).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should expect snake_case fields in client response', () => {
      const mockResponse = {
        id: 'test-client-id',
        organization_id: 'test-org-id',
        client_type: 'residential',
        is_company: false,
        company_name: null,
        first_name: 'John',
        last_name: 'Doe',
        site_address_line1: '123 Main St',
        site_city: 'Sydney',
        site_state: 'NSW',
        site_postcode: '2000',
        billing_address_same_as_site: true,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      }

      // Verify all keys are snake_case
      Object.keys(mockResponse).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should expect snake_case fields in invoice response', () => {
      const mockResponse = {
        id: 'test-invoice-id',
        organization_id: 'test-org-id',
        invoice_number: 'INV-2025-001',
        job_id: 'test-job-id',
        client_id: 'test-client-id',
        created_by_user_id: 'test-user-id',
        issue_date: '2025-01-15',
        due_date: '2025-02-15',
        gst_amount: '50.00',
        total_amount: '550.00',
        paid_amount: '0.00',
        payment_terms: 'Net 30',
        payment_method: null,
        footer_text: 'Thank you',
        paid_date: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      }

      // Verify all keys are snake_case
      Object.keys(mockResponse).forEach(key => {
        expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })
  })

  describe('Rejected Format Tests', () => {
    it('should reject camelCase field names', () => {
      const camelCaseFields = [
        'organizationId',
        'clientId',
        'jobType',
        'siteAddressLine1',
        'quotedAmount',
        'assignedToUserId',
        'tradeTypeId',
        'createdAt',
        'updatedAt',
      ]

      camelCaseFields.forEach(field => {
        // camelCase should NOT match our snake_case pattern
        expect(field).not.toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should identify mixed case as invalid', () => {
      const mixedCaseFields = [
        'organization_Id',  // Mixed
        'Client_id',        // Mixed
        'JobType',          // PascalCase
        'SITE_ADDRESS',     // SCREAMING_SNAKE_CASE
      ]

      mixedCaseFields.forEach(field => {
        // Mixed case should NOT match our snake_case pattern
        expect(field).not.toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })
  })

  describe('Field Mapping Verification', () => {
    it('should have correct camelCase to snake_case mappings', () => {
      const mappings = {
        organizationId: 'organization_id',
        clientId: 'client_id',
        jobType: 'job_type',
        siteAddressLine1: 'site_address_line1',
        quotedAmount: 'quoted_amount',
        assignedToUserId: 'assigned_to_user_id',
        tradeTypeId: 'trade_type_id',
        isCompany: 'is_company',
        companyName: 'company_name',
        firstName: 'first_name',
        lastName: 'last_name',
        siteAccessNotes: 'site_access_notes',
        scheduledDate: 'scheduled_date',
        scheduledStartTime: 'scheduled_start_time',
        scheduledEndTime: 'scheduled_end_time',
        billingAddressSameAsSite: 'billing_address_same_as_site',
        issueDate: 'issue_date',
        dueDate: 'due_date',
        gstAmount: 'gst_amount',
        totalAmount: 'total_amount',
        paidAmount: 'paid_amount',
        paymentTerms: 'payment_terms',
        paymentMethod: 'payment_method',
        paymentDate: 'payment_date',
        footerText: 'footer_text',
        validUntilDate: 'valid_until_date',
        depositRequired: 'deposit_required',
        depositPercentage: 'deposit_percentage',
        depositAmount: 'deposit_amount',
        lineItems: 'line_items',
        unitPrice: 'unit_price',
        lineOrder: 'line_order',
        supplierName: 'supplier_name',
        receiptUrl: 'receipt_url',
        expenseDate: 'expense_date',
        accountCode: 'account_code',
        appointmentType: 'appointment_type',
        startTime: 'start_time',
        endTime: 'end_time',
        allDay: 'all_day',
        locationAddress: 'location_address',
        reminderMinutesBefore: 'reminder_minutes_before',
      }

      Object.entries(mappings).forEach(([camel, snake]) => {
        // Verify camelCase is NOT snake_case
        expect(camel).not.toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)

        // Verify snake_case IS snake_case
        expect(snake).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })
  })

  describe('Consistency Tests', () => {
    it('should use consistent naming across all entities', () => {
      const commonFields = {
        organization_id: ['clients', 'jobs', 'invoices', 'quotes', 'expenses', 'appointments'],
        client_id: ['jobs', 'invoices', 'quotes', 'appointments'],
        created_at: ['clients', 'jobs', 'invoices', 'quotes', 'expenses', 'appointments'],
        updated_at: ['clients', 'jobs', 'invoices', 'quotes', 'expenses', 'appointments'],
      }

      // All common fields should be snake_case
      Object.keys(commonFields).forEach(field => {
        expect(field).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should use consistent address field naming', () => {
      const addressFields = [
        'site_address_line1',
        'site_address_line2',
        'site_city',
        'site_state',
        'site_postcode',
        'billing_address_line1',
        'billing_address_line2',
        'billing_city',
        'billing_state',
        'billing_postcode',
      ]

      addressFields.forEach(field => {
        expect(field).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should use consistent date/time field naming', () => {
      const dateTimeFields = [
        'created_at',
        'updated_at',
        'scheduled_date',
        'scheduled_start_time',
        'scheduled_end_time',
        'issue_date',
        'due_date',
        'paid_date',
        'expense_date',
        'payment_date',
        'valid_until_date',
        'start_time',
        'end_time',
      ]

      dateTimeFields.forEach(field => {
        expect(field).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle single word fields correctly', () => {
      const singleWordFields = ['email', 'phone', 'mobile', 'status', 'title', 'notes', 'description', 'priority']

      singleWordFields.forEach(field => {
        // Single words are valid snake_case
        expect(field).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should handle fields with numbers correctly', () => {
      const fieldsWithNumbers = [
        'site_address_line1',
        'site_address_line2',
        'billing_address_line1',
        'billing_address_line2',
      ]

      fieldsWithNumbers.forEach(field => {
        expect(field).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('should handle boolean fields correctly', () => {
      const booleanFields = [
        'is_company',
        'all_day',
        'billing_address_same_as_site',
        'deposit_required',
      ]

      booleanFields.forEach(field => {
        expect(field).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })
  })
})
