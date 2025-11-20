# Overview

This project is a Mastra-based AI agent automation platform for **Carbon Accounting Software Market Research**. It automatically researches 7 key competitors (Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative), analyzes industry trends, aggregates user reviews from G2 and keyword-based web searches, generates comprehensive weekly reports using GPT-5, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform is designed to provide automated, in-depth market analysis for the Carbon Accounting Software industry, leveraging AI agents (GPT-5 for report generation, Claude Sonnet 4.5 for research tasks, Perplexity Sonar for web searches) for data gathering and report generation, and integrating with external services for output and notifications. It aims to deliver verifiable, factual market insights for Climatiq.io regularly.

# Recent Changes

## November 20, 2025

### Critical Fixes: Metrics Collection, Report Navigation, and Google Docs Display (Latest)
- **Issue 1 - Empty Health Metrics**: All competitor metrics were NULL in database due to silent Anthropic integration failure
  - **Root Cause**: `metricExtraction.ts` was using unconfigured Anthropic integration which failed silently, returning empty arrays
  - **Fix**: Switched from `createAnthropic()` + `anthropic("claude-sonnet-4-5")` to `createOpenAI()` + `openai("gpt-4o-mini")`
  - **Logging Added**: Extensive logging throughout extraction pipeline to surface failures (prompt length, response snippets, metric previews)
  
- **Issue 2 - Missing Report History Navigation**: Web report pages (`/reports/:reportId`) had no way to navigate to other reports
  - **Fix**: Added sticky header navigation to all report pages with:
    - Dropdown selector showing all reports (latest first)
    - Report title + generation date displayed in dropdown
    - "Back to Dashboard" link
    - Gradient purple background matching dashboard design
  - **Implementation**: Modified `convertMarkdownToHTML()` to accept current report ID and all reports list, always regenerate HTML with fresh navigation
  
- **Issue 3 - Google Docs Empty Cells**: Tables showed blank cells instead of "Data not available" for missing metrics
  - **Root Cause**: Cell population code inserted empty strings for null/undefined values
  - **Fix**: Added type checking and coercion: `typeof rawValue === 'string' ? rawValue.trim() : rawValue != null ? String(rawValue) : ''`
  - **Result**: Now shows "Data not available" matching web version format
  
- **Logging Enhancements**: Added comprehensive debug logging to:
  - Perplexity search results (answer length, preview, citation counts)
  - Metric extraction (prompt size, response snippets, JSON parsing, extracted metrics preview)
  - Database persistence (merged metrics preview, individual metric storage with full values)
  
- **Status**: All three issues fixed and ready for testing. Next workflow run should populate metrics, show proper navigation, and display complete Google Docs tables.

## November 19, 2025

### Health Metrics Expansion
- **Database Schema**: Added `user_base` and `user_growth_rate` columns to `competitor_metrics` table via SQL ALTER TABLE
- **Metric Extraction Enhanced**: Updated extraction rules to capture valuation, user base counts, and user growth rates from web search results
- **Web Search Optimization**: Improved search queries with specific keywords:
  - Funding search: Added "valuation", "company value" keywords with OR logic
  - Revenue search: Added "annual recurring", "financial performance" keywords
  - Customer search: Added "user base", "active users", "user growth" keywords
- **Data Pipeline Fixed**: Updated `persistCompetitorMetrics` workflow step to include `userBase` and `userGrowthRate` when saving metrics to database
- **Agent Report Format**: Updated health assessment table example to display all 8 columns: Competitor, Revenue, Valuation, Funding, Employees, Customer Count, Churn Rate, User Base, User Growth Rate
- **Old References Cleaned**: Removed remaining outdated competitor examples (Trace, workiva) from agent prompts
- **Status**: Data collection pipeline complete; trend calculation logic implemented with ▲▼━🆕 indicators comparing current vs previous week

### Workflow Timeout Fix
- **Issue**: Workflow was encountering 504 timeout errors at the "Gather Competitor Metrics" step due to monolithic execution (3 searches + extractions + persistence in one step)
- **Solution**: Refactored into 4 separate workflow steps for better Inngest checkpoint management:
  1. `searchFundingMetrics` - Searches for funding and valuation data
  2. `searchRevenueMetrics` - Searches for revenue and employee data
  3. `searchCustomerMetrics` - Searches for customer count, churn, and retention data
  4. `persistCompetitorMetrics` - Merges all metrics by competitor slug and persists to database
