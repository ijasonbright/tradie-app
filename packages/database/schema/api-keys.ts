import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

/**
 * API Keys for external integrations (Zapier, TradieConnect, custom integrations)
 * Keys are stored as SHA-256 hashes for security
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  // Key identification
  name: varchar('name', { length: 255 }).notNull(), // User-defined name (e.g., "Main Automation Key")
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(), // SHA-256 hash of the API key
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(), // For display (e.g., "ta_abc123...")

  // Key type and permissions
  keyType: varchar('key_type', { length: 50 }).notNull().default('standard'), // 'standard', 'tradieconnect', 'zapier', 'readonly'
  permissions: jsonb('permissions').$type<string[]>().default([]), // Specific permissions: ['jobs.read', 'jobs.write', 'invoices.read', etc.]

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Usage tracking
  lastUsedAt: timestamp('last_used_at'),
  usageCount: integer('usage_count').default(0).notNull(),

  // Rate limiting
  rateLimitPerMinute: integer('rate_limit_per_minute').default(100),
  rateLimitPerHour: integer('rate_limit_per_hour').default(1000),

  // Metadata
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  expiresAt: timestamp('expires_at'), // null = never expires
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Webhook subscriptions for real-time event notifications
 * External systems subscribe to events and receive POST requests when they occur
 */
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  // Subscription identification
  subscriptionId: varchar('subscription_id', { length: 100 }).notNull().unique(), // Unique ID for external reference
  name: varchar('name', { length: 255 }), // User-defined name

  // Event configuration
  eventType: varchar('event_type', { length: 100 }).notNull(), // 'job.created', 'invoice.paid', etc.
  targetUrl: text('target_url').notNull(), // Webhook URL to POST to

  // Optional filters (e.g., only trigger for specific job types)
  filters: jsonb('filters').$type<Record<string, any>>().default({}),

  // Authentication for outgoing webhooks
  secretKey: varchar('secret_key', { length: 255 }), // For HMAC signature verification
  headers: jsonb('headers').$type<Record<string, string>>().default({}), // Custom headers to include

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Usage tracking
  lastTriggeredAt: timestamp('last_triggered_at'),
  triggerCount: integer('trigger_count').default(0).notNull(),
  failureCount: integer('failure_count').default(0).notNull(),
  lastFailureAt: timestamp('last_failure_at'),
  lastFailureReason: text('last_failure_reason'),

  // Retry configuration
  maxRetries: integer('max_retries').default(3),
  retryDelaySeconds: integer('retry_delay_seconds').default(60),

  // Metadata
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id), // Which API key created this subscription
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Webhook delivery logs for debugging and analytics
 */
export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').references(() => webhookSubscriptions.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  // Event details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventId: uuid('event_id').notNull(), // Unique ID for this event (for deduplication)

  // Request details
  targetUrl: text('target_url').notNull(),
  requestPayload: jsonb('request_payload').$type<Record<string, any>>().notNull(),
  requestHeaders: jsonb('request_headers').$type<Record<string, string>>(),

  // Response details
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),

  // Timing
  deliveryDurationMs: integer('delivery_duration_ms'),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'success', 'failed', 'retrying'
  retryCount: integer('retry_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at'),

  // Timestamps
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * API request logs for usage tracking and debugging
 */
export const apiRequestLogs = pgTable('api_request_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id),

  // Request details
  method: varchar('method', { length: 10 }).notNull(), // GET, POST, PUT, DELETE
  path: varchar('path', { length: 500 }).notNull(),
  queryParams: jsonb('query_params').$type<Record<string, any>>(),

  // Response
  statusCode: integer('status_code').notNull(),
  responseTimeMs: integer('response_time_ms'),

  // Error details (if any)
  errorMessage: text('error_message'),

  // Client info
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  // Timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
