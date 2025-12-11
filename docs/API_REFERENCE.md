# Tradie App API Reference

This document describes the Tradie App REST API for external integrations, including Zapier, TradieConnect, and custom applications.

## Base URL

```
Production: https://tradie-app-web.vercel.app/api/v1
```

---

## Authentication

All API requests require authentication using an API key.

### API Key Format

```
Authorization: Bearer ta_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Or for TradieConnect integrations:
```
Authorization: Bearer tc_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Obtaining an API Key

1. Log in to the Tradie App web dashboard
2. Navigate to **Settings → Developer → API Keys**
3. Click **Create New API Key**
4. Select the key type and permissions
5. **Save the key immediately** - it will only be shown once

### Key Types

| Type | Prefix | Description |
|------|--------|-------------|
| `standard` | `ta_` | Full access API key for general integrations |
| `tradieconnect` | `tc_api_` | TradieConnect-specific integration key |
| `zapier` | `ta_` | Zapier automation key with full access |
| `readonly` | `ta_` | Read-only access to data |

### Permissions

API keys can have granular permissions:

| Permission | Description |
|------------|-------------|
| `*` | Full access to all resources |
| `jobs.read` | Read job data |
| `jobs.write` | Create and update jobs |
| `clients.read` | Read client data |
| `clients.write` | Create and update clients |
| `invoices.read` | Read invoice data |
| `invoices.write` | Create and update invoices |
| `quotes.read` | Read quote data |
| `quotes.write` | Create and update quotes |
| `completion_forms.read` | Read completion form data |
| `completion_forms.write` | Submit completion forms |

---

## Rate Limits

- **100 requests per minute** per API key
- **1,000 requests per hour** per API key

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

If you exceed the rate limit, you'll receive a `429 Too Many Requests` response.

---

## Response Format

All responses are JSON. Successful responses include the requested data:

```json
{
  "jobs": [...],
  "count": 10,
  "limit": 50,
  "offset": 0
}
```

Error responses include an error message:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired API key"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Missing required permission |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Endpoints

### Jobs

#### List Jobs

```
GET /api/v1/jobs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `quoted`, `scheduled`, `in_progress`, `completed`, `invoiced`, `cancelled` |
| `client_id` | uuid | Filter by client |
| `assigned_to` | uuid | Filter by assigned team member |
| `limit` | integer | Results per page (max 100, default 50) |
| `offset` | integer | Pagination offset |

**Response:**

```json
{
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "job_number": "JOB-2025-0001",
      "title": "Fix leaking tap",
      "description": "Kitchen tap is dripping",
      "job_type": "repair",
      "status": "scheduled",
      "priority": "medium",
      "site_address": {
        "line1": "123 Main Street",
        "line2": null,
        "city": "Sydney",
        "state": "NSW",
        "postcode": "2000"
      },
      "quoted_amount": "150.00",
      "actual_amount": null,
      "scheduled_date": "2025-01-20",
      "scheduled_start_time": "09:00:00",
      "scheduled_end_time": "11:00:00",
      "completed_at": null,
      "client": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "John Smith",
        "email": "john@example.com",
        "phone": "+61400000000"
      },
      "assigned_to": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "Mike Technician"
      },
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

#### Create Job

```
POST /api/v1/jobs
```

**Request Body:**

```json
{
  "title": "Fix leaking tap",
  "description": "Kitchen tap is dripping",
  "client_id": "660e8400-e29b-41d4-a716-446655440001",
  "job_type": "repair",
  "status": "scheduled",
  "priority": "medium",
  "site_address": {
    "line1": "123 Main Street",
    "city": "Sydney",
    "state": "NSW",
    "postcode": "2000"
  },
  "quoted_amount": "150.00",
  "scheduled_date": "2025-01-20",
  "scheduled_start_time": "09:00:00",
  "scheduled_end_time": "11:00:00"
}
```

**Required Fields:** `title`

**Response:** `201 Created`

```json
{
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "job_number": "JOB-2025-0001",
    ...
  },
  "message": "Job created successfully"
}
```

---

### Clients

#### List Clients

