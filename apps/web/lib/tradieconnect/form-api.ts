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
  TCQuestionAnswer,
  TCQuestionWithAnswers,
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
 * Based on TC API docs:
 * - Each question should have a groupNo matching formGroupId
 * - Questions have an 'answers' array containing the submitted answer(s)
 * - For radio/dropdown/iscompliant, answers need JobTypeFormAnswerId
 * - For textbox/textarea, JobTypeFormAnswerId can be 0
 * - jobAnswers array also contains the answers in a different format
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
  const questionsToProcess = groupNo !== undefined
    ? tcFormDefinition.questions.filter(q => q.groupNo === groupNo)
    : tcFormDefinition.questions

  // Build questions array - include ALL questions for the group, with answers for those we have
  const questionsWithAnswers: TCQuestionWithAnswers[] = []
  const jobAnswers: TCJobAnswer[] = []

  for (const q of questionsToProcess) {
    const questionKey = `tc_q_${q.jobTypeFormQuestionId}`
    const answerValue = answers[questionKey]

    // For photos, check if we have URLs
    const photos = photoUrls?.[questionKey]

    // Determine the answer ID and value
    let jobTypeFormAnswerId = 0 // Default for textbox/textarea
    let finalValue = answerValue !== undefined && answerValue !== null ? String(answerValue) : ''

    // For radio/dropdown/iscompliant, look up the answer option ID
    if ((q.answerFormat === 'radioboxlist' || q.answerFormat === 'dropdown' || q.answerFormat === 'iscompliant' || q.answerFormat === 'checkboxlist') && q.answers?.length > 0 && finalValue) {
      const matchedOption = q.answers.find(
        (opt: TCFormAnswerOption) =>
          opt.description.toLowerCase() === String(answerValue).toLowerCase() ||
          String(opt.jobTypeFormAnswerId) === String(answerValue)
      )
      if (matchedOption) {
        jobTypeFormAnswerId = matchedOption.jobTypeFormAnswerId
        finalValue = matchedOption.description
      }
    }

    // Build the answer entry for the question's answers array
    const questionAnswer: TCQuestionAnswer = {
      jobTypeFormQuestionId: q.jobTypeFormQuestionId,
      jobTypeFormAnswerId: jobTypeFormAnswerId,
      value: finalValue,
      answerFormat: q.answerFormat,
      groupNo: q.groupNo,
    }

    // For file fields, add photo path
    if (q.answerFormat === 'file' && photos && photos.length > 0) {
      questionAnswer.filePath = photos[0]
      const fileName = photos[0].split('/').pop() || 'photo.jpg'
      questionAnswer.fileName = fileName
      questionAnswer.value = photos[0] // For files, value is the URL
    }

    // Build question with nested answers array - ALWAYS include the question
    const questionWithAnswers: TCQuestionWithAnswers = {
      jobTypeFormQuestionId: q.jobTypeFormQuestionId,
      description: q.description,
      answerFormat: q.answerFormat,
      groupNo: q.groupNo,
      sortOrder: q.sortOrder,
      required: q.required,
      value: finalValue,
      fieldValue: finalValue,
      answers: finalValue ? [questionAnswer] : [], // Only include answer if we have a value
    }
    questionsWithAnswers.push(questionWithAnswers)

    // Only add to jobAnswers if we have a value
    if (finalValue) {
      const jobAnswer: TCJobAnswer = {
        jobId: tcJobId,
        jobTypeFormQuestionId: q.jobTypeFormQuestionId,
        jobTypeFormAnswerId: jobTypeFormAnswerId, // 0 for textbox/textarea, actual ID for radio/dropdown
        questionText: q.description,
        answerText: finalValue,
        answerFormat: q.answerFormat,
        groupNo: q.groupNo,
        value: finalValue,
      }

      // For file fields, add file object
      if (q.answerFormat === 'file' && photos && photos.length > 0) {
        const photoUrl = photos[0]
        const fileName = photoUrl.split('/').pop() || 'photo.jpg'
        const suffix = fileName.split('.').pop() || 'jpg'
        jobAnswer.file = {
          link: photoUrl,
          name: fileName,
          suffix: suffix,
        }
        jobAnswer.value = photoUrl
      }

      jobAnswers.push(jobAnswer)
    }
  }

  return {
    jobId: tcJobId,
    formGroupId: groupNo ?? 0, // 0 = entire form, or specific groupNo for single section
    userId: userId,
    providerId: providerId,
    submissionTypeId: 0,
    shouldCreatePdf: isComplete,
    completeJob: isComplete, // API uses "completeJob" not "shouldCompleteJob"
    shouldSaveToQueue: true,
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
      formGroupId: payload.formGroupId,
      questionCount: payload.jobTypeForm.questions.length,
      answerCount: payload.jobTypeForm.jobAnswers.length,
      isComplete: payload.completeJob,
    })

    // Log full payload for debugging
    console.log('TC sync payload (full):', JSON.stringify(payload, null, 2))

    const response = await tradieConnectApiRequest(
      `/api/v2/JobForm`,
      tcUserId,
      tcToken,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )

    // Log raw response for debugging
    const responseText = await response.text()
    console.log('TC sync raw response:', response.status, responseText)

    if (response.ok) {
      // Try to parse as JSON, fall back to raw text
      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        data = responseText
      }
      console.log('TC sync successful:', data)
      return { success: true, response: data }
    }

    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    console.error('TC sync failed:', response.status, responseText)
    return { success: false, error: `Failed to sync answers: ${response.status} - ${responseText}` }
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
