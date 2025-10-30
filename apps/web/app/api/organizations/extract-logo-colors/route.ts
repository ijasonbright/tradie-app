import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { extractColorsFromImage } from '@/lib/colors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authResult = await auth()
    const clerkUserId = authResult.userId

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { logoUrl } = await req.json()

    if (!logoUrl) {
      return NextResponse.json(
        { error: 'logoUrl is required' },
        { status: 400 }
      )
    }

    // Fetch the image from the logo URL
    const imageResponse = await fetch(logoUrl)
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch logo image' },
        { status: 400 }
      )
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Extract colors
    const colors = await extractColorsFromImage(imageBuffer)

    return NextResponse.json({
      colors: colors.map(c => ({
        hex: c.hex,
        rgb: c.rgb,
        isDark: c.isDark,
        name: c.name,
      })),
    })
  } catch (error) {
    console.error('Error extracting colors:', error)
    return NextResponse.json(
      { error: 'Failed to extract colors from logo' },
      { status: 500 }
    )
  }
}
