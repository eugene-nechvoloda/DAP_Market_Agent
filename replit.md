# Overview

This project is a Mastra-based AI agent automation platform for **Carbon Accounting Software Market Research**. It automatically researches 7 key competitors (Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative), analyzes industry trends, aggregates user reviews from G2 and keyword-based web searches, generates comprehensive weekly reports using GPT-5, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

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
- **Intelligent Timespan Filtering**: Content filtering based on publication frequency: 7-day for general news, 1-month for product updates and case studies, current calendar month for press releases and user reviews.
- **Metric Extraction**: Captures funding, valuation, revenue, employees, customer count, churn rate, user base, and user growth rates. Trend calculation logic implemented with ▲▼━🆕 indicators.
- **Report Generation**: Uses GPT-5 for synthesis, ensuring inline citations with URL validation and strict anti-hallucination rules.
- **Google Docs Export**: Utilizes a two-phase pipeline for native table insertion and cell population, ensuring correct data representation.
- **Keyword Analysis**: Detects rising keywords with historical comparison (50% growth threshold) and extracts source URLs.
- **User Feedback**: Uses AI-powered web search (Perplexity/SerpAPI) to find user reviews from G2, forums, Reddit, and Twitter. G2 review URLs stored in database, but actual content fetched via web search because G2 loads reviews dynamically via JavaScript (not accessible via simple HTTP fetch). Web search is more reliable for finding actual review content from dynamically-loaded pages.

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