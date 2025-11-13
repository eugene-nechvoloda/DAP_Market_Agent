import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// Report history table to track all generated reports
export const reportHistory = pgTable('report_history', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  dateStart: text('date_start').notNull(),
  dateEnd: text('date_end').notNull(),
  googleDocsUrl: text('google_docs_url'),
  slackNotificationSent: boolean('slack_notification_sent').default(false),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  triggerType: text('trigger_type').notNull(), // 'scheduled' or 'manual'
  reportContent: text('report_content'), // Full report text for history
});

// Settings table to store user configuration
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
