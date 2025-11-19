import { pgTable, serial, text, timestamp, integer, boolean, numeric, jsonb, date, varchar, uniqueIndex, index } from 'drizzle-orm/pg-core';

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
  reportContent: text('report_content'), // Full markdown report text for history
  reportContentHtml: text('report_content_html'), // Full HTML report for web version
});

// Settings table to store user configuration
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Competitor metrics table for time-series tracking
export const competitorMetrics = pgTable('competitor_metrics', {
  id: serial('id').primaryKey(),
  competitorSlug: varchar('competitor_slug', { length: 50 }).notNull(), // walkme, whatfix, pendo, apty
  reportingWeekStart: date('reporting_week_start').notNull(), // ISO date for Monday of the week
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  
  // Owler metrics (revenue, valuation, employees)
  revenueUsd: numeric('revenue_usd', { precision: 18, scale: 2 }),
  valuationUsd: numeric('valuation_usd', { precision: 18, scale: 2 }),
  employeeCount: integer('employee_count'),
  revenueRange: text('revenue_range'),
  owlerRawPayload: jsonb('owler_raw_payload'),
  owlerSuccess: boolean('owler_success').default(false).notNull(),
  
  // Crunchbase metrics (funding, investments)
  fundingTotalUsd: numeric('funding_total_usd', { precision: 18, scale: 2 }),
  lastRoundAmountUsd: numeric('last_round_amount_usd', { precision: 18, scale: 2 }),
  lastRoundType: text('last_round_type'),
  lastRoundDate: date('last_round_date'),
  investorCount: integer('investor_count'),
  fundingRounds: jsonb('funding_rounds'), // Array of funding round objects
  crunchbaseRawPayload: jsonb('crunchbase_raw_payload'),
  crunchbaseSuccess: boolean('crunchbase_success').default(false).notNull(),
  
  // Semrush metrics (web traffic, SEO)
  organicTraffic: integer('organic_traffic'),
  organicKeywords: integer('organic_keywords'),
  semrushRank: integer('semrush_rank'),
  semrushDatabase: varchar('semrush_database', { length: 10 }), // us, uk, etc.
  semrushRawPayload: jsonb('semrush_raw_payload'),
  semrushSuccess: boolean('semrush_success').default(false).notNull(),
  
  // Customer health metrics
  customerCount: integer('customer_count'),
  churnRate: numeric('churn_rate', { precision: 6, scale: 2 }), // Percentage
  retentionRate: numeric('retention_rate', { precision: 6, scale: 2 }), // Percentage
  userBase: integer('user_base'), // Number of active users
  userGrowthRate: numeric('user_growth_rate', { precision: 6, scale: 2 }), // Percentage growth rate
  
  // Metadata
  dataSourceVersion: text('data_source_version'), // Version of tools used
  missingSources: text('missing_sources').array(), // List of failed sources
  error: text('error'), // Overall error message if any
}, (table) => ({
  // Unique constraint: one record per competitor per reporting week
  uniqCompetitorWeek: uniqueIndex('competitor_metrics_slug_week_idx').on(table.competitorSlug, table.reportingWeekStart),
  // Index for efficient queries: get latest metrics per competitor
  competitorWeekIdx: index('idx_competitor_week_desc').on(table.competitorSlug, table.reportingWeekStart.desc()),
}));

// Market metrics table for aggregate DAP market data
export const marketMetrics = pgTable('market_metrics', {
  id: serial('id').primaryKey(),
  reportingWeekStart: date('reporting_week_start').notNull().unique(), // ISO date for Monday of the week
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  
  // Market-level metrics
  marketSizeUsd: numeric('market_size_usd', { precision: 18, scale: 2 }),
  yoyGrowthPct: numeric('yoy_growth_pct', { precision: 6, scale: 2 }), // Year-over-year growth %
  totalSearchVolume: integer('total_search_volume'), // Aggregate search interest
  aggregateFundingUsd: numeric('aggregate_funding_usd', { precision: 18, scale: 2 }),
  
  // Metadata
  dataSources: text('data_sources').array(), // List of sources used
  rawPayload: jsonb('raw_payload'), // Full raw data for debugging
  success: boolean('success').default(false).notNull(),
  error: text('error'),
});

// Keyword occurrences table for emerging market trend detection
export const keywordOccurrences = pgTable('keyword_occurrences', {
  id: serial('id').primaryKey(),
  keyword: text('keyword').notNull(), // The term/phrase (normalized to lowercase)
  reportingWeekStart: date('reporting_week_start').notNull(), // ISO date for Monday of the week
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  
  // Frequency and context
  frequency: integer('frequency').notNull().default(1), // How many times it appeared this week
  contextType: text('context_type').notNull(), // Where it appeared: competitor_news, market_data, industry_reports, etc.
  
  // First seen tracking
  firstSeenAt: date('first_seen_at').notNull(), // When this keyword was first detected across all weeks
  
  // Metadata
  sourceUrls: text('source_urls').array(), // URLs where this keyword appeared
  rawContext: jsonb('raw_context'), // Full context snippets for debugging
}, (table) => ({
  // Unique constraint: one record per keyword per context type per reporting week
  uniqKeywordContextWeek: uniqueIndex('keyword_context_week_idx').on(table.keyword, table.contextType, table.reportingWeekStart),
  // Index for efficient queries: get latest keywords and historical comparison
  keywordWeekIdx: index('idx_keyword_week_desc').on(table.keyword, table.reportingWeekStart.desc()),
}));
