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
  groupName?: string
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
 * Form definition returned from TC JobForm API
 */
export interface TCJobForm {
  id: number
  jobTypeFormId: number
  name: string
  description?: string
  questions: TCFormQuestion[]
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
 * Job answer item for POST request
 */
export interface TCJobAnswer {
  jobId: number
  jobTypeFormQuestionId: number
  jobTypeFormAnswerId?: number // Required for radio/dropdown
  answerText: string
  value: string
  groupNo: number
  // For file/photo fields
  file?: {
    link: string
    name: string
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
 * Full POST request body for syncing answers to TC
 */
export interface TCSyncPayload {
  jobId: number
  formGroupId: number // 0 for now
  userId: number // TC provider ID
  providerId: number // TC provider ID
  submissionTypeId: number // 0 for now
  isExternal: boolean // true - we are external system
  shouldCreatePdf: boolean // true on final submit
  shouldCompleteJob: boolean // true on final submit
  shouldSaveToQueue: boolean // true - save in progress
  jobTypeForm: TCJobTypeFormPayload
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