```
GET /api/v1/clients
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `client_type` | string | Filter by type: `residential`, `commercial` |
| `search` | string | Search by name, email, or phone |
| `limit` | integer | Results per page (max 100, default 50) |
| `offset` | integer | Pagination offset |

**Response:**

```json
{
  "clients": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "client_type": "residential",
      "is_company": false,
      "company_name": null,
      "first_name": "John",
      "last_name": "Smith",
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+61400000000",
      "mobile": "+61400000000",
      "site_address": {
        "line1": "123 Main Street",
        "city": "Sydney",
        "state": "NSW",
        "postcode": "2000"
      },
      "billing_address": null,
      "abn": null,
      "notes": "Prefers morning appointments",
      "preferred_contact_method": "email",
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

#### Create Client

```
POST /api/v1/clients
```

**Request Body:**

```json
{
  "client_type": "residential",
  "first_name": "John",
  "last_name": "Smith",
  "email": "john@example.com",
  "phone": "+61400000000",
  "site_address": {
    "line1": "123 Main Street",
    "city": "Sydney",
    "state": "NSW",
    "postcode": "2000"
  },
  "preferred_contact_method": "email"
}
```

**Required Fields:** Either `email` or `phone`, and either `company_name` or both `first_name` and `last_name`

**Response:** `201 Created`

---

## Webhooks

Webhooks allow you to receive real-time notifications when events occur in Tradie App.

### Webhook Event Types

| Event | Description |
|-------|-------------|
| `job.created` | A new job was created |
| `job.updated` | A job was updated |
| `job.completed` | A job was marked as completed |
| `job.status_changed` | A job's status changed |
| `job.assigned` | A job was assigned to a team member |
| `job.deleted` | A job was deleted |
| `client.created` | A new client was created |
| `client.updated` | A client was updated |
| `client.deleted` | A client was deleted |
| `invoice.created` | A new invoice was created |
| `invoice.sent` | An invoice was sent to the client |
| `invoice.paid` | An invoice was paid in full |
| `invoice.partially_paid` | A partial payment was received |
| `invoice.overdue` | An invoice became overdue |
| `invoice.deleted` | An invoice was deleted |
| `quote.created` | A new quote was created |
| `quote.sent` | A quote was sent to the client |
| `quote.accepted` | A quote was accepted |
| `quote.rejected` | A quote was rejected |
| `quote.expired` | A quote expired |
| `quote.deleted` | A quote was deleted |
| `appointment.created` | An appointment was created |
| `appointment.updated` | An appointment was updated |
| `appointment.cancelled` | An appointment was cancelled |
| `completion_form.submitted` | A completion form was submitted |
| `completion_form.updated` | A completion form was updated |
| `payment.received` | A payment was received |
| `sms.received` | An SMS was received from a client |
| `sms.sent` | An SMS was sent to a client |

### Webhook Payload Format

```json
{
  "event_type": "job.created",
  "event_id": "evt_xxxxxxxxxxxxxxxxxxxx",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "job_id": "660e8400-e29b-41d4-a716-446655440001",
    "job_number": "JOB-2025-0001",
    "title": "Fix leaking tap",
    ...
  }
}
```

### Webhook Signature Verification

Webhooks include an HMAC signature for verification:

```
X-Webhook-Signature: sha256=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
X-Webhook-Event: job.created
X-Webhook-Event-ID: evt_xxxxxxxxxxxxxxxxxxxx
X-Webhook-Timestamp: 2025-01-15T10:30:00.000Z
```

**Verification (Node.js example):**

```javascript
const crypto = require('crypto')

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return `sha256=${expectedSignature}` === signature
}

// In your webhook handler:
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature']
  const payload = JSON.stringify(req.body)

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }

  // Process the webhook...
  console.log('Received:', req.body.event_type)
  res.status(200).send('OK')
})
```

### Managing Webhooks

#### List Webhook Subscriptions

```
GET /api/developer/webhooks
```

**Response:**

```json
{
  "webhooks": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "subscription_id": "whsub_xxxxxxxxxxxx",
      "name": "Job notifications",
      "event_type": "job.created",
      "target_url": "https://your-app.com/webhooks",
      "is_active": true,
      "last_triggered_at": "2025-01-15T10:00:00.000Z",
      "trigger_count": 42,
      "failure_count": 0,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "available_event_types": ["job.created", "job.updated", ...]
}
```

#### Create Webhook Subscription

```
POST /api/developer/webhooks
```

**Request Body:**

```json
{
  "name": "Job notifications",
  "event_type": "job.created",
  "target_url": "https://your-app.com/webhooks",
  "filters": {
    "status": ["completed", "invoiced"]
  },
  "headers": {
    "X-Custom-Header": "value"
  },
  "max_retries": 3,
  "generate_secret": true
}
```

**Response:** `201 Created`

```json
{
  "webhook": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "subscription_id": "whsub_xxxxxxxxxxxx",
    "name": "Job notifications",
    "event_type": "job.created",
    "target_url": "https://your-app.com/webhooks",
    "secret_key": "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  },
  "message": "Webhook created successfully. Save the secret_key now - it will not be shown again."
}
```

#### Test Webhook

```
POST /api/developer/webhooks/:id/test
```

Sends a test payload to your webhook endpoint to verify it's working correctly.

#### Update Webhook

```
PUT /api/developer/webhooks/:id
```

**Request Body:**

```json
{
  "name": "Updated name",
  "target_url": "https://new-url.com/webhooks",
  "is_active": false
}
```

#### Delete Webhook

```
DELETE /api/developer/webhooks/:id
```

---

## API Key Management

### List API Keys

```
GET /api/developer/api-keys
```

**Response:**

```json
{
  "api_keys": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "name": "Production Key",
      "key_prefix": "ta_abc12345...",
      "key_type": "standard",
      "permissions": ["*"],
      "is_active": true,
      "last_used_at": "2025-01-15T10:00:00.000Z",
      "usage_count": 1234,
      "rate_limit_per_minute": 100,
      "rate_limit_per_hour": 1000,
      "expires_at": null,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Create API Key

```
POST /api/developer/api-keys
```

**Request Body:**

```json
{
  "name": "Production Key",
  "key_type": "standard",
  "permissions": ["jobs.read", "jobs.write", "clients.read"],
  "expires_in_days": 365
}
```

**Response:** `201 Created`

```json
{
  "api_key": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "name": "Production Key",
    "key_prefix": "ta_abc12345...",
    "key_type": "standard",
    "permissions": ["jobs.read", "jobs.write", "clients.read"],
    "key": "ta_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  },
  "message": "API key created successfully. Save this key now - it will not be shown again."
}
```

### Update API Key

```
PUT /api/developer/api-keys/:id
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "is_active": false,
  "permissions": ["jobs.read"]
}
```

### Delete API Key

```
DELETE /api/developer/api-keys/:id
```

---

## TradieConnect Integration

For TradieConnect-specific integrations, see [TRADIECONNECT_COMPLETION_FORM_API.md](./TRADIECONNECT_COMPLETION_FORM_API.md) for completion form data retrieval.

### TradieConnect API Key

Create a TradieConnect-specific API key:

```json
{
  "name": "TradieConnect Integration",
  "key_type": "tradieconnect",
  "permissions": ["completion_forms.read", "completion_forms.write", "jobs.read"]
}
```

This will generate a key with the `tc_api_` prefix.

---

## Code Examples

### cURL

```bash
# List jobs
curl -X GET \
  "https://tradie-app-web.vercel.app/api/v1/jobs?status=scheduled&limit=10" \
  -H "Authorization: Bearer ta_your_api_key_here"

