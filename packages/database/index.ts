import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

// Allow build to succeed without DATABASE_URL (it's only needed at runtime)
const connectionString = process.env.DATABASE_URL || 'postgresql://placeholder'

const sql = neon(connectionString)
export const db = drizzle(sql, { schema })

export * from './schema'
