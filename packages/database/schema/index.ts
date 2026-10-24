import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Minimal R1 table: proves the migration pipeline and gives the worker a
// liveness signal until the full trading schema lands.
export const systemHeartbeats = pgTable('system_heartbeats', {
  id: uuid('id').primaryKey().defaultRandom(),
  service: varchar('service', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