# Create a job
curl -X POST \
  "https://tradie-app-web.vercel.app/api/v1/jobs" \
  -H "Authorization: Bearer ta_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix leaking tap",
    "client_id": "660e8400-e29b-41d4-a716-446655440001",
    "job_type": "repair",
    "scheduled_date": "2025-01-20"
  }'
```

### JavaScript/Node.js

```javascript
const API_KEY = 'ta_your_api_key_here'
const BASE_URL = 'https://tradie-app-web.vercel.app/api/v1'

async function listJobs() {
  const response = await fetch(`${BASE_URL}/jobs?status=scheduled`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  return response.json()
}

async function createJob(jobData) {
  const response = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(jobData)
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  return response.json()
}
```

### Python

```python
import requests

API_KEY = 'ta_your_api_key_here'
BASE_URL = 'https://tradie-app-web.vercel.app/api/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# List jobs
response = requests.get(f'{BASE_URL}/jobs?status=scheduled', headers=headers)
jobs = response.json()

# Create a job
job_data = {
    'title': 'Fix leaking tap',
    'client_id': '660e8400-e29b-41d4-a716-446655440001',
    'job_type': 'repair',
    'scheduled_date': '2025-01-20'
}
response = requests.post(f'{BASE_URL}/jobs', headers=headers, json=job_data)
new_job = response.json()
```

### C# (.NET)

```csharp
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

public class TradieAppClient
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "https://tradie-app-web.vercel.app/api/v1";

    public TradieAppClient(string apiKey)
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", apiKey);
    }

    public async Task<JobListResponse> ListJobsAsync(string status = null)
    {
        var url = $"{BaseUrl}/jobs";
        if (!string.IsNullOrEmpty(status))
        {
            url += $"?status={status}";
        }

        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<JobListResponse>(json);
    }

    public async Task<CreateJobResponse> CreateJobAsync(CreateJobRequest request)
    {
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync($"{BaseUrl}/jobs", content);
        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<CreateJobResponse>(responseJson);
    }
}
```

---

## Support

For API issues or questions:
- Email: support@tradieapp.com
- GitHub: https://github.com/anthropics/claude-code/issues

---

## Changelog

### 2025-01-15
- Initial API release
- Jobs, Clients endpoints
- Webhook system with 30+ event types
- API key management

