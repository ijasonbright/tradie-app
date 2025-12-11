# TradieConnect Completion Form API Integration

This document describes how TradieConnect can retrieve completion form answers from Tradie App for syncing back to the TradieConnect database.

## Authentication

TradieConnect authenticates using an **API Key** passed in the `Authorization` header.

### API Key Format
```
Authorization: Bearer tc_api_<your_api_key>
```

### Obtaining an API Key
Contact the Tradie App administrator to generate a TradieConnect integration API key. This key:
- Is organization-specific
- Has read access to completion form data
- Should be stored securely and never exposed in client-side code

---

## API Endpoint

### Get Completion Form Answers for a TC Job

Retrieves all answers for a completion form associated with a TradieConnect job, with `csv_question_id` for mapping back to TradieConnect's database.

```
GET https://tradie-app-web.vercel.app/api/integrations/tradieconnect/jobs/{tcJobId}/completion-form/answers
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tcJobId` | string | The TradieConnect Job ID (e.g., "283294") |

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer tc_api_<your_api_key>` | Yes |
| `Content-Type` | `application/json` | No |

---

## Response Format

### Success Response (200 OK)

```json
{
  "tc_job_id": "283294",
  "tc_job_code": "JOB-283294",
  "form_id": "550e8400-e29b-41d4-a716-446655440000",
  "form_status": "submitted",
  "template_id": "660e8400-e29b-41d4-a716-446655440001",
  "template_name": "Rentsafe Inspection New",
  "completed_at": "2025-01-15T10:30:00.000Z",
  "created_at": "2025-01-15T09:00:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z",
  "answer_count": 25,
  "answers": [
    {
      "csv_question_id": 583,
      "question_id": "770e8400-e29b-41d4-a716-446655440002",
      "question_text": "Was the smoke alarm tested?",
      "field_type": "radio",
      "value": "yes",
      "display_value": "Yes",
      "group_number": 1,
      "group_name": "Safety Checks",
      "group_sort_order": 1,
      "question_sort_order": 1
    },
    {
      "csv_question_id": 584,
      "question_id": "770e8400-e29b-41d4-a716-446655440003",
      "question_text": "Additional Notes",
      "field_type": "textarea",
      "value": "All smoke alarms tested and working correctly.",
      "display_value": "All smoke alarms tested and working correctly.",
      "group_number": 1,
      "group_name": "Safety Checks",
      "group_sort_order": 1,
      "question_sort_order": 2
    },
    {
      "csv_question_id": 590,
      "question_id": "770e8400-e29b-41d4-a716-446655440004",
      "question_text": "Upload photos of smoke alarms",
      "field_type": "file",
      "value": [
        "https://abc123.public.blob.vercel-storage.com/completion-forms/org-id/tc-jobs/283294/1702300000000-photo1.jpg",
        "https://abc123.public.blob.vercel-storage.com/completion-forms/org-id/tc-jobs/283294/1702300001000-photo2.jpg"
      ],
      "display_value": [
        "https://abc123.public.blob.vercel-storage.com/completion-forms/org-id/tc-jobs/283294/1702300000000-photo1.jpg",
        "https://abc123.public.blob.vercel-storage.com/completion-forms/org-id/tc-jobs/283294/1702300001000-photo2.jpg"
      ],
      "group_number": 2,
      "group_name": "Photo Evidence",
      "group_sort_order": 2,
      "question_sort_order": 1,
      "photo_count": 2,
      "photos": [
        {
          "url": "https://abc123.public.blob.vercel-storage.com/completion-forms/org-id/tc-jobs/283294/1702300000000-photo1.jpg",
          "caption": "",
          "photo_type": "completion_form",
          "uploaded_at": "2025-01-15T10:25:00.000Z",
          "uploaded_by": "John Smith"
        },
        {
          "url": "https://abc123.public.blob.vercel-storage.com/completion-forms/org-id/tc-jobs/283294/1702300001000-photo2.jpg",
          "caption": "",
          "photo_type": "completion_form",
          "uploaded_at": "2025-01-15T10:26:00.000Z",
          "uploaded_by": "John Smith"
        }
      ]
    }
  ]
}
```

### Response Fields

#### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `tc_job_id` | string | TradieConnect Job ID |
| `tc_job_code` | string | TradieConnect Job Code |
| `form_id` | string (UUID) | Tradie App's internal form ID |
| `form_status` | string | `"draft"` or `"submitted"` |
| `template_id` | string (UUID) | Completion form template ID |
| `template_name` | string | Name of the form template |
| `completed_at` | string (ISO 8601) | When the form was marked complete (null if draft) |
| `created_at` | string (ISO 8601) | When the form was first created |
| `updated_at` | string (ISO 8601) | When the form was last updated |
| `answer_count` | number | Total number of answered questions |
| `answers` | array | Array of answer objects |

#### Answer Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `csv_question_id` | number | **TradieConnect's JobTypeFormQuestionId** - use this to map answers back |
| `question_id` | string (UUID) | Tradie App's internal question ID |
| `question_text` | string | The question text |
| `field_type` | string | Question type: `text`, `textarea`, `number`, `radio`, `dropdown`, `checkbox`, `multi_checkbox`, `date`, `file` |
| `value` | any | The raw answer value |
| `display_value` | any | Human-readable answer (e.g., option text instead of option ID) |
| `group_number` | number | **TradieConnect's GroupNo** - the original CSV group number |
| `group_name` | string | Name of the question group/section |
| `group_sort_order` | number | Sort order of the group |
| `question_sort_order` | number | Sort order of the question within its group |

#### Photo Fields (for `field_type: "file"` only)

| Field | Type | Description |
|-------|------|-------------|
| `photo_count` | number | Number of photos uploaded |
| `photos` | array | Array of photo metadata objects |
| `photos[].url` | string | Direct URL to the image (publicly accessible) |
| `photos[].caption` | string | Photo caption (may be empty) |
| `photos[].photo_type` | string | Type classification |
| `photos[].uploaded_at` | string (ISO 8601) | When the photo was uploaded |
| `photos[].uploaded_by` | string | Name of the user who uploaded it |

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
API key is missing, invalid, or expired.

### 404 Not Found
```json
{
  "error": "Completion form not found for this TC job",
  "tc_job_id": "283294"
}
```
No completion form exists for this TC job ID, or the form belongs to a different organization.

### 500 Internal Server Error
```json
{
  "error": "Failed to get completion form answers"
}
```
Server error - contact support.

---

## Example Usage

### cURL
```bash
curl -X GET \
  "https://tradie-app-web.vercel.app/api/integrations/tradieconnect/jobs/283294/completion-form/answers" \
  -H "Authorization: Bearer tc_api_your_api_key_here" \
  -H "Content-Type: application/json"
