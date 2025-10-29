import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get organization's documents
export async function GET(req: Request) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organization
    const orgs = await sql`
      SELECT o.id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const org = orgs[0]

    // Get organization documents
    const documents = await sql`
      SELECT od.*, u.full_name as uploaded_by_name
      FROM organization_documents od
      LEFT JOIN users u ON od.uploaded_by_user_id = u.id
      WHERE od.organization_id = ${org.id}
      ORDER BY od.created_at DESC
    `

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching organization documents:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Upload organization document
export async function POST(req: Request) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organization (must be owner or admin)
    const orgs = await sql`
      SELECT o.id, om.role
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      AND (om.role = 'owner' OR om.role = 'admin')
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found or insufficient permissions' },
        { status: 403 }
      )
    }

    const org = orgs[0]

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const documentType = formData.get('documentType') as string
    const documentNumber = formData.get('documentNumber') as string | null
    const issuingAuthority = formData.get('issuingAuthority') as string | null
    const issueDate = formData.get('issueDate') as string | null
    const expiryDate = formData.get('expiryDate') as string | null

    if (!file || !title || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields: file, title, documentType' },
        { status: 400 }
      )
    }

    // Upload file to Vercel Blob
    const blob = await put(`documents/organization/${org.id}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })

    // Create document record
    const documents = await sql`
      INSERT INTO organization_documents (
        organization_id,
        uploaded_by_user_id,
        document_type,
        title,
        document_number,
        file_url,
        issue_date,
        expiry_date,
        issuing_authority,
        created_at,
        updated_at
      )
      VALUES (
        ${org.id},
        ${user.id},
        ${documentType},
        ${title},
        ${documentNumber},
        ${blob.url},
        ${issueDate},
        ${expiryDate},
        ${issuingAuthority},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      document: documents[0],
    })
  } catch (error) {
    console.error('Error uploading organization document:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