- **Benefits**: Each step completes in <60 seconds, Inngest can checkpoint progress, failed steps can retry independently
- **Rate Limiting**: Removed in-step 25-second delays since Inngest now provides natural checkpoints between steps

### Major Competitor List Update
- **Competitor List Changed**: Updated from 11 competitors to 7 focused competitors
- **Old List**: Greenly, Workiva, osapiens, carbmee EIS, StepChange, Trace, coolset, Google Carbon Footprint, Persefoni, Carbonze, vaayu
- **New List**: Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative
- **Newsroom URLs Updated**: All competitor newsroom sources updated with verified URLs
- **Review Sources Updated**: All 7 competitors now have verified G2 review page URLs
- **Keyword-Based User Feedback**: Added web search capability to find user feedback from forums, Reddit, Twitter, and other platforms beyond G2

### Model Configuration Update
- **Report Generation**: Changed from Claude Sonnet 4.5 to GPT-5 for final report synthesis
- **Research Tools**: Keeping Claude Sonnet 4.5 for metric extraction and analysis tasks
- **Web Search**: Continuing to use Perplexity Sonar for market research searches
- **Rationale**: GPT-5 provides superior synthesis and report generation quality

### Customer Health Metrics Enhancement
- **Third Web Search Added**: Implemented dedicated search for customer count, churn rate, and retention data
- **Database Schema Extended**: Added `customer_count`, `churn_rate`, and `retention_rate` columns to `competitor_metrics` table
- **Metric Extraction Enhanced**: Updated `extractMetricsFromText` to extract customer health metrics from web search results
- **Workflow Updated**: All three web searches (funding, revenue/employees, customer/churn) run before database persistence
- **Agent Prompt Enhanced**: Metrics formatting now includes customer count, churn, and retention in competitor health data

### Tools & Utilities Updated
- Updated `competitorNewsResearchTool.ts` with new newsroom URLs
- Updated `userReviewsResearchTool.ts` with verified G2 review URLs for all 7 competitors
- Updated `metricExtraction.ts` with new competitor names and slugs, plus customer health metrics extraction
- Updated `dapMarketResearchAgent.ts` with new competitor list in all instructions and web search queries
- Updated `weeklyMarketResearchWorkflow.ts` to use correct 7-competitor list in broad pulse search
- Created `userFeedbackSearchTool.ts` for keyword-based feedback research

## November 17, 2025

### Market Adaptation
- **Market Focus Changed**: Adapted system from DAP (Digital Adoption Platform) market to Carbon Accounting Software market
- **Competitors Updated**: Changed from WalkMe, WhatFix, Pendo, Apty to Greenly, Workiva, osapiens, carbmee EIS, StepChange, Trace, coolset, Google Carbon Footprint, Persefoni, Carbonze, vaayu
- **Company Context**: Now serving Climatiq.io (carbon accounting and management platform company)
- **Agent Instructions**: Updated all market terminology to "Carbon Accounting Software" and "Carbon Accounting and Management Software"
- **Workflow Queries**: Updated search queries and competitor references throughout the system

## November 15, 2025

### Web Version Links (Task 10)
- **Dashboard**: Added "Web Version" column to report history table with links to `/reports/:reportId` for easy browser-based viewing
- **Slack Notifications**: Updated to include both web version (🌐) and Google Docs (📄) links with proper database persistence
- **Google Docs Footer**: Added automated footer insertion with web version link, styled with italic gray text for visual separation

### Keyword Analysis System (Task 9)
- **Database Schema**: Fixed date handling using SQL casting to ensure proper PostgreSQL DATE type storage
- **Keyword Detection**: Implemented rising keyword detection with historical comparison (50% growth threshold)
- **Source URLs**: Added URL extraction and persistence for citation-ready emerging trend insights

### Citation & URL Validation (Task 8)
- **Inline Citations**: Added mandatory citation requirements with URL validation to all report sections
- **Format Examples**: Provided specific citation formats for each section type to guide agent output

