# Overview

This project is a Mastra-based AI agent automation platform for **Digital Adoption Platform (DAP) Market Research**. It automatically researches 5 key competitors and analyzes industry trends from 6 major research sources, aggregates user reviews from G2 and Gartner, generates comprehensive weekly reports using GPT-5, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform aims to provide automated, in-depth market analysis for the Digital Adoption Platform industry, leveraging AI agents for data gathering and report generation, and integrating with external services for output and notifications. It is designed to deliver verifiable, factual market insights regularly. Key capabilities include flexible timespan filtering, robust metric extraction (funding, revenue, employees, user base, churn), and comprehensive report generation with inline citations and native Google Docs tables.

## Recent Changes

**November 25, 2025 (Latest)**: Migrated system to user-specified 5-competitor DAP market (WalkMe, Whatfix, Pendo, Appcues, Apty). Updated all constants, workflow logic, metric extraction, and database sources with 23 competitor-specific URLs including G2 reviews, Gartner reviews/likes-dislikes, case studies, newsrooms, analyst reports, and changelogs. New category system includes: news, case_studies, analyst_reports, changelog, g2_reviews, gartner_reviews, gartner_likes_dislikes with appropriate timeFilters (7days, 1month, current_month, quarter).

**November 24, 2025**: Added dedicated market data and industry reports search step (`searchMarketDataAndReports`) to the workflow. This new step uses Perplexity/SerpAPI to search for market size, growth rates, CAGR, analyst forecasts (Forrester, Gartner), and industry reports. Uses intelligent timespans (current month for market data snapshots, general news timespan for industry reports). Results are stored in `webSearchResults.marketDataSearch` and `webSearchResults.industryReportsSearch` and fed to the agent for populating the "Overall Market Data" and "Recent Industry Reports & Analysis" sections of the report. This enhancement provides more comprehensive market intelligence beyond competitor-specific data.

**November 24, 2025**: Fixed 504 Gateway Timeout issue in agent step by reducing `maxSteps` from 5 to 1 in `weeklyMarketResearchWorkflow.ts`. The agent now receives all necessary data pre-processed (per-competitor intelligence from Claude Sonnet 4.5, metrics from database, curated sources) in the prompt, eliminating the need for additional tool calls during report generation. This optimization reduces execution time from 2-3 minutes to under 60 seconds, preventing Inngest HTTP timeouts.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework

The application is built on **Mastra v0.20.0**, a TypeScript framework for AI applications, providing an agent system, workflow engine, memory management, and a type-safe tool system.

## Agent Architecture

The system uses **agent networks with routing delegation**, where a top-level routing agent delegates tasks to specialized agents. Agents utilize `generateLegacy()` for compatibility and are configured with specific instructions, model selection, and tool access, with memory enabled at thread or resource level. The `dapMarketResearchAgent` orchestrates research and report generation.

## Workflow Architecture

Workflows are built using **step-based composition** with explicit data flow, defined via `createStep()` with Zod validation. Workflows use `.then()`, `.parallel()`, and `.map()` for control flow, supporting suspend/resume. The `weeklyMarketResearchWorkflow` demonstrates multi-step research automation and agent coordination.

## Durability Layer

Inngest provides **durable execution** for workflows, ensuring step memoization, retry logic, real-time monitoring, and suspend/resume capabilities.

## Memory & State Management

The system uses a storage abstraction supporting PostgreSQL (production with pgvector) and LibSQL (local development). Memory types include conversation history, semantic recall (RAG-based retrieval), and working memory (persistent scratchpad), scoped by `thread` and `resource`.

## Model Integration

A provider-agnostic **model router pattern** is implemented via the AI SDK, supporting OpenAI (GPT-4o, GPT-4o-mini, GPT-5), Anthropic (Claude Sonnet 4.5), and OpenRouter. Model selection is per-agent, with GPT-5 used for report generation, Claude Sonnet 4.5 for structured parsing/extraction, and GPT-4o-mini for metric extraction.

## Trigger System

The system supports **time-based (cron) triggers** for scheduled workflows via Inngest and **webhook triggers** for external service integrations.

## Logging & Observability

A custom PinoLogger provides **JSON-formatted structured logging** with configurable log levels. Inngest dashboard offers workflow execution visibility.

## UI/UX Decisions

Web report pages include sticky header navigation with a dropdown selector and a "Back to Dashboard" link. Google Docs exports use native tables for enhanced presentation and include automated footers with web version links. Error handling includes displaying "Data not available" for missing metrics.

## Feature Specifications

- **Data Architecture (Option B)**: Perplexity/SerpAPI searches as PRIMARY data source, with curated HTML scraping as supplementary context. Per-competitor searches provide factual, grounded intelligence for each of 5 competitors.
- **Per-Competitor Intelligence**: Individual Perplexity/SerpAPI searches for each competitor (WalkMe, Whatfix, Pendo, Appcues, Apty) with 5 citations each, ensuring factual per-competitor data.
- **Claude Sonnet 4.5 Parsing**: Uses Claude for structured extraction from clean Perplexity/SerpAPI answers into per-competitor categories (strategicMoves, productUpdates, partnerships, userFeedback).
- **Competitor Research**: User-specified URLs per competitor including newsrooms, case studies, press releases, product updates, analyst reports, changelogs, G2 reviews, and Gartner reviews/likes-dislikes. Total of 23 active competitor sources with category-specific timeFilters.
- **Industry Research Sources**: 6 curated sources for DAP market: Gartner Digital Adoption Platforms, G2 DAP Category, Product-Led Alliance, SaaS Industry News, UserOnboard, Product Management Insider.
- **Intelligent Timespan Filtering**: GPT-5-powered context-aware date range determination for content.
- **Metric Extraction**: Captures funding, valuation, revenue, employees, customer count, churn rate, user base, and user growth rates with trend indicators.
- **Report Generation**: Uses GPT-5 for synthesis, ensuring inline citations with URL validation and strict anti-hallucination rules.
- **Google Docs Export**: Utilizes a two-phase pipeline for native table insertion and cell population.
- **Keyword Analysis**: Detects rising keywords with historical comparison (50% growth threshold) and extracts source URLs.
- **User Feedback**: Uses AI-powered web search (Perplexity/SerpAPI) to find user reviews from G2, forums, Reddit, and Twitter.

## Technical Limitations

### G2 Review Scraping
G2 pages with `#reviews` anchors load content dynamically via JavaScript. Direct scraping would require a headless browser. The current solution uses AI-powered web search to access indexed review content, which is more reliable for dynamic content.

# External Dependencies

## AI/LLM Services
- **OpenAI API**: Primary LLM provider (GPT-5 for reports, GPT-4o-mini for extraction).
- **Anthropic API**: Claude Sonnet 4.5 for structured parsing and extraction.
- **OpenRouter**: Multi-provider AI access.
- **Perplexity API**: Primary data source for per-competitor intelligence, AI-powered search with citations via `webSearchTool`.
- **SerpAPI**: Fallback search provider when Perplexity rate limits are reached.

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