import { auth, currentUser } from '@clerk/nextjs/server'
import { db, users, organizations, organizationMembers } from './db'
import { eq } from 'drizzle-orm'

/**
 * Get the current authenticated user from the database
 * Creates user record if it doesn't exist
 */
export async function getCurrentUser() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    return null
  }

  // Check if user exists in our database
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUser.id),
  })

  if (existingUser) {
    return existingUser
  }

  // Create user if doesn't exist
  const [newUser] = await db.insert(users).values({
    clerkUserId: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
    fullName: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim(),
    phone: clerkUser.phoneNumbers[0]?.phoneNumber,
    profilePhotoUrl: clerkUser.imageUrl,
  }).returning()

  return newUser
}

/**
 * Get the current user's active organization
 * Returns null if user is not in an organization
 */
export async function getCurrentOrganization() {
  const { orgId } = await auth()

  if (!orgId) {
    return null
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })

  return organization
}

/**
 * Get the current user's membership in their active organization
 */
export async function getCurrentMembership() {
  const user = await getCurrentUser()
  const organization = await getCurrentOrganization()

  if (!user || !organization) {
    return null
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: (members, { and, eq }) =>
      and(
        eq(members.organizationId, organization.id),
        eq(members.userId, user.id)
      ),
  })

  return membership
}

/**
 * Check if current user has a specific permission
 */
export async function hasPermission(permission: keyof typeof organizationMembers.$inferSelect) {
  const membership = await getCurrentMembership()

  if (!membership) {
    return false
  }

  // Owners and admins have all permissions
  if (membership.role === 'owner' || membership.role === 'admin') {
    return true
  }

  return membership[permission] === true
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

/**
 * Require organization membership - throws error if not in an organization
 */
export async function requireOrganization() {
  const organization = await getCurrentOrganization()

  if (!organization) {
    throw new Error('No active organization')
  }

  return organization
}
