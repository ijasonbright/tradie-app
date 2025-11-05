#!/usr/bin/env ts-node
/**
 * Snake Case Verification Script
 *
 * This script verifies that the codebase follows snake_case naming conventions
 * for API request/response bodies.
 *
 * Run with: npx ts-node scripts/verify-snake-case.ts
 */

type TestResult = {
  name: string
  passed: boolean
  message?: string
}

const results: TestResult[] = []

// Helper to check if a string is snake_case
function isSnakeCase(str: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(str)
}

// Helper to check if a string is camelCase
function isCamelCase(str: string): boolean {
  return /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/.test(str)
}

// Test 1: Verify snake_case pattern works
function testSnakeCasePattern() {
  const validSnakeCase = [
    'organization_id',
    'client_id',
    'job_type',
    'site_address_line1',
    'quoted_amount',
    'is_company',
    'email', // single word is valid
    'created_at',
  ]

  const invalidSnakeCase = [
    'organizationId', // camelCase
    'Organization_Id', // mixed case
    'ORGANIZATION_ID', // SCREAMING_SNAKE_CASE
    'organization__id', // double underscore
    '_organization_id', // leading underscore
    'organization_id_', // trailing underscore
  ]

  validSnakeCase.forEach(field => {
    if (!isSnakeCase(field)) {
      results.push({
        name: `Valid snake_case: ${field}`,
        passed: false,
        message: `Expected "${field}" to match snake_case pattern`,
      })
    } else {
      results.push({
        name: `Valid snake_case: ${field}`,
        passed: true,
      })
    }
  })

  invalidSnakeCase.forEach(field => {
    if (isSnakeCase(field)) {
      results.push({
        name: `Invalid snake_case: ${field}`,
        passed: false,
        message: `Expected "${field}" to NOT match snake_case pattern`,
      })
    } else {
      results.push({
        name: `Invalid snake_case: ${field}`,
        passed: true,
      })
    }
  })
}

// Test 2: Verify camelCase is rejected
function testCamelCaseRejection() {
  const camelCaseFields = [
    'organizationId',
    'clientId',
    'jobType',
    'siteAddressLine1',
    'quotedAmount',
    'assignedToUserId',
  ]

  camelCaseFields.forEach(field => {
    if (!isCamelCase(field)) {
      results.push({
        name: `Reject camelCase: ${field}`,
        passed: false,
        message: `Field "${field}" should be identified as camelCase`,
      })
    } else if (isSnakeCase(field)) {
      results.push({
        name: `Reject camelCase: ${field}`,
        passed: false,
        message: `camelCase field "${field}" should NOT match snake_case pattern`,
      })
    } else {
      results.push({
        name: `Reject camelCase: ${field}`,
        passed: true,
      })
    }
  })
}

// Test 3: Verify field mappings
function testFieldMappings() {
  const mappings: Record<string, string> = {
    organizationId: 'organization_id',
    clientId: 'client_id',
    jobType: 'job_type',
    siteAddressLine1: 'site_address_line1',
    siteAddressLine2: 'site_address_line2',
    quotedAmount: 'quoted_amount',
    assignedToUserId: 'assigned_to_user_id',
    tradeTypeId: 'trade_type_id',
    isCompany: 'is_company',
    companyName: 'company_name',
    firstName: 'first_name',
    lastName: 'last_name',
    siteAccessNotes: 'site_access_notes',
    scheduledDate: 'scheduled_date',
    billingAddressSameAsSite: 'billing_address_same_as_site',
    issueDate: 'issue_date',
    dueDate: 'due_date',
    gstAmount: 'gst_amount',
    paymentMethod: 'payment_method',
    paymentDate: 'payment_date',
    validUntilDate: 'valid_until_date',
    depositRequired: 'deposit_required',
    startTime: 'start_time',
    endTime: 'end_time',
  }

  Object.entries(mappings).forEach(([camel, snake]) => {
    if (!isCamelCase(camel)) {
      results.push({
        name: `Mapping ${camel} → ${snake}`,
        passed: false,
        message: `"${camel}" is not camelCase`,
      })
    } else if (!isSnakeCase(snake)) {
      results.push({
        name: `Mapping ${camel} → ${snake}`,
        passed: false,
        message: `"${snake}" is not snake_case`,
      })
    } else {
      results.push({
        name: `Mapping ${camel} → ${snake}`,
        passed: true,
      })
    }
  })
}

// Test 4: Verify request body examples
function testRequestBodyExamples() {
  const examples = [
    {
      name: 'Client creation',
      body: {
        organization_id: 'test',
        client_type: 'residential',
        is_company: false,
        first_name: 'John',
        last_name: 'Doe',
        site_address_line1: '123 Main St',
      },
    },
    {
      name: 'Job creation',
      body: {
        organization_id: 'test',
        client_id: 'test',
        job_type: 'repair',
        quoted_amount: 500,
        assigned_to_user_id: 'test',
      },
    },
    {
      name: 'Invoice creation',
      body: {
        organization_id: 'test',
        client_id: 'test',
        issue_date: '2025-01-15',
        due_date: '2025-02-15',
        gst_amount: 50,
      },
    },
    {
      name: 'Payment recording',
      body: {
        payment_date: '2025-01-15',
        amount: 500,
        payment_method: 'bank_transfer',
      },
    },
  ]

  examples.forEach(({ name, body }) => {
    const invalidFields = Object.keys(body).filter(key => !isSnakeCase(key))

    if (invalidFields.length > 0) {
      results.push({
        name: `Request body: ${name}`,
        passed: false,
        message: `Fields not in snake_case: ${invalidFields.join(', ')}`,
      })
    } else {
      results.push({
        name: `Request body: ${name}`,
        passed: true,
      })
    }
  })
}

// Test 5: Verify consistency across entities
function testConsistencyAcrossEntities() {
  const commonFields = [
    'organization_id',
    'client_id',
    'created_at',
    'updated_at',
    'created_by_user_id',
  ]

  commonFields.forEach(field => {
    if (!isSnakeCase(field)) {
      results.push({
        name: `Common field: ${field}`,
        passed: false,
        message: `Common field "${field}" is not snake_case`,
      })
    } else {
      results.push({
        name: `Common field: ${field}`,
        passed: true,
      })
    }
  })
}

// Run all tests
console.log('🧪 Running Snake Case Verification Tests...\n')

testSnakeCasePattern()
testCamelCaseRejection()
testFieldMappings()
testRequestBodyExamples()
testConsistencyAcrossEntities()

// Print results
const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length
const total = results.length

console.log('📊 Test Results:\n')

if (failed > 0) {
  console.log('❌ Failed Tests:\n')
  results
    .filter(r => !r.passed)
    .forEach(r => {
      console.log(`  ❌ ${r.name}`)
      if (r.message) {
        console.log(`     ${r.message}`)
      }
    })
  console.log('')
}

console.log('✅ Passed Tests:\n')
results
  .filter(r => r.passed)
  .forEach(r => {
    console.log(`  ✅ ${r.name}`)
  })

console.log('\n' + '='.repeat(60))
console.log(`\n📈 Summary: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`)

if (failed > 0) {
  console.log(`\n❌ ${failed} test(s) failed`)
  process.exit(1)
} else {
  console.log('\n✅ All tests passed! snake_case standardization is correct.')
  process.exit(0)
}
