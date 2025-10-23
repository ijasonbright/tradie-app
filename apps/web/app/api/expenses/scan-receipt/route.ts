import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// POST - Scan receipt image and extract expense details using Claude Vision
export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
    if (file.type === 'image/png') {
      mediaType = 'image/png'
    } else if (file.type === 'image/webp') {
      mediaType = 'image/webp'
    } else if (file.type === 'image/gif') {
      mediaType = 'image/gif'
    }

    // Use Claude Vision to extract receipt details
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
              text: `Analyze this receipt and extract the following information in JSON format:

{
  "supplierName": "Name of the business/supplier",
  "totalAmount": "Total amount including GST/tax as a number (e.g., 156.50)",
  "date": "Date in YYYY-MM-DD format",
  "category": "One of: fuel, materials, tools, vehicle, subcontractor, meals, other",
  "description": "Brief description of the purchase",
  "items": ["List of key items purchased if visible"]
}

Rules:
- For category, choose the best match based on the receipt:
  * fuel: Gas stations, petrol, diesel
  * materials: Building supplies, hardware stores, trade supplies
  * tools: Tool purchases, equipment
  * vehicle: Car repairs, maintenance, vehicle-related
  * subcontractor: Payments to other trades/contractors
  * meals: Restaurants, cafes, food purchases
  * other: Everything else
- If totalAmount is unclear, extract the highest amount on the receipt
- If date is unclear, use today's date
- Be specific in description (e.g., "Hardware supplies from Bunnings" not just "Hardware")
- Only return valid JSON, no other text

Return ONLY the JSON object, nothing else.`,
            },
          ],
        },
      ],
    })

    // Extract the JSON from Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Try to parse JSON from the response
    let extractedData
    try {
      // Remove markdown code blocks if present
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extractedData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      return NextResponse.json(
        { error: 'Failed to extract receipt data. Please enter details manually.' },
        { status: 400 }
      )
    }

    // Validate and format the extracted data
    const result = {
      supplierName: extractedData.supplierName || '',
      totalAmount: extractedData.totalAmount ? parseFloat(extractedData.totalAmount.toString()) : 0,
      date: extractedData.date || new Date().toISOString().split('T')[0],
      category: extractedData.category || 'other',
      description: extractedData.description || '',
      items: extractedData.items || [],
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error scanning receipt:', error)
    return NextResponse.json(
      { error: 'Failed to scan receipt. Please try again or enter details manually.' },
      { status: 500 }
    )
  }
}
