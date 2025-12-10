import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/health',
  '/api/debug',
  '/api/migrate(.*)',
  '/api/invitations/(.*)',
  '/api/users/count',
  '/api/webhooks/(.*)',
  '/api/mobile-auth/(.*)',
  '/api/integrations/propertypal/(.*)', // Property Pal integration endpoints (API key protected)
  '/admin/secure/setauth(.*)', // TradieConnect SSO callback (handles its own auth via encrypted params)
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/accept-invitation(.*)',
  '/verify-email-address(.*)',
  '/verify(.*)',
  '/mobile-callback',
  '/oauth-mobile/(.*)',
  '/public/(.*)',
])

// API routes that handle their own JWT authentication (for mobile)
const isMobileApiRoute = createRouteMatcher([
  '/api/jobs(.*)',
  '/api/clients(.*)',
  '/api/appointments(.*)',
  '/api/invoices(.*)',
  '/api/payments(.*)',
  '/api/quotes(.*)',
  '/api/expenses(.*)',
  '/api/users/me(.*)',
  '/api/users/push-token(.*)',
  '/api/push/test(.*)',
  '/api/organizations/current(.*)',
  '/api/organizations/members(.*)',
  '/api/docs(.*)',
  '/api/reminders(.*)',
  '/api/form-builder(.*)', // Form builder question updates
  '/api/completion-forms(.*)', // Form templates and completion forms
  '/api/properties(.*)', // Properties for asset register
  '/api/assets(.*)', // Assets for asset register
  '/api/asset-register-jobs(.*)', // Asset register jobs for mobile
  '/api/integrations/tradieconnect(.*)', // TradieConnect integration endpoints
  // Note: Mobile completion forms use /api/jobs/[id]/completion-form (covered by /api/jobs)
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
