import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { decryptUrlParameter, fetchTCUser } from '@/lib/tradieconnect'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

/**
 * GET /admin/secure/setauth
 *
 * This is the fixed callback URL that TradieConnect always redirects to after SSO authentication.
 * It receives encrypted parameters and stores the user's TradieConnect credentials.
 *
 * Query Parameters (all encrypted):
 * - r: Referer URL (where to redirect after processing)
 * - s: Secret
 * - u: TradieConnect User ID (GUID)
 * - t: Access Token
 * - rt: Refresh Token
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Get encrypted parameters
    const encryptedReferer = searchParams.get('r')
    const encryptedSecret = searchParams.get('s')
    const encryptedUserId = searchParams.get('u')
    const encryptedToken = searchParams.get('t')
    const encryptedRefreshToken = searchParams.get('rt')

    console.log('TradieConnect SSO callback received:', {
      hasReferer: !!encryptedReferer,
      hasSecret: !!encryptedSecret,
      hasUserId: !!encryptedUserId,
      hasToken: !!encryptedToken,
      hasRefreshToken: !!encryptedRefreshToken,
    })

    // Validate required parameters
    if (!encryptedUserId || !encryptedToken) {
      console.error('Missing required TradieConnect callback parameters')
      return NextResponse.redirect(new URL('/dashboard/integrations?error=missing_params', request.url))
    }

    // Decrypt parameters
    let tcUserId: string
    let tcToken: string
    let tcRefreshToken: string | null = null
    let refererUrl: string = '/dashboard/integrations'

    try {
      tcUserId = decryptUrlParameter(encryptedUserId)
      tcToken = decryptUrlParameter(encryptedToken)

      if (encryptedRefreshToken) {
        tcRefreshToken = decryptUrlParameter(encryptedRefreshToken)
      }

      if (encryptedReferer) {
        refererUrl = decryptUrlParameter(encryptedReferer)
      }

      // Decrypt secret if provided (for validation, not stored)
      if (encryptedSecret) {
        decryptUrlParameter(encryptedSecret)
      }
    } catch (decryptError) {
      console.error('Failed to decrypt TradieConnect parameters:', decryptError)
      return NextResponse.redirect(new URL('/dashboard/integrations?error=decryption_failed', request.url))
    }

    // Get the current user from Clerk
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      // User not logged in - redirect to login then back to integrations
      console.error('No Clerk user found during TradieConnect callback')
      return NextResponse.redirect(new URL('/sign-in?redirect_url=/dashboard/integrations', request.url))
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get the user from database
    const users = await sql`
      SELECT u.id, u.clerk_user_id, om.organization_id
      FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      WHERE u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (users.length === 0) {
      console.error('User not found in database for Clerk ID:', clerkUserId)
      return NextResponse.redirect(new URL('/dashboard/integrations?error=user_not_found', request.url))
    }

    const user = users[0]

    // Fetch TradieConnect user details to get the providerId
    let tcProviderId: number | null = null
    try {
      const tcUserResult = await fetchTCUser(tcUserId, tcToken)
      if (tcUserResult.success && tcUserResult.user) {
        tcProviderId = tcUserResult.user.providerId
        console.log('Fetched TradieConnect user details:', {
          userId: tcUserResult.user.userId,
          providerId: tcUserResult.user.providerId,
          firstName: tcUserResult.user.firstName,
          lastName: tcUserResult.user.lastName,
        })
      } else {
        console.warn('Could not fetch TradieConnect user details:', tcUserResult.error)
      }
    } catch (tcUserError) {
      console.warn('Error fetching TradieConnect user details:', tcUserError)
      // Continue anyway - we can still store the connection without providerId
    }

    // Store the providerId on the user record for job matching
    if (tcProviderId) {
      await sql`
        UPDATE users SET tc_provider_id = ${tcProviderId}, updated_at = NOW()
        WHERE id = ${user.id}
      `
    }

    // Store tokens as plain text (no encryption needed)
    // Check if user already has a TradieConnect connection
    const existingConnections = await sql`
      SELECT id FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (existingConnections.length > 0) {
      // Update existing connection
      await sql`
        UPDATE tradieconnect_connections
        SET
          tc_user_id = ${tcUserId},
          tc_token = ${tcToken},
          tc_refresh_token = ${tcRefreshToken},
          connected_at = NOW(),
          updated_at = NOW()
        WHERE id = ${existingConnections[0].id}
      `
    } else {
      // Create new connection
      await sql`
        INSERT INTO tradieconnect_connections (
          organization_id,
          user_id,
          tc_user_id,
          tc_token,
          tc_refresh_token,
          is_active,
          connected_at,
          created_at,
          updated_at
        ) VALUES (
          ${user.organization_id},
          ${user.id},
          ${tcUserId},
          ${tcToken},
          ${tcRefreshToken},
          true,
          NOW(),
          NOW(),
          NOW()
        )
      `
    }

    // Redirect back to the referer URL (or integrations page)
    // Make sure refererUrl is a valid URL on our domain
    let redirectUrl = '/dashboard/integrations?success=connected'

    if (refererUrl && !refererUrl.includes('://')) {
      // It's a relative URL, use it
      redirectUrl = refererUrl.includes('?')
        ? `${refererUrl}&success=connected`
        : `${refererUrl}?success=connected`
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (error) {
    console.error('Error in TradieConnect SSO callback:', error)
    return NextResponse.redirect(new URL('/dashboard/integrations?error=server_error', request.url))
  }
}
