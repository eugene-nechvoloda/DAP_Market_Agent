# Overview

This project is a Mastra-based AI agent automation platform for **DAP (Digital Adoption Platform) Market Research**. It automatically researches competitors (WalkMe, WhatFix, Pendo, Apty), analyzes industry trends, aggregates user reviews, generates comprehensive weekly reports, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform is designed to provide automated, in-depth market analysis for the DAP industry, leveraging AI agents for data gathering and report generation, and integrating with external services for output and notifications. It aims to deliver verifiable, factual market insights to users regularly.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework: Mastra

The application is built on **Mastra v0.20.0**, an opinionated TypeScript framework for AI applications, providing an agent system, workflow engine, memory management, and a type-safe tool system. It was chosen for its batteries-included infrastructure for durable, observable, and state-managed production AI applications.

## Agent Architecture

The system uses **agent networks with routing delegation**. A top-level routing agent analyzes tasks and delegates to specialized agents or tools. Agents utilize `generateLegacy()` for compatibility with the Replit Playground UI and are configured with specific instructions, model selection, and tool access. Each agent has memory enabled with configurable scope (thread-level or resource-level). The `dapMarketResearchAgent` orchestrates research and report generation.

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