```

### C# (.NET)
```csharp
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

public class TradieAppClient
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "https://tradie-app-web.vercel.app/api/integrations/tradieconnect";

    public TradieAppClient(string apiKey)
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", apiKey);
    }

    public async Task<CompletionFormAnswersResponse> GetCompletionFormAnswersAsync(string tcJobId)
    {
        var response = await _httpClient.GetAsync($"{BaseUrl}/jobs/{tcJobId}/completion-form/answers");
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<CompletionFormAnswersResponse>(json);
    }
}

// Response models
public class CompletionFormAnswersResponse
{
    public string TcJobId { get; set; }
    public string TcJobCode { get; set; }
    public string FormStatus { get; set; }
    public string TemplateName { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int AnswerCount { get; set; }
    public List<AnswerItem> Answers { get; set; }
}

public class AnswerItem
{
    public int CsvQuestionId { get; set; }  // Maps to JobTypeFormQuestionId
    public string QuestionText { get; set; }
    public string FieldType { get; set; }
    public object Value { get; set; }
    public object DisplayValue { get; set; }
    public int GroupNumber { get; set; }    // Maps to GroupNo
    public string GroupName { get; set; }
    public int? PhotoCount { get; set; }
    public List<PhotoItem> Photos { get; set; }
}

public class PhotoItem
{
    public string Url { get; set; }
    public string Caption { get; set; }
    public DateTime UploadedAt { get; set; }
    public string UploadedBy { get; set; }
}
```

### SQL Server Integration Example
```csharp
// After fetching answers from the API, insert into TradieConnect database
public async Task SyncAnswersToDatabase(string tcJobId)
{
    var answers = await _tradieAppClient.GetCompletionFormAnswersAsync(tcJobId);

    foreach (var answer in answers.Answers)
    {
        // Use csv_question_id to map to JobTypeFormQuestionId
        await _db.ExecuteAsync(@"
            INSERT INTO JobTypeFormAnswers (JobId, JobTypeFormQuestionId, Answer, GroupNo, AnsweredAt)
            VALUES (@JobId, @QuestionId, @Answer, @GroupNo, @AnsweredAt)
            ON DUPLICATE KEY UPDATE Answer = @Answer, AnsweredAt = @AnsweredAt",
            new {
                JobId = int.Parse(tcJobId),
                QuestionId = answer.CsvQuestionId,  // This is the original JobTypeFormQuestionId
                Answer = answer.DisplayValue?.ToString() ?? answer.Value?.ToString(),
                GroupNo = answer.GroupNumber,
                AnsweredAt = answers.CompletedAt ?? DateTime.UtcNow
            });

        // Handle photos separately if needed
        if (answer.FieldType == "file" && answer.Photos != null)
        {
            foreach (var photo in answer.Photos)
            {
                await _db.ExecuteAsync(@"
                    INSERT INTO JobPhotos (JobId, QuestionId, PhotoUrl, UploadedAt, UploadedBy)
                    VALUES (@JobId, @QuestionId, @PhotoUrl, @UploadedAt, @UploadedBy)",
                    new {
                        JobId = int.Parse(tcJobId),
                        QuestionId = answer.CsvQuestionId,
                        PhotoUrl = photo.Url,
                        UploadedAt = photo.UploadedAt,
                        UploadedBy = photo.UploadedBy
                    });
            }
        }
    }
}
```

---

## Polling vs Webhooks

### Current: Polling
TradieConnect can poll this endpoint periodically to check for form updates:
- Check `form_status` for `"submitted"` to know when a form is complete
- Compare `updated_at` to detect changes

### Future: Webhooks (Coming Soon)
A webhook system can be implemented where Tradie App pushes form submissions to TradieConnect automatically when:
- A form is submitted
- A form is updated

Contact us if you need webhook integration.

---

## Rate Limits

- **100 requests per minute** per API key
- **1000 requests per hour** per API key

If you exceed these limits, you'll receive a `429 Too Many Requests` response.

---

## Support

For API issues or to request an API key, contact:
- Email: support@tradieapp.com
- Technical issues: Create a GitHub issue at https://github.com/anthropics/claude-code/issues
