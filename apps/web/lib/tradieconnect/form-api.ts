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
 * Also extracts saved answers from the TC response (value/fieldValue fields)
 */
export function transformTCFormToOurFormat(
  tcForm: TCJobForm,
  tcJobId: number
): OurFormDefinition & { saved_answers?: Record<string, string>; saved_files?: Record<string, string> } {
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

  // Extract saved answers from TC questions
  // For text fields: use value/fieldValue
  // For radio/dropdown: find the selected option text from the answers array
  // For file fields: extract the file URL
  const savedAnswers: Record<string, string> = {}
  const savedFiles: Record<string, string> = {}

  // Log raw TC form for debugging file extraction
  console.log('TC Form raw data for file extraction:', JSON.stringify({
    hasJobAnswers: !!tcForm.jobAnswers,
    jobAnswersCount: tcForm.jobAnswers?.length || 0,
    fileQuestions: tcForm.questions
      .filter(q => q.answerFormat.toLowerCase() === 'file')
      .map(q => ({
        id: q.jobTypeFormQuestionId,
        value: q.value,
        fieldValue: q.fieldValue,
        file: q.file,
      })),
  }, null, 2))

  // First, check jobAnswers array for file data (TC may return files here)
  if (tcForm.jobAnswers && tcForm.jobAnswers.length > 0) {
    console.log(`Processing ${tcForm.jobAnswers.length} jobAnswers for saved files`)
    for (const answer of tcForm.jobAnswers) {
      const questionKey = `tc_q_${answer.jobTypeFormQuestionId}`

      // Check answer.file.link (TC native file format)
      if (answer.file?.link) {
        savedFiles[questionKey] = answer.file.link
        console.log(`Found file in jobAnswers.file.link for ${questionKey}:`, answer.file.link)
        continue
      }

      // Also check answer.value or answer.answerText for blob URLs
      const answerUrl = answer.value || (answer as any).answerText
      if (answerUrl && typeof answerUrl === 'string' && (
        answerUrl.startsWith('http://') ||
        answerUrl.startsWith('https://') ||
        answerUrl.includes('blob.vercel-storage.com')
      )) {
        savedFiles[questionKey] = answerUrl
        console.log(`Found file URL in jobAnswers.value/answerText for ${questionKey}:`, answerUrl)
      }
    }
  }

  for (const question of tcForm.questions) {
    const questionKey = `tc_q_${question.jobTypeFormQuestionId}`
    const answerFormat = question.answerFormat.toLowerCase()

    // Handle file/photo fields - check multiple possible locations
    if (answerFormat === 'file') {
      // Log full question object for debugging file fields
      console.log(`File question ${questionKey} full data:`, JSON.stringify({
        jobTypeFormQuestionId: question.jobTypeFormQuestionId,
        answerFormat: question.answerFormat,
        value: question.value,
        fieldValue: question.fieldValue,
        file: question.file,
      }))

      // Check question.file.link first (TC native file format)
      if (question.file?.link && !savedFiles[questionKey]) {
        savedFiles[questionKey] = question.file.link
        console.log(`Found file in question.file for ${questionKey}:`, question.file.link)
      }

      // Also check value/fieldValue - TC might store blob URLs here
      if (!savedFiles[questionKey]) {
        const valueUrl = question.value || question.fieldValue
        if (valueUrl && typeof valueUrl === 'string' && (
          valueUrl.startsWith('http://') ||
          valueUrl.startsWith('https://') ||
          valueUrl.includes('blob.vercel-storage.com')
        )) {
          savedFiles[questionKey] = valueUrl
          console.log(`Found file URL in value/fieldValue for ${questionKey}:`, valueUrl)
        }
      }
      continue
    }

    // For radio/dropdown/iscompliant: TC might return:
    // 1. The text value directly in value/fieldValue
    // 2. Or we need to look at the answers array to find which one has value="1"
    if (answerFormat === 'radioboxlist' || answerFormat === 'dropdown' || answerFormat === 'iscompliant') {
      // First check if value/fieldValue has the answer text
      let savedValue = question.value || question.fieldValue

      // If no direct value, check the answers array for selected option (value="1")
      if (!savedValue && question.answers && question.answers.length > 0) {
        // TC might return answers with a 'value' field indicating selection
        const selectedOption = (question.answers as any[]).find(
          (a: any) => a.value === '1' || a.value === 1 || a.selected === true
        )
        if (selectedOption) {
          savedValue = selectedOption.description
        }
      }

      if (savedValue && String(savedValue).trim() !== '') {
        savedAnswers[questionKey] = String(savedValue)
      }
      continue
    }

    // For text/textarea and other fields: use value/fieldValue directly
    const savedValue = question.value || question.fieldValue
    if (savedValue && String(savedValue).trim() !== '') {
      savedAnswers[questionKey] = String(savedValue)
    }
  }

  console.log('Extracted saved files:', Object.keys(savedFiles).length, 'files')
  console.log('Extracted saved answers:', Object.keys(savedAnswers).length, 'answers')

  return {
    template_id: `tc_form_${tcForm.jobTypeFormId}`,
    template_name: tcForm.name,
    tc_form_id: tcForm.jobTypeFormId,
    tc_job_id: tcJobId,
    groups,
    saved_answers: Object.keys(savedAnswers).length > 0 ? savedAnswers : undefined,
    saved_files: Object.keys(savedFiles).length > 0 ? savedFiles : undefined,
    _tc_raw: tcForm, // Store original for building sync payload
  }
}

