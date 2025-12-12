/**
 * TradieConnect Form API Utilities
 *
 * Functions for fetching form definitions from TC and posting answers back.
 * This is a parallel system for testing dynamic form sync.
 */

import { tradieConnectApiRequest } from '../tradieconnect'
import {
  TCJobForm,
  TCFormQuestion,
  TCFormGroup,
  TCFormAnswerOption,
  TCSyncPayload,
  TCJobAnswer,
  TCFormQuestionWithAnswer,
  OurFormDefinition,
  OurFormGroup,
  OurFormQuestion,
  OurAnswerOption,
} from './types'

// ==================== Fetch Form Definition ====================

/**
 * Fetches the form definition from TradieConnect for a specific job
 *
 * @param tcJobId - The TradieConnect job ID
 * @param tcUserId - The TC user GUID for auth
 * @param tcToken - The TC access token
 */
export async function fetchTCFormDefinition(
  tcJobId: string | number,
  tcUserId: string,
  tcToken: string
): Promise<{
  success: boolean
  form?: TCJobForm
  error?: string
  unauthorized?: boolean
}> {
  try {
    const response = await tradieConnectApiRequest(
      `/api/v2/JobForm/${tcJobId}`,
      tcUserId,
      tcToken,
      { method: 'GET' }
    )

    if (response.ok) {
      const form = await response.json()
      return { success: true, form }
    }

    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    const errorText = await response.text()
    return { success: false, error: `Failed to fetch form: ${response.status} - ${errorText}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ==================== Transform TC Format to Our Format ====================

/**
 * Maps TC answer format to our field type
 */
function mapAnswerFormatToFieldType(answerFormat: string): string {
  const mapping: Record<string, string> = {
    textbox: 'text',
    textarea: 'textarea',
    radioboxlist: 'radio',
    dropdown: 'dropdown',
    file: 'file',
    iscompliant: 'radio', // Treat as radio with Yes/No options
    checkbox: 'checkbox',
  }
  return mapping[answerFormat.toLowerCase()] || 'text'
}

/**
 * Transforms a TC form definition to our format for rendering
 */
export function transformTCFormToOurFormat(
  tcForm: TCJobForm,
  tcJobId: number
): OurFormDefinition {
  // Build a map from groupNo (jobTypeFormGroupId) to group details
  // This uses the 'groups' array from the TC response for proper names and sort order
  const groupInfoMap = new Map<number, { name: string; sortOrder: number }>()

  if (tcForm.groups && tcForm.groups.length > 0) {
    for (const group of tcForm.groups) {
      groupInfoMap.set(group.jobTypeFormGroupId, {
        name: group.name,
        sortOrder: group.sortOrder,
      })
    }
  }

  // Group questions by groupNo
  const questionsMap = new Map<number, TCFormQuestion[]>()

  for (const question of tcForm.questions) {
    const groupNo = question.groupNo
    if (!questionsMap.has(groupNo)) {
      questionsMap.set(groupNo, [])
    }
    questionsMap.get(groupNo)!.push(question)
  }

  // Convert to our format using group info from the groups array
  const groups: OurFormGroup[] = []

  // Get all group IDs and sort by the sortOrder from the groups array
  const groupIds = Array.from(questionsMap.keys())
  groupIds.sort((a, b) => {
    const aInfo = groupInfoMap.get(a)
    const bInfo = groupInfoMap.get(b)
    // Use sortOrder from groups array if available, otherwise use groupNo
    const aSortOrder = aInfo?.sortOrder ?? a
    const bSortOrder = bInfo?.sortOrder ?? b
    return aSortOrder - bSortOrder
  })

  for (const groupNo of groupIds) {
    const questions = questionsMap.get(groupNo)!
    const groupInfo = groupInfoMap.get(groupNo)

    // Get group name from groups array, or fallback to question.groupName, or generic name
    const groupName = groupInfo?.name || questions[0]?.groupName || `Section ${groupNo}`
    const groupSortOrder = groupInfo?.sortOrder ?? groups.length

    // Sort questions within group by sortOrder
    const sortedQuestions = questions.sort((a, b) => a.sortOrder - b.sortOrder)

    const ourQuestions: OurFormQuestion[] = sortedQuestions.map((q, idx) => {
      // Map answer options
      const answerOptions: OurAnswerOption[] | undefined = q.answers?.length > 0
        ? q.answers.map((opt: TCFormAnswerOption) => ({
            id: String(opt.jobTypeFormAnswerId), // Use TC answer ID as our option ID
            text: opt.description,
            tc_answer_id: opt.jobTypeFormAnswerId,
          }))
        : undefined

      return {
        id: `tc_q_${q.jobTypeFormQuestionId}`, // Generate deterministic ID from TC question ID
        question_text: q.description,
        field_type: mapAnswerFormatToFieldType(q.answerFormat),
        csv_question_id: q.jobTypeFormQuestionId,
        csv_group_id: q.groupNo,
        group_name: groupName,
        sort_order: idx,
        required: q.required,
        answer_options: answerOptions,
        hint: q.hint,
      }
    })

    groups.push({
      id: `tc_g_${groupNo}`,
      name: groupName,
      csv_group_id: groupNo,
      sort_order: groupSortOrder,
      questions: ourQuestions,
    })
  }

  // Re-sort groups by their sort_order to ensure correct final order
  groups.sort((a, b) => a.sort_order - b.sort_order)

  return {
    template_id: `tc_form_${tcForm.jobTypeFormId}`,
    template_name: tcForm.name,
    tc_form_id: tcForm.jobTypeFormId,
    tc_job_id: tcJobId,
    groups,
    _tc_raw: tcForm, // Store original for building sync payload
  }
}

// ==================== Build Sync Payload ====================

/**
 * Builds the TC POST payload from our answers and the original form definition
 *
 * @param params - Parameters for building the payload
 */
export function buildTCSyncPayload(params: {
  tcJobId: number
  tcFormDefinition: TCJobForm
  answers: Record<string, any> // Our format: { "tc_q_2474": "Yes", ... }
  photoUrls?: Record<string, string[]> // { "tc_q_1234": ["url1", "url2"], ... }
  groupNo?: number // If syncing specific page
  userId: number // TC provider ID
  providerId: number // TC provider ID
  isComplete: boolean
}): TCSyncPayload {
  const {
    tcJobId,
    tcFormDefinition,
    answers,
    photoUrls,
    groupNo,
    userId,
    providerId,
    isComplete,
  } = params

  // Filter questions if groupNo is specified
  const questions = groupNo !== undefined
    ? tcFormDefinition.questions.filter(q => q.groupNo === groupNo)
    : tcFormDefinition.questions

  // Build questions array with answer values
  const questionsWithAnswers: TCFormQuestionWithAnswer[] = []
  const jobAnswers: TCJobAnswer[] = []

  for (const q of questions) {
    const questionKey = `tc_q_${q.jobTypeFormQuestionId}`
    const answerValue = answers[questionKey]

    // Skip if no answer provided
    if (answerValue === undefined || answerValue === null || answerValue === '') {
      continue
    }

    // For photos, check if we have URLs
    const photos = photoUrls?.[questionKey]

    // Build question with answer
    const questionWithAnswer: TCFormQuestionWithAnswer = {
      ...q,
      value: String(answerValue),
      fieldValue: String(answerValue),
    }
    questionsWithAnswers.push(questionWithAnswer)

    // Build job answer
    const jobAnswer: TCJobAnswer = {
      jobId: tcJobId,
      jobTypeFormQuestionId: q.jobTypeFormQuestionId,
      answerText: String(answerValue),
      value: String(answerValue),
      groupNo: q.groupNo,
    }

    // For radio/dropdown, look up the answer option ID
    if ((q.answerFormat === 'radioboxlist' || q.answerFormat === 'dropdown' || q.answerFormat === 'iscompliant') && q.answers?.length > 0) {
      const matchedOption = q.answers.find(
        (opt: TCFormAnswerOption) =>
          opt.description.toLowerCase() === String(answerValue).toLowerCase() ||
          String(opt.jobTypeFormAnswerId) === String(answerValue)
      )
      if (matchedOption) {
        jobAnswer.jobTypeFormAnswerId = matchedOption.jobTypeFormAnswerId
        // Ensure we use the option's description as the value
        jobAnswer.answerText = matchedOption.description
        jobAnswer.value = matchedOption.description
      }
    }

    // For file fields, add photo URLs
    if (q.answerFormat === 'file' && photos && photos.length > 0) {
      // TC expects a single file object, so we'll use the first photo
      // In the future, we may need to handle multiple photos differently
      const photoUrl = photos[0]
      const fileName = photoUrl.split('/').pop() || 'photo.jpg'
      jobAnswer.file = {
        link: photoUrl,
        name: fileName,
      }
    }

    jobAnswers.push(jobAnswer)
  }

  return {
    jobId: tcJobId,
    formGroupId: 0, // Always 0 for now (test and adjust if needed)
    userId: userId,
    providerId: providerId,
    submissionTypeId: 0, // Always 0 for now (test and adjust if needed)
    isExternal: true, // We are an external system
    shouldCreatePdf: isComplete, // Only on final submit
    shouldCompleteJob: isComplete, // Only on final submit
    shouldSaveToQueue: true, // Always save to queue
    jobTypeForm: {
      id: tcFormDefinition.jobTypeFormId,
      jobTypeFormId: tcFormDefinition.jobTypeFormId,
      name: tcFormDefinition.name,
      questions: questionsWithAnswers,
      jobAnswers: jobAnswers,
    },
  }
}

// ==================== Sync Answers to TC ====================

/**
 * Posts answers to TradieConnect
 *
 * @param payload - The sync payload built by buildTCSyncPayload
 * @param tcUserId - The TC user GUID for auth
 * @param tcToken - The TC access token
 */
export async function syncAnswersToTC(
  payload: TCSyncPayload,
  tcUserId: string,
  tcToken: string
): Promise<{
  success: boolean
  response?: any
  error?: string
  unauthorized?: boolean
}> {
  try {
    console.log('Syncing answers to TC:', {
      jobId: payload.jobId,
      questionCount: payload.jobTypeForm.questions.length,
      answerCount: payload.jobTypeForm.jobAnswers.length,
      isComplete: payload.shouldCompleteJob,
    })

    const response = await tradieConnectApiRequest(
      `/api/v2/JobForm`,
      tcUserId,
      tcToken,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )

    if (response.ok) {
      const data = await response.json()
      console.log('TC sync successful:', data)
      return { success: true, response: data }
    }

    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    const errorText = await response.text()
    console.error('TC sync failed:', response.status, errorText)
    return { success: false, error: `Failed to sync answers: ${response.status} - ${errorText}` }
  } catch (error) {
    console.error('TC sync exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ==================== Helper: Get TC Credentials from DB ====================

/**
 * Helper type for TC credentials from user record
 */
export interface TCCredentials {
  tc_user_id: string
  tc_token: string
  tc_refresh_token: string | null
  tc_provider_id: number | null
}

/**
 * Extracts TC credentials from a user record
 * (Decryption should happen before calling this)
 */
export function extractTCCredentials(user: {
  tc_user_id?: string | null
  tc_token?: string | null
  tc_refresh_token?: string | null
  tc_provider_id?: number | null
}): TCCredentials | null {
  if (!user.tc_user_id || !user.tc_token) {
    return null
  }

  return {
    tc_user_id: user.tc_user_id,
    tc_token: user.tc_token,
    tc_refresh_token: user.tc_refresh_token || null,
    tc_provider_id: user.tc_provider_id || null,
  }
}
