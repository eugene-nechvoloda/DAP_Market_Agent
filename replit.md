# Overview

This project is a Mastra-based AI agent automation platform for **Carbon Accounting Software Market Research**. It automatically researches 7 key competitors and analyzes industry trends from 6 major research sources, aggregates user reviews, generates comprehensive weekly reports using GPT-5, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform aims to provide automated, in-depth market analysis for the Carbon Accounting Software industry, leveraging AI agents for data gathering and report generation, and integrating with external services for output and notifications. It is designed to deliver verifiable, factual market insights for Climatiq.io regularly. Key capabilities include flexible timespan filtering, robust metric extraction (funding, revenue, employees, user base, churn), and comprehensive report generation with inline citations and native Google Docs tables.

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

A provider-agnostic **model router pattern** is implemented via the AI SDK, supporting OpenAI (GPT-4o, GPT-4o-mini) and OpenRouter. Model selection is per-agent, with GPT-5 used for report generation and GPT-4o-mini for metric extraction.

## Trigger System

The system supports **time-based (cron) triggers** for scheduled workflows via Inngest and **webhook triggers** for external service integrations.

## Logging & Observability

A custom PinoLogger provides **JSON-formatted structured logging** with configurable log levels. Inngest dashboard offers workflow execution visibility.

## UI/UX Decisions

Web report pages include sticky header navigation with a dropdown selector and a "Back to Dashboard" link. Google Docs exports use native tables for enhanced presentation and include automated footers with web version links. Error handling includes displaying "Data not available" for missing metrics.

## Feature Specifications

- **Competitor Research**: Expanded to 21 URLs per competitor, covering newsletters, case studies, press releases, insights pages, and newsrooms.
- **Industry Research Sources**: 6 curated sources for carbon accounting standards, news, and policy: GHG Protocol, Carbon Brief, CDP, WRI Climate, Ecosystem Marketplace, UNFCCC.
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