# Overview

This project is a Mastra-based AI agent automation platform for **Carbon Accounting Software Market Research**. It automatically researches 7 key competitors (Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative), analyzes industry trends from 6 major research sources (GHG Protocol, Carbon Brief, CDP, WRI Climate, Ecosystem Marketplace, UNFCCC), aggregates user reviews from G2 and keyword-based web searches, generates comprehensive weekly reports using GPT-5, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform aims to provide automated, in-depth market analysis for the Carbon Accounting Software industry, leveraging AI agents for data gathering and report generation, and integrating with external services for output and notifications. It is designed to deliver verifiable, factual market insights for Climatiq.io regularly. Key capabilities include flexible timespan filtering for various content types (news, product updates, reviews, case studies), robust metric extraction (funding, revenue, employees, user base, churn), and comprehensive report generation with inline citations and native Google Docs tables.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework: Mastra

The application is built on **Mastra v0.20.0**, a TypeScript framework for AI applications, providing an agent system, workflow engine, memory management, and a type-safe tool system for durable, observable, and state-managed production AI applications.

## Agent Architecture

The system uses **agent networks with routing delegation**, where a top-level routing agent delegates tasks to specialized agents or tools. Agents utilize `generateLegacy()` for compatibility with the Replit Playground UI and are configured with specific instructions, model selection, and tool access, with memory enabled at thread or resource level. The `dapMarketResearchAgent` orchestrates research and report generation.

## Workflow Architecture

Workflows are built using **step-based composition** with explicit data flow, defined via `createStep()` with Zod validation. Workflows use `.then()`, `.parallel()`, and `.map()` for control flow, supporting suspend/resume. The `weeklyMarketResearchWorkflow` demonstrates multi-step research automation and agent coordination, with refined steps for competitor metric gathering to prevent timeouts.

## Durability Layer: Inngest Integration

Inngest provides **durable execution** for workflows, ensuring step memoization, retry logic, real-time monitoring, and suspend/resume capabilities for production reliability.

## Memory & State Management

The system uses a storage abstraction supporting PostgreSQL (production with pgvector) and LibSQL (local development). Memory types include conversation history, semantic recall (RAG-based retrieval), and working memory (persistent scratchpad), scoped by `thread` and `resource`.

## Model Integration

A provider-agnostic **model router pattern** is implemented via the AI SDK, supporting OpenAI (GPT-4o, GPT-4o-mini) and OpenRouter. Model selection is per-agent, with GPT-5 used for report generation and GPT-4o-mini for metric extraction.

## Trigger System

The system supports **time-based (cron) triggers** for scheduled workflows via Inngest and **webhook triggers** for external service integrations.

## Logging & Observability

A custom PinoLogger provides **JSON-formatted structured logging** with configurable log levels. Inngest dashboard offers workflow execution visibility.

## UI/UX Decisions

The web report pages include sticky header navigation with a dropdown selector for all reports and a "Back to Dashboard" link. Google Docs exports now use native tables for enhanced presentation and include automated footers with web version links. Error handling includes displaying "Data not available" for missing metrics instead of blank cells.

## Feature Specifications

