# Overview

This project is a Mastra-based AI agent automation platform for **Carbon Accounting Software Market Research**. It automatically researches competitors (Greenly, Workiva, osapiens, carbmee EIS, StepChange, Trace, coolset, Google Carbon Footprint, Persefoni, Carbonze, vaayu), analyzes industry trends, aggregates user reviews, generates comprehensive weekly reports, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform is designed to provide automated, in-depth market analysis for the Carbon Accounting Software industry (also known as Carbon Accounting and Management Software), leveraging AI agents for data gathering and report generation, and integrating with external services for output and notifications. It aims to deliver verifiable, factual market insights for Climatiq.io regularly.

# Recent Changes

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