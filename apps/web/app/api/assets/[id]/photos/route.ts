import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// GET - Get all photos for an asset
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params

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
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has access to asset's organization
    const asset = await sql`
      SELECT a.*
      FROM assets a
      INNER JOIN organization_members om ON a.organization_id = om.organization_id
      WHERE a.id = ${assetId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (asset.length === 0) {
      return NextResponse.json({ error: 'Asset not found or access denied' }, { status: 404 })
    }

    // Get photos
    const photos = await sql`
      SELECT * FROM asset_photos
      WHERE asset_id = ${assetId}
      ORDER BY taken_at DESC
    `

    return NextResponse.json({
      photos,
    })
  } catch (error) {
    console.error('Error fetching asset photos:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Upload a new photo for an asset
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params

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
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has access to asset's organization
    const asset = await sql`
      SELECT a.*, o.id as org_id
      FROM assets a
      INNER JOIN organizations o ON a.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE a.id = ${assetId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (asset.length === 0) {
      return NextResponse.json({ error: 'Asset not found or access denied' }, { status: 404 })
    }

    // Handle file upload
    const formData = await req.formData()
    const file = formData.get('file') as File
    const photoType = formData.get('photo_type') as string || 'general'
    const caption = formData.get('caption') as string || null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Upload to Vercel Blob
    const filename = `assets/${asset[0].org_id}/${assetId}/${Date.now()}-${file.name}`
    const blob = await put(filename, file, {
      access: 'public',
    })

    // Create photo record
    const photos = await sql`
      INSERT INTO asset_photos (
        asset_id, photo_path, photo_type, caption, uploaded_by_id, taken_at, created_at
      ) VALUES (
        ${assetId},
        ${blob.url},
        ${photoType},
        ${caption},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      photo: photos[0],
    })
  } catch (error) {
    console.error('Error uploading asset photo:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
