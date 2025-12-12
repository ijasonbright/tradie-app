/**
 * TradieConnect Form API Types
 *
 * Types for fetching form definitions from TC and posting answers back.
 * Used by the dynamic form sync feature.
 */

// ==================== TC Form Definition Types (GET /api/v2/JobForm/{jobId}) ====================

/**
 * Answer option for radio/dropdown questions
 */
export interface TCFormAnswerOption {
  jobTypeFormAnswerId: number
  description: string
  sortOrder?: number
}

/**
 * Question in the TC form definition
 */
export interface TCFormQuestion {
  jobTypeFormQuestionId: number
  description: string
  answerFormat: string // textbox, textarea, radioboxlist, dropdown, file, iscompliant, checkbox
  groupNo: number
  groupName?: string | null
  sortOrder: number
  required: boolean
  answers: TCFormAnswerOption[]
  // Additional fields that may be present
  value?: string
  fieldValue?: string
  hint?: string
  maxLength?: number
}

/**
 * Group definition in the TC form (from groups array)
 */
export interface TCFormGroup {
  jobTypeFormGroupId: number
  name: string
  sortOrder: number
}

/**
 * Form definition returned from TC JobForm API
 */
export interface TCJobForm {
  id: number
  jobTypeFormId: number
  name: string
  description?: string
  questions: TCFormQuestion[]
  groups: TCFormGroup[] // Groups array with proper names and sort order
  // Additional metadata
  jobId?: number
  jobTypeId?: number
  jobTypeName?: string
}

// ==================== TC Form Sync Types (POST /api/v2/JobForm) ====================

/**
 * Question with answer value for POST request
 */
export interface TCFormQuestionWithAnswer extends TCFormQuestion {
  value: string
  fieldValue: string
}

/**
 * Answer entry within a question's answers array for POST request
 * Based on TC API docs: each question has an answers array with the submitted values
 */
export interface TCQuestionAnswer {
  submissionTypeId?: number
  jobTypeFormQuestionId: number
  jobTypeFormGroupId?: number
  jobTypeFormAnswerId: number // Required for radio/dropdown/iscompliant, 0 for textbox/textarea
  description?: string
  question?: string
  value: string // The actual answer value
  answerFormat?: string
  groupNo: number
  groupName?: string
  // File fields
  filePath?: string
  fileRef?: string
  fileSize?: number
  fileSuffix?: string
  fileName?: string
}

/**
 * Job answer item for jobAnswers array in POST request
 * TC API uses jobTypeFormGroupId (same as groupNo)
 */
export interface TCJobAnswer {
  jobId: number
  jobAnswerId?: number
  jobTypeFormQuestionId: number
  jobTypeFormAnswerId: number // 0 for textbox/textarea, actual ID for radio/dropdown
  jobTypeFormGroupId?: number // TC uses this (same value as groupNo)
  questionText?: string
  answerText?: string
  answerFormat?: string
  groupNo: number
  groupName?: string
  value: string
  // For file/photo fields
  file?: {
    name: string
    suffix?: string
    link: string
    size?: number
    path?: string
  }
}

/**
 * Form payload for POST request body
 */
export interface TCJobTypeFormPayload {
  id: number
  jobTypeFormId: number
  name: string
  questions: TCFormQuestionWithAnswer[]
  jobAnswers: TCJobAnswer[]
}

/**
 * Question with answers for POST request
 * Based on TC API: each question contains an answers array with the submitted values
 * TC API expects jobTypeFormGroupId (not just groupNo)
 */
export interface TCQuestionWithAnswers {
  jobTypeFormQuestionId: number
  jobTypeFormGroupId?: number // TC API uses this field (same value as groupNo)
  description?: string
  answerFormat: string
  groupNo: number
  groupName?: string
  sortOrder?: number
  required?: boolean
  value?: string
  fieldValue?: string
  answers: TCQuestionAnswer[] // The submitted answer(s) for this question
}

/**
 * Full POST request body for syncing answers to TC
 * Based on TC API docs for POST /api/v2/JobForm
 */
export interface TCSyncPayload {
  jobId: number
  formGroupId: number // 0 = entire form, or specific groupNo for single section
  userId: number // TC provider ID
  providerId: number // TC provider ID
  submissionTypeId: number // 0 for now
  shouldCreatePdf: boolean // true on final submit
  completeJob: boolean // NOTE: API uses "completeJob" not "shouldCompleteJob"
  shouldSaveToQueue: boolean // true - save in progress
  jobTypeForm: {
    id: number
    jobTypeFormId: number
    name: string
    questions: TCQuestionWithAnswers[]
    jobAnswers: TCJobAnswer[]
  }
}

// ==================== Our Internal Types (for transforming TC format to our format) ====================

/**
 * Answer option in our format (matching completion_form_template_questions.answer_options)
 */
export interface OurAnswerOption {
  id: string
  text: string
  tc_answer_id?: number // Original TC answer ID for syncing back
}

/**
 * Question in our format (matching our DB schema)
 */
export interface OurFormQuestion {
  id: string // UUID format
  question_text: string
  field_type: string // text, textarea, radio, dropdown, file, checkbox
  csv_question_id: number // Maps to TC's jobTypeFormQuestionId
  csv_group_id: number // Maps to TC's groupNo
  group_name?: string
  sort_order: number
  required: boolean
  answer_options?: OurAnswerOption[]
  hint?: string
}

/**
 * Group in our format
 */
export interface OurFormGroup {
  id: string
  name: string
  csv_group_id: number
  sort_order: number
  questions: OurFormQuestion[]
}

/**
 * Form definition in our format (matching what our mobile app expects)
 */
export interface OurFormDefinition {
  template_id: string
  template_name: string
  tc_form_id: number // Original TC form ID
  tc_job_id: number
  groups: OurFormGroup[]
  // Metadata for syncing
  _tc_raw?: TCJobForm // Store original TC response for building sync payload
}

// ==================== Sync Request/Response Types ====================

/**
 * Request body for our sync-answers endpoint
 */
export interface SyncAnswersRequest {
  answers: Record<string, any> // { "question_uuid": "answer_value", ... }
  photo_urls?: Record<string, string[]> // { "question_uuid": ["url1", "url2"], ... }
  group_no?: number // Optional: sync only this group/page
  is_complete: boolean // If true, will set shouldCompleteJob and shouldCreatePdf
}

/**
 * Response from our sync-answers endpoint
 */
export interface SyncAnswersResponse {
  success: boolean
  tc_response?: any // Raw TC response
  error?: string
  details?: string
}

/**
 * Response from our form-definition endpoint
 */
export interface FormDefinitionResponse {
  success: boolean
  form?: OurFormDefinition
  error?: string
  cached?: boolean // Whether this was served from cache
  cached_at?: string // When it was cached
}
