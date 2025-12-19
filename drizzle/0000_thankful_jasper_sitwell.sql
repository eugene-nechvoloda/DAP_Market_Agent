CREATE TABLE "competitor_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_slug" varchar(50) NOT NULL,
	"reporting_week_start" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revenue_usd" numeric(18, 2),
	"valuation_usd" numeric(18, 2),
	"employee_count" integer,
	"revenue_range" text,
	"owler_raw_payload" jsonb,
	"owler_success" boolean DEFAULT false NOT NULL,
	"funding_total_usd" numeric(18, 2),
	"last_round_amount_usd" numeric(18, 2),
	"last_round_type" text,
	"last_round_date" date,
	"investor_count" integer,
	"funding_rounds" jsonb,
	"crunchbase_raw_payload" jsonb,
	"crunchbase_success" boolean DEFAULT false NOT NULL,
	"organic_traffic" integer,
	"organic_keywords" integer,
	"semrush_rank" integer,
	"semrush_database" varchar(10),
	"semrush_raw_payload" jsonb,
	"semrush_success" boolean DEFAULT false NOT NULL,
	"customer_count" integer,
	"churn_rate" numeric(6, 2),
	"retention_rate" numeric(6, 2),
	"user_base" integer,
	"user_growth_rate" numeric(6, 2),
	"data_source_version" text,
	"missing_sources" text[],
	"error" text
);
--> statement-breakpoint
CREATE TABLE "competitor_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_slug" varchar(50) NOT NULL,
	"source_name" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"time_filter" text DEFAULT '7days',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_name" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"time_filter" text DEFAULT '1month',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "industry_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "keyword_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL,
	"reporting_week_start" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"context_type" text NOT NULL,
	"first_seen_at" date NOT NULL,
	"source_urls" text[],
	"raw_context" jsonb
);
--> statement-breakpoint
CREATE TABLE "market_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporting_week_start" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"market_size_usd" numeric(18, 2),
	"yoy_growth_pct" numeric(6, 2),
	"total_search_volume" integer,
	"aggregate_funding_usd" numeric(18, 2),
	"data_sources" text[],
	"raw_payload" jsonb,
	"success" boolean DEFAULT false NOT NULL,
	"error" text,
	CONSTRAINT "market_metrics_reporting_week_start_unique" UNIQUE("reporting_week_start")
);
--> statement-breakpoint
CREATE TABLE "report_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"title" text NOT NULL,
	"date_start" text NOT NULL,
	"date_end" text NOT NULL,
	"google_docs_url" text,
	"slack_notification_sent" boolean DEFAULT false,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"trigger_type" text NOT NULL,
	"report_content" text,
	"report_content_html" text,
	CONSTRAINT "report_history_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "report_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" varchar(255) NOT NULL,
	"competitor_data" jsonb,
	"industry_data" jsonb,
	"reviews_data" jsonb,
	"web_search_results" jsonb,
	"per_competitor_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_sources_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "workflow_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_end" varchar(10) NOT NULL,
	"run_id" varchar(255) NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workflow_locks_date_end_unique" UNIQUE("date_end")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_metrics_slug_week_idx" ON "competitor_metrics" USING btree ("competitor_slug","reporting_week_start");--> statement-breakpoint
CREATE INDEX "idx_competitor_week_desc" ON "competitor_metrics" USING btree ("competitor_slug","reporting_week_start" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_competitor_sources_slug" ON "competitor_sources" USING btree ("competitor_slug");--> statement-breakpoint
CREATE INDEX "idx_competitor_sources_category" ON "competitor_sources" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_industry_sources_category" ON "industry_sources" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_context_week_idx" ON "keyword_occurrences" USING btree ("keyword","context_type","reporting_week_start");--> statement-breakpoint
CREATE INDEX "idx_keyword_week_desc" ON "keyword_occurrences" USING btree ("keyword","reporting_week_start" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_report_sources_run_id" ON "report_sources" USING btree ("run_id");