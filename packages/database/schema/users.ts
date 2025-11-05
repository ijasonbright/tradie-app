import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  profilePhotoUrl: text('profile_photo_url'),
  smsPhoneNumber: varchar('sms_phone_number', { length: 50 }),
  expoPushToken: text('expo_push_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
