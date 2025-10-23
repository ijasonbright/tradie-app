import { NextResponse } from 'next/server'
import { SESClient, ListVerifiedEmailAddressesCommand } from '@aws-sdk/client-ses'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

// GET - Test AWS SES configuration
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if credentials are set
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({
        error: 'AWS credentials not configured',
        details: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in environment variables',
      }, { status: 500 })
    }

    const region = process.env.AWS_REGION || 'ap-southeast-2'

    // Log configuration (safely)
    console.log('Testing SES with config:', {
      region,
      accessKeyIdPrefix: process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...',
      accessKeyIdLength: process.env.AWS_ACCESS_KEY_ID.length,
      secretKeyLength: process.env.AWS_SECRET_ACCESS_KEY.length,
    })

    // Create SES client with explicit credentials to override Vercel's default AWS role
    const ses = new SESClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })

    // Try to list verified email addresses
    const command = new ListVerifiedEmailAddressesCommand({})
    const response = await ses.send(command)

    return NextResponse.json({
      success: true,
      message: 'AWS SES credentials are valid!',
      region,
      verifiedEmails: response.VerifiedEmailAddresses || [],
      credentialInfo: {
        accessKeyIdPrefix: process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...',
        accessKeyIdLength: process.env.AWS_ACCESS_KEY_ID.length,
        secretKeyLength: process.env.AWS_SECRET_ACCESS_KEY.length,
      }
    })
  } catch (error) {
    console.error('SES test error:', error)

    if (error instanceof Error) {
      return NextResponse.json({
        error: 'SES test failed',
        details: error.message,
        errorName: error.name,
      }, { status: 500 })
    }

    return NextResponse.json({
      error: 'SES test failed',
      details: 'Unknown error',
    }, { status: 500 })
  }
}
