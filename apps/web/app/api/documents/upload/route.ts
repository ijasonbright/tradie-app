import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// GET - List all documents for current user
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Fetch all documents for this user
    const documents = await sql`
      SELECT * FROM user_documents
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST - Upload document with AI verification
export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const formData = await req.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string
    const documentCategory = formData.get('documentCategory') as string
    const title = formData.get('title') as string
    const documentNumber = formData.get('documentNumber') as string | null
    const expiryDate = formData.get('expiryDate') as string | null
    const issueDate = formData.get('issueDate') as string | null
    const issuingAuthority = formData.get('issuingAuthority') as string | null
    const enableAIVerification = formData.get('enableAIVerification') === 'true'

    if (!file || !documentType || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: file, documentType, title' },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob
    const blob = await put(`documents/${user.id}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })

    // Create document record
    const documents = await sql`
      INSERT INTO user_documents (
        user_id, document_type, document_category, title,
        document_number, file_url, expiry_date, issue_date,
        issuing_authority, ai_verification_status,
        created_at, updated_at
      ) VALUES (
        ${user.id},
        ${documentType},
        ${documentCategory || 'other'},
        ${title},
        ${documentNumber},
        ${blob.url},
        ${expiryDate},
        ${issueDate},
        ${issuingAuthority},
        ${enableAIVerification && expiryDate ? 'pending' : null},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const document = documents[0]

    // Run AI verification in background if enabled and expiry date provided
    if (enableAIVerification && expiryDate) {
      // Don't await - let it run async
      verifyDocumentAsync(document.id, blob.url, expiryDate, documentType, sql)
    }

    return NextResponse.json({
      success: true,
      document,
      message: enableAIVerification && expiryDate
        ? 'Document uploaded. AI verification in progress...'
        : 'Document uploaded successfully',
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Background AI verification
async function verifyDocumentAsync(
  documentId: string,
  fileUrl: string,
  userExpiryDate: string,
  documentType: string,
  sql: any
) {
  try {
    // Dynamic import to avoid build errors when Anthropic SDK is not needed
    const { verifyDocument } = await import('@/lib/ai-document-verification')
    const result = await verifyDocument(fileUrl, userExpiryDate, documentType)

    await sql`
      UPDATE user_documents
      SET
        ai_verification_status = ${result.status},
        ai_verification_notes = ${result.notes},
        ai_extracted_expiry_date = ${result.aiExtractedExpiryDate},
        updated_at = NOW()
      WHERE id = ${documentId}
    `

    console.log(`AI verification completed for document ${documentId}:`, result)
  } catch (error) {
    console.error('AI verification failed:', error)

    await sql`
      UPDATE user_documents
      SET
        ai_verification_status = 'error',
        ai_verification_notes = ${error instanceof Error ? error.message : 'Unknown error'},
        updated_at = NOW()
      WHERE id = ${documentId}
    `
  }
}
