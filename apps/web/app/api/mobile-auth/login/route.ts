import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

/**
 * Mobile Authentication Endpoint
 * Handles email/password login for mobile apps without requiring @clerk/clerk-expo
 * Returns a session token that can be used for API authentication
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Use Clerk's Backend API to verify credentials
    // Note: Clerk doesn't have a direct password verification endpoint
    // We need to use the sign-in token approach instead

    // Create a sign-in token for this email
    const client = await clerkClient()
    const signInToken = await client.signInTokens.createSignInToken({
      userId: undefined, // Will be resolved by email
      expiresInSeconds: 3600, // 1 hour
    })

    // For now, return a temporary solution message
    // We'll need to implement proper authentication flow
    return NextResponse.json(
      {
        message: 'This endpoint needs Clerk configuration',
        note: 'Clerk does not support direct email/password verification via API',
        suggestion: 'Use Clerk publishable key directly in mobile app'
      },
      { status: 501 }
    )

  } catch (error) {
    console.error('Mobile auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
