/**
 * Tall Bob SMS API Wrapper
 * Documentation: https://tallbob.com/api-docs
 */

interface SendSMSParams {
  from: string // Sender phone number (must be a Tall Bob number)
  to: string // Recipient phone number
  message: string // Message content
  messageId?: string // Optional custom message ID for tracking
}

interface SendSMSResponse {
  success: boolean
  messageId: string
  credits: number
  error?: string
}

interface SMSStatusResponse {
  messageId: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  deliveredAt?: string
  error?: string
}

export class TallBobAPI {
  private apiKey: string
  private apiUrl: string

  constructor() {
    this.apiKey = process.env.TALLBOB_API_KEY || ''
    this.apiUrl = process.env.TALLBOB_API_URL || 'https://api.tallbob.com'

    if (!this.apiKey) {
      console.warn('TALLBOB_API_KEY not configured')
    }
  }

  /**
   * Send an SMS message
   */
  async sendSMS({ from, to, message, messageId }: SendSMSParams): Promise<SendSMSResponse> {
    try {
      // Calculate credits needed (1 credit per 160 characters)
      const credits = Math.ceil(message.length / 160)

      // If API key not configured, use test mode
      if (!this.apiKey || this.apiKey === '') {
        console.log('[TEST MODE] SMS would be sent:', { from, to, message })
        return {
          success: true,
          messageId: messageId || `test_${Date.now()}`,
          credits,
        }
      }

      console.log('Calling Tall Bob API:', {
        url: `${this.apiUrl}/v1/sms/send`,
        from,
        to,
        messageLength: message.length,
        hasApiKey: !!this.apiKey
      })

      const response = await fetch(`${this.apiUrl}/v1/sms/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          message,
          messageId,
        }),
      })

      console.log('Tall Bob API response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Tall Bob API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })

        let errorMessage = 'Failed to send SMS'
        try {
          const error = JSON.parse(errorText)
          errorMessage = error.message || error.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        return {
          success: false,
          messageId: messageId || '',
          credits: 0,
          error: `Tall Bob API error (${response.status}): ${errorMessage}`,
        }
      }

      const data = await response.json()

      return {
        success: true,
        messageId: data.messageId || messageId || `msg_${Date.now()}`,
        credits,
      }
    } catch (error) {
      console.error('Tall Bob API error:', error)
      return {
        success: false,
        messageId: messageId || '',
        credits: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get SMS delivery status
   */
  async getStatus(messageId: string): Promise<SMSStatusResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/sms/status/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to get SMS status')
      }

      const data = await response.json()

      return {
        messageId,
        status: data.status,
        deliveredAt: data.deliveredAt,
      }
    } catch (error) {
      console.error('Error getting SMS status:', error)
      return {
        messageId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Implement signature verification based on Tall Bob's webhook security
    // This is a placeholder - update based on actual Tall Bob webhook docs
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return expectedSignature === signature
  }

  /**
   * Format phone number for SMS (E.164 format)
   */
  static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')

    // If starts with 0, assume Australian number
    if (cleaned.startsWith('0')) {
      cleaned = '61' + cleaned.substring(1)
    }

    // If doesn't start with +, add it
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned
    }

    return cleaned
  }

  /**
   * Calculate SMS credit cost
   */
  static calculateCredits(message: string): number {
    return Math.ceil(message.length / 160)
  }

  /**
   * Calculate SMS cost in dollars (5 cents per credit)
   */
  static calculateCost(message: string): number {
    const credits = this.calculateCredits(message)
    return credits * 0.05
  }
}

// Export singleton instance
export const tallbob = new TallBobAPI()
