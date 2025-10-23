/**
 * AI Document Verification Service
 *
 * Uses Anthropic's Claude API to verify license and insurance documents
 * Extracts expiry dates and validates against user-entered dates
 */

interface DocumentVerificationResult {
  status: 'verified' | 'mismatch' | 'error' | 'no_date_found'
  aiExtractedExpiryDate: string | null
  notes: string
  confidence: 'high' | 'medium' | 'low'
}

// Lazy-load Anthropic SDK only when needed
async function getAnthropicClient() {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  })
}

/**
 * Verify a document by extracting expiry date and comparing with user input
 */
export async function verifyDocument(
  imageUrl: string,
  userEnteredExpiryDate: string,
  documentType: string
): Promise<DocumentVerificationResult> {
  try {
    // Fetch the image as base64
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    // Determine media type from URL
    const mediaType = imageUrl.toLowerCase().endsWith('.png')
      ? 'image/png'
      : imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : imageUrl.toLowerCase().endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg' // default

    const anthropic = await getAnthropicClient()
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `You are analyzing a ${documentType} document. Please:

1. Extract the EXPIRY DATE or EXPIRATION DATE from this document
2. Return ONLY the date in YYYY-MM-DD format
3. If you find multiple dates, return the EXPIRY/EXPIRATION date specifically
4. If no expiry date is found, respond with "NO_DATE_FOUND"
5. If you're unsure, respond with "UNCERTAIN: [your best guess in YYYY-MM-DD format]"

Example responses:
- "2025-12-31" (if you're confident)
- "UNCERTAIN: 2025-12-31" (if you're not fully confident)
- "NO_DATE_FOUND" (if no expiry date exists)

Document type: ${documentType}
User claims the expiry date is: ${userEnteredExpiryDate}

Return ONLY the date in the format specified above, nothing else.`,
            },
          ],
        },
      ],
    })

    // Parse Claude's response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    if (responseText === 'NO_DATE_FOUND') {
      return {
        status: 'no_date_found',
        aiExtractedExpiryDate: null,
        notes: 'AI could not find an expiry date on this document',
        confidence: 'high',
      }
    }

    // Check if Claude is uncertain
    let extractedDate: string
    let confidence: 'high' | 'medium' | 'low' = 'high'

    if (responseText.startsWith('UNCERTAIN:')) {
      extractedDate = responseText.replace('UNCERTAIN:', '').trim()
      confidence = 'medium'
    } else {
      extractedDate = responseText
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(extractedDate)) {
      return {
        status: 'error',
        aiExtractedExpiryDate: null,
        notes: `AI returned invalid date format: ${responseText}`,
        confidence: 'low',
      }
    }

    // Compare with user-entered date
    const userDate = new Date(userEnteredExpiryDate).toISOString().split('T')[0]
    const aiDate = extractedDate

    if (userDate === aiDate) {
      return {
        status: 'verified',
        aiExtractedExpiryDate: aiDate,
        notes: `✓ Expiry date matches (${aiDate})`,
        confidence,
      }
    } else {
      return {
        status: 'mismatch',
        aiExtractedExpiryDate: aiDate,
        notes: `⚠ Date mismatch: User entered ${userDate}, but AI found ${aiDate}`,
        confidence,
      }
    }
  } catch (error) {
    console.error('AI verification error:', error)
    return {
      status: 'error',
      aiExtractedExpiryDate: null,
      notes: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      confidence: 'low',
    }
  }
}

/**
 * Extract all information from a document
 * Useful for pre-filling form fields
 */
export async function extractDocumentInfo(
  imageUrl: string,
  documentType: string
): Promise<{
  documentNumber?: string
  expiryDate?: string
  issueDate?: string
  holderName?: string
  issuingAuthority?: string
  raw: string
}> {
  try {
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    const mediaType = imageUrl.toLowerCase().endsWith('.png')
      ? 'image/png'
      : imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/webp'

    const anthropic = await getAnthropicClient()
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Extract information from this ${documentType} document.

Return a JSON object with these fields (use null if not found):
{
  "documentNumber": "license/policy number",
  "expiryDate": "YYYY-MM-DD",
  "issueDate": "YYYY-MM-DD",
  "holderName": "person's name",
  "issuingAuthority": "issuing body"
}

Return ONLY valid JSON, nothing else.`,
            },
          ],
        },
      ],
    })

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'

    const data = JSON.parse(responseText)

    return {
      ...data,
      raw: responseText,
    }
  } catch (error) {
    console.error('AI extraction error:', error)
    return {
      raw: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
