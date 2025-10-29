import { jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export interface JWTPayload {
  userId: string
  clerkUserId: string
  email: string
}

/**
 * Verify and decode a JWT token from the mobile app
 */
export async function verifyMobileToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Validate payload has required fields
    if (
      typeof payload.userId === 'string' &&
      typeof payload.clerkUserId === 'string' &&
      typeof payload.email === 'string'
    ) {
      return {
        userId: payload.userId,
        clerkUserId: payload.clerkUserId,
        email: payload.email,
      }
    }

    return null
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * Extract JWT token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  return parts[1]
}
