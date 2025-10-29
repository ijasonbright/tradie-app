import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/health',
  '/api/debug',
  '/api/migrate(.*)',
  '/api/invitations/(.*)',
  '/api/users/count',
  '/api/webhooks/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/accept-invitation(.*)',
  '/verify-email-address(.*)',
  '/verify(.*)',
  '/mobile-callback',
])

// API routes that handle their own JWT authentication (for mobile)
const isMobileApiRoute = createRouteMatcher([
  '/api/jobs(.*)',
  '/api/clients(.*)',
  '/api/appointments(.*)',
  '/api/invoices(.*)',
  '/api/quotes(.*)',
  '/api/expenses(.*)',
  '/api/users/me(.*)',
  '/api/organizations/current(.*)',
  '/api/organizations/members(.*)',
])

export default clerkMiddleware((auth, request) => {
  // Skip Clerk protection for mobile API routes (they handle JWT auth internally)
  if (isMobileApiRoute(request)) {
    return
  }

  // Protect all other non-public routes with Clerk
  if (!isPublicRoute(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
