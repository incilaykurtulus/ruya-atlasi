import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dreams = sqliteTable("dreams", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  dream: text("dream").notNull(),
  mood: text("mood").notNull().default(""),
  title: text("title").notNull(),
  analysis: text("analysis").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("dreams_device_created_idx").on(table.deviceId, table.createdAt),
]);

export const monthlySummaries = sqliteTable("monthly_summaries", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  month: text("month").notNull(),
  entryCount: integer("entry_count").notNull(),
  summary: text("summary").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("monthly_summaries_device_month_idx").on(table.deviceId, table.month),
]);

export const apiRateLimits = sqliteTable("api_rate_limits", {
  id: text("id").primaryKey(),
  requestCount: integer("request_count").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("api_rate_limits_expires_idx").on(table.expiresAt),
]);
