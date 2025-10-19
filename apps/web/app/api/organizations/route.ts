import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { organizations, organizationMembers, users } from '@tradie-app/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  abn: z.string().optional(),
  tradeType: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
})

function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql)
}

export async function POST(req: Request) {
  try {
    const db = getDb()
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validatedData = createOrganizationSchema.parse(body)

    // Create organization
    const [organization] = await db
      .insert(organizations)
      .values({
        name: validatedData.name,
        abn: validatedData.abn,
        tradeType: validatedData.tradeType,
        phone: validatedData.phone,
        email: validatedData.email,
        addressLine1: validatedData.addressLine1,
        addressLine2: validatedData.addressLine2,
        city: validatedData.city,
        state: validatedData.state,
        postcode: validatedData.postcode,
        ownerId: user.id,
        smsCredits: 0,
      })
      .returning()

    // Add user as owner member
    await db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
      canCreateJobs: true,
      canEditAllJobs: true,
      canCreateInvoices: true,
      canViewFinancials: true,
      canApproveExpenses: true,
      canApproveTimesheets: true,
    })

    return NextResponse.json({
      success: true,
      organization,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const db = getDb()
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's organizations
    const userOrgs = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))

    // Get organization details for each membership
    const orgsWithDetails = await Promise.all(
      userOrgs.map(async (membership) => {
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, membership.organizationId))

        return {
          ...org,
          role: membership.role,
          status: membership.status,
        }
      })
    )

    return NextResponse.json({
      organizations: orgsWithDetails,
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
