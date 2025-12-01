# Tradie App

Multi-Tenant Tradie Business Management App

## Project Structure

```
tradie-app/
├── apps/
│   ├── mobile/                 # React Native / Expo mobile app
│   └── web/                    # Next.js backend API
├── packages/
│   ├── database/              # Drizzle ORM schema & migrations
│   ├── api-client/            # Shared API types & client
│   └── utils/                 # Shared utilities
└── CLAUDE.md                  # Full project specification
```

## Tech Stack

- **Mobile**: React Native + Expo, TypeScript, Zustand, React Query
- **Backend**: Next.js 14+ (App Router), Vercel serverless
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Auth**: Clerk with Organizations
- **Storage**: Vercel Blob
- **Integrations**: Xero, Stripe, Tall Bob SMS, Resend

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Accounts: Clerk, Neon, Vercel

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables in `.env`:
   - `DATABASE_URL` - Your Neon PostgreSQL connection string
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
   - `CLERK_SECRET_KEY` - From Clerk dashboard
   - Other variables as needed

### Installation

```bash
# Install all dependencies
npm install

# Generate database migrations
cd packages/database
npm run db:generate

# Push schema to database
npm run db:push
```

### Development

```bash
# Run all workspaces in dev mode
npm run dev

# Or run individually:

# Backend only
cd apps/web
npm run dev

# Mobile only
cd apps/mobile
npm start
```

## Current Status

✅ Monorepo structure set up
✅ Next.js backend initialized
✅ Expo mobile app initialized
✅ Database schema created (core tables)
✅ Clerk authentication configured

### Next Steps

1. Set up Clerk Organization support
2. Create authentication flows (signup/signin)
3. Build owner onboarding flow
4. Implement team invitation system
5. Create API endpoints for core features

## Database Schema

The database schema is defined using Drizzle ORM in `packages/database/schema/`.

Current tables:
- `users` - User accounts
- `organizations` - Business organizations
- `organization_members` - Team membership
- `clients` - Customer information
- `jobs` - Job tracking
- `quotes` - Quote/estimate system
- `invoices` - Invoicing system

See `CLAUDE.md` for the complete schema specification.

## Development Phases

We're currently in **Phase 1: Foundation (Weeks 1-2)**

See `CLAUDE.md` for the full 24-week development roadmap.

## License

Private project
# Trigger redeploy Mon Dec  1 21:29:36 AEDT 2025