// ==================== Build Sync Payload ====================

/**
 * Builds the TC POST payload from our answers and the original form definition
 *
 * Based on ACTUAL TC sample format:
 * - Minimal top-level fields: jobId, formGroupId, submissionTypeId, lat, lng, completeJob
 * - jobTypeForm ONLY has questions array (no jobAnswers, no id, no name)
 * - For textbox/textarea: jobTypeFormAnswerId = 0, value = the text
 * - For radioboxlist: ALL options listed with value "0" (not selected) or "1" (selected)
 * - For file: needs fileName, fileSuffix, fileSize
 *
 * @param params - Parameters for building the payload
 */
export function buildTCSyncPayload(params: {
  tcJobId: number
  tcFormDefinition: TCJobForm
  answers: Record<string, any> // Our format: { "tc_q_2474": "Yes", ... }
  photoUrls?: Record<string, string[]> // { "tc_q_1234": ["url1", "url2"], ... }
  groupNo?: number // If syncing specific page
  userId: number // TC provider ID (not used in minimal payload)
  providerId: number // TC provider ID (not used in minimal payload)
  isComplete: boolean
}): TCSyncPayload {
  const {
    tcJobId,
    tcFormDefinition,
    answers,
    photoUrls,
    groupNo,
    isComplete,
  } = params

  // Filter questions if groupNo is specified
  const questionsToProcess = groupNo !== undefined
    ? tcFormDefinition.questions.filter(q => q.groupNo === groupNo)
    : tcFormDefinition.questions

  // Build questions array in TC's minimal format
  const questions: any[] = []

  for (const q of questionsToProcess) {
    const questionKey = `tc_q_${q.jobTypeFormQuestionId}`
    const answerValue = answers[questionKey]
    const photos = photoUrls?.[questionKey]

    // Build the question object
    const questionObj: any = {
      groupNo: q.groupNo,
      jobTypeFormQuestionId: q.jobTypeFormQuestionId,
      answerFormat: q.answerFormat,
      answers: [],
    }

    // Handle different answer formats based on TC sample
    if (q.answerFormat === 'radioboxlist' || q.answerFormat === 'dropdown' || q.answerFormat === 'iscompliant' || q.answerFormat === 'checkboxlist') {
      // For radio/dropdown: List ALL options with value "0" or "1"
      if (q.answers && q.answers.length > 0) {
        for (const opt of q.answers) {
          // Check if this option is selected
          const isSelected =
            opt.description.toLowerCase() === String(answerValue || '').toLowerCase() ||
            String(opt.jobTypeFormAnswerId) === String(answerValue);

          questionObj.answers.push({
            jobTypeFormQuestionId: q.jobTypeFormQuestionId,
            jobTypeFormAnswerId: opt.jobTypeFormAnswerId,
            value: isSelected ? "1" : "0",
          })
        }
      }
    } else if (q.answerFormat === 'file') {
      // For file fields
      if (photos && photos.length > 0) {
        const photoUrl = photos[0]
        const fileName = photoUrl.split('/').pop() || 'photo.jpg'
        const fileSuffix = fileName.split('.').pop() || 'jpg'

        questionObj.answers.push({
          jobTypeFormQuestionId: q.jobTypeFormQuestionId,
          jobTypeFormAnswerId: 0,
          value: photoUrl,
          fileName: fileName,
          fileSuffix: fileSuffix,
          fileSize: 1024, // We don't have actual file size, use placeholder
        })
      }
    } else {
      // For textbox, textarea, and other text-based fields
      const textValue = answerValue !== undefined && answerValue !== null ? String(answerValue) : ''

      if (textValue) {
        questionObj.answers.push({
          jobTypeFormQuestionId: q.jobTypeFormQuestionId,
          jobTypeFormAnswerId: 0,
          value: textValue,
        })
      }
    }

    // Only include questions that have answers
    if (questionObj.answers.length > 0) {
      questions.push(questionObj)
    }
  }

  // Build minimal payload matching TC sample exactly
  const payload = {
    jobId: tcJobId,
    formGroupId: groupNo ?? 0,
    submissionTypeId: 0,
    lat: 0,
    lng: 0,
    completeJob: isComplete,
    jobTypeForm: {
      questions: questions,
    },
  }

  console.log('Built TC payload (minimal format):', JSON.stringify(payload, null, 2))

  return payload as unknown as TCSyncPayload
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
    // Cast to any since payload may not have questions array (minimal payload)
    const payloadAny = payload as any
    console.log('Syncing answers to TC:', {
      jobId: payload.jobId,
      formGroupId: payload.formGroupId,
      questionCount: payloadAny.jobTypeForm?.questions?.length ?? 0,
      answerCount: payloadAny.jobTypeForm?.jobAnswers?.length ?? 0,
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