- **Competitor Research**: Expanded from 8 to 21 URLs per competitor, covering newsletters, case studies, press releases, insights pages, and newsrooms.
- **Industry Research Sources**: 6 curated sources for carbon accounting standards, news, and policy:
  - **GHG Protocol** (https://ghgprotocol.org/) - Global standard for measuring GHG emissions
  - **Carbon Brief** (https://www.carbonbrief.org/) - Science-based climate news
  - **CDP** (https://www.cdp.net/) - Global environmental disclosure system
  - **WRI Climate** (https://www.wri.org/climate) - Climate research and solutions
  - **Ecosystem Marketplace** (https://www.ecosystemmarketplace.com/) - Carbon markets intelligence
  - **UNFCCC** (https://unfccc.int/) - UN climate policy framework
- **Intelligent Timespan Filtering**: GPT-5-powered context-aware date range determination that considers current date position (mid/late month = full current month, early month = late previous month + current month) for general news, product updates, reviews, and press releases. Replaces rigid heuristic rules with adaptive intelligence.
- **Metric Extraction**: Captures funding, valuation, revenue, employees, customer count, churn rate, user base, and user growth rates. Trend calculation logic implemented with ▲▼━🆕 indicators.
- **Report Generation**: Uses GPT-5 for synthesis, ensuring inline citations with URL validation and strict anti-hallucination rules.
- **Google Docs Export**: Utilizes a two-phase pipeline for native table insertion and cell population, ensuring correct data representation.
- **Keyword Analysis**: Detects rising keywords with historical comparison (50% growth threshold) and extracts source URLs.
- **User Feedback**: Uses AI-powered web search (Perplexity/SerpAPI) to find user reviews from G2, forums, Reddit, and Twitter. G2 review URLs stored in database, but actual content fetched via web search because G2 loads reviews dynamically via JavaScript (not accessible via simple HTTP fetch). Web search is more reliable for finding actual review content from dynamically-loaded pages.

## Recent Bug Fixes (November 2025)

### Duplicate Report Generation (Fixed)
- **Problem**: Each workflow run created 2 reports with different content - one empty (#43), one full (#44)
- **Root Cause**: Agent used `threadId: weekly-research-${dateEnd}`, causing multiple runs on same day to share memory thread and accumulate context
- **Fix**: Changed to `threadId: weekly-research-${runId}` for unique memory context per run
- **Impact**: Each workflow execution now produces single, consistent report

### Missing Current-Month Content (Fixed)
- **Problem**: November content from early in month (Watershed CDP partnership, Greenly EcoPilot) excluded from late-month reports
- **Root Cause**: Agent instructions unclear about current-month inclusion, causing overly aggressive date filtering
- **Fix**: Enhanced agent and workflow instructions to "default to inclusion" for all press releases, reviews, and product updates from current calendar month
- **Impact**: Reports now include complete current-month coverage (e.g., all November content when generated on Nov 21)

### Inngest Function ID Collision (Fixed)
- **Problem**: registerCronWorkflow used hardcoded `id: "cron-trigger"` for all workflows
- **Fix**: Changed to unique `id: cron-${workflowId}` per workflow
- **Impact**: Prevents future conflicts when adding multiple cron workflows

### Duplicate Trigger Execution (Fixed - November 21, 2025)
- **Problem**: Reports #45 and #46 created with split content (G2 reviews in one, general news in another)
- **Root Cause**: Inngest function registered with BOTH `{ event: "replit/cron.trigger" }` AND `{ cron: cronExpression }` triggers, causing two executions per cron fire
- **Fix**: Changed to single `{ cron: cronExpression }` trigger only in `registerCronWorkflow`
- **Impact**: Single workflow execution per cron schedule, single report per run

### GPT-5 Intelligent Timespan Filtering (Implemented - November 21, 2025)
- **Feature**: Replaced heuristic date filtering with GPT-5-powered context-aware date range determination
- **Implementation**: New `determineIntelligentTimespans` workflow step uses GPT-5 to decide date ranges based on current date (mid/late month = full current month, early month = late previous month + current month)
- **Benefits**: More flexible and intelligent content inclusion that adapts to calendar context
- **Fallback**: If GPT-5 fails, falls back to sensible defaults (7 days for news, current month for updates/reviews/press)
- **Logging**: GPT-5 reasoning logged for transparency and debugging

### Idempotent Report Writes (Implemented - November 21, 2025)
- **Problem**: Each workflow run created 2 identical reports in web version (Slack showed 1)
- **Root Cause**: No unique constraint on report writes, allowing multiple inserts per workflow execution
- **Fix**: Added `run_id` column with UNIQUE constraint, updated `saveReport` to use `ON CONFLICT (run_id) DO UPDATE` for idempotent writes
- **Impact**: Single report per workflow run, regardless of how many times save step executes

### Content Completeness Guarantees (Implemented - November 21, 2025)
- **Problem**: Reports missing G2 reviews, sustainability tech coverage, and competitor spotlights
- **Root Causes**: (1) trimData truncated curated data to 2-3K chars, cutting off reviews/industry data; (2) Agent prompt didn't require all sections
- **Fix**: (1) Replaced trimData with `createBoundedSummary` using 10-15K char limits and intelligent JSON truncation; (2) Added explicit MUST-fill directives for all mandatory sections; (3) Added competitor coverage logging showing which competitors have data
- **Impact**: All curated data flows to final prompt, agent explicitly required to populate all sections or write "_No data available_" fallback

### Industry Research Sources Database (Implemented - November 21, 2025)
- **Feature**: Added dedicated `industry_sources` table for tracking general carbon accounting industry research sources
- **Implementation**: Created table with columns for source_name, url, description, category, is_active, time_filter
- **Initial Seed Data**: Loaded 6 major sources - GHG Protocol (standards), Carbon Brief (news), CDP (reports), WRI Climate (research), Ecosystem Marketplace (research), UNFCCC (policy)
- **Database Methods**: Added `getAllIndustrySources()` and `getIndustrySourcesByCategory()` to DatabaseService
- **Impact**: Centralized management of industry research URLs, enabling systematic tracking of carbon accounting standards, climate policy, and market intelligence sources

## Technical Limitations

### G2 Review Scraping
G2 pages with `#reviews` anchors load content dynamically via JavaScript. To truly scrape these sections would require a headless browser (Puppeteer/Playwright), which is not available in the current Mastra environment. The current solution uses AI-powered web search which can access the review content that search engines have indexed, but doesn't literally navigate the #reviews anchor. This approach is actually more reliable than HTML scraping for dynamic content.

# External Dependencies

## AI/LLM Services
- **OpenAI API**: Primary LLM provider.
- **OpenRouter**: Multi-provider AI access.
- **Perplexity API**: AI-powered search with citations, used via `webSearchTool`.

## Infrastructure Services
- **Inngest**: Durable workflow execution and event orchestration.
- **PostgreSQL with pgvector**: Production database for memory storage and vector search.
- **LibSQL**: Local development database.

## Communication Platforms
- **Slack Web API**: For notifications and webhook triggers.
- **Google APIs**: For Google Docs export (Drive integration).

## Search & Data
- **Exa.js**: AI-powered web search API.

## Core Framework Dependencies
- **AI SDK**: For LLM streaming and tool calling.
- **Zod**: Schema validation.