### Google Docs Native Tables (Task 7)
- **Two-Phase Export Pipeline**: Implemented placeholder → structure fetch → insertTable → cell population approach
- **Native Tables**: Market Dynamics section now uses Google Docs insertTable API

### Metrics Warehouse & Trend Calculation (Tasks 4-6)
- **External APIs**: Integrated Owler (revenue/valuation), Crunchbase (funding), and Semrush (web traffic)
- **Database Schema**: Created `market_metrics` and `competitor_metrics` tables for time-series trend analysis
- **Trend Formatting**: Implemented `formatTrend()` with proper zero baseline handling

### Report Quality Improvements (Tasks 1-3)
- **Anti-Hallucination**: Added explicit "no data" responses, removed narrative padding, required citations
- **Heading Hierarchy**: Fixed heading structure in both markdown and Google Docs export
- **Agent Instructions**: Updated with strict anti-hallucination rules

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework: Mastra

The application is built on **Mastra v0.20.0**, an opinionated TypeScript framework for AI applications, providing an agent system, workflow engine, memory management, and a type-safe tool system. It was chosen for its batteries-included infrastructure for durable, observable, and state-managed production AI applications.

## Agent Architecture

The system uses **agent networks with routing delegation**. A top-level routing agent analyzes tasks and delegates to specialized agents or tools. Agents utilize `generateLegacy()` for compatibility with the Replit Playground UI and are configured with specific instructions, model selection, and tool access. Each agent has memory enabled with configurable scope (thread-level or resource-level). The `dapMarketResearchAgent` (Carbon Accounting Market Research Agent) orchestrates research and report generation.

## Workflow Architecture

Workflows are built using **step-based composition** with explicit data flow, defined via `createStep()` with Zod validation for input/output schemas. Workflows are composed using `.then()`, `.parallel()`, and `.map()` for control flow, supporting suspend/resume for human-in-the-loop interactions. The `weeklyMarketResearchWorkflow` demonstrates multi-step research automation and agent coordination.

## Durability Layer: Inngest Integration

Inngest provides **durable execution** for workflows, converting them into Inngest functions via the `@mastra/inngest` adapter. This ensures step memoization, retry logic, real-time monitoring, and suspend/resume capabilities, critical for production reliability.

## Memory & State Management

The system uses a storage abstraction supporting multiple backends: PostgreSQL (production with pgvector for semantic search) and LibSQL (local development). Memory types include conversation history, semantic recall (RAG-based retrieval), and working memory (persistent scratchpad). Memory is scoped by `thread` (conversation) and `resource` (user/entity owner).

## Model Integration

A provider-agnostic **model router pattern** is implemented via the AI SDK, supporting OpenAI (GPT-4o, GPT-4o-mini) and OpenRouter. Model selection is per-agent. The Replit Playground UI requires `generateLegacy()` and `streamLegacy()` methods for compatibility.

## Trigger System

The system supports **time-based (cron) triggers** for scheduled workflows via Inngest and **webhook triggers** for external service integrations (e.g., Slack, Telegram, WhatsApp).

## Logging & Observability

A custom PinoLogger provides **JSON-formatted structured logging** with configurable log levels. Inngest dashboard offers workflow execution visibility.

# External Dependencies

## AI/LLM Services
- **OpenAI API**: Primary LLM provider.
- **OpenRouter**: Multi-provider AI access.

## Infrastructure Services
- **Inngest**: Durable workflow execution and event orchestration.
- **PostgreSQL with pgvector**: Production database for memory storage and vector search.
- **LibSQL**: Local development database.

## Communication Platforms
- **Slack Web API**: For notifications and webhook triggers.
- **Google APIs**: For Google Docs export (specifically Drive integration).

## Search & Data
- **Exa.js**: AI-powered web search API.
- **Perplexity API**: AI-powered search with citations, used via `webSearchTool` (rate-limited to 3 requests/min, requires `PERPLEXITY_API_KEY`).

## Core Framework Dependencies
- **AI SDK**: For LLM streaming and tool calling.
- **Zod**: Schema validation.