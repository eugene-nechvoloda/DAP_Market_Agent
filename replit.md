# Overview

This is a **Mastra-based AI agent automation platform** built for Replit, specifically designed for **DAP (Digital Adoption Platform) Market Research**. The system automatically runs every Monday at 8:00 AM CET to research competitors (WalkMe, WhatFix, Pendo, Apty), analyze industry trends, aggregate user reviews, generate comprehensive weekly reports, export them to Google Docs, and send notifications to Slack.

**Current Implementation Status**: ✅ **Production Ready**
- ✅ Time-based cron trigger configured (Monday 8:00 AM CET = "0 7 * * 1" UTC)
- ✅ Data gathering from competitor newsrooms, industry reports (Forrester, TechCrunch, eLearning Industry), and user reviews (Gartner)
- ✅ AI agent analyzes data and compiles comprehensive weekly reports
- ✅ Google Docs export integration (via Replit connector)
- ✅ Slack notification system (requires valid bot token)
- ✅ Graceful error handling and extensive logging
- ✅ Proper separation of concerns: agent handles research, workflow handles orchestration/export/notification

**Recent Changes (November 14, 2025)**:
- Fixed workflow architecture bug where agent prematurely called export/notification tools
- Removed `googleDocsExportTool` and `slackNotificationTool` from agent's available tools
- Agent now only has research tools: `webFetchTool`, `webSearchTool`, `competitorNewsResearchTool`, `industryReportsResearchTool`, `userReviewsResearchTool`
- Export and notification are now handled exclusively by workflow steps (Step 3 and Step 5)
- Fixed workflow data flow to properly pass `dateStart` and `dateEnd` through all steps
- Fixed API route to use Inngest client directly instead of accessing from Mastra instance
- End-to-end testing confirms all 5 workflow steps execute successfully

**Known Limitations**:
- G2 review platform blocks automated access (HTTP 403) - system uses Gartner reviews instead
- Google Docs public sharing requires additional Drive scope (documents created but only accessible to authenticated user)
- Slack notifications require valid `SLACK_BOT_TOKEN` with `chat:write` scope

The application showcases advanced agentic patterns including:
- Multi-step workflow orchestration with durable execution via Inngest
- AI agent with tool calling for intelligent market research analysis
- Proper separation of concerns: agent generates content, workflow handles orchestration
- Time-based automated triggers
- External API integrations (Google Docs, Slack)
- Comprehensive error handling and extensive logging

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework: Mastra

The application is built on **Mastra v0.20.0**, an opinionated TypeScript framework for AI applications that provides:
- **Agent system**: LLM-powered autonomous agents with tool usage and reasoning capabilities
- **Workflow engine**: Graph-based orchestration with explicit step control, branching, and parallel execution
- **Memory management**: Working memory, conversation history, and semantic recall (RAG-based)
- **Tool system**: Type-safe functions that extend agent capabilities

**Key architectural choice**: Mastra over pure AI SDK or LangChain because it provides batteries-included infrastructure for production AI applications with built-in durability, observability, and state management.

## Agent Architecture

**Primary pattern**: Agent networks with routing delegation
- Top-level routing agent analyzes tasks and delegates to specialized agents, workflows, or tools
- Agents use `generateLegacy()` for backward compatibility with Replit Playground UI (required constraint)
- Each agent configured with specific instructions, model selection, and tool access
- Memory enabled per-agent with configurable scope (thread-level or resource-level)

**Example agent**: `dapMarketResearchAgent` orchestrates research across competitor news, industry reports, user reviews, and generates consolidated reports.

## Workflow Architecture

**Pattern**: Step-based composition with explicit data flow
- Steps defined with `createStep()` including input/output schemas (Zod validation)
- Workflows composed using `.then()`, `.parallel()`, `.map()` for control flow
- Support for suspend/resume enables human-in-the-loop interactions
- Snapshots persist execution state for resumability

**Key workflow**: `weeklyMarketResearchWorkflow` demonstrates multi-step research automation with agent coordination.

## Durability Layer: Inngest Integration

**Critical infrastructure decision**: Inngest provides durable execution
- Workflows converted to Inngest functions via `@mastra/inngest` adapter
- Step memoization ensures completed steps aren't re-executed on retry
- Real-time monitoring through Inngest dashboard
- Suspend/resume implemented via Inngest's event system

**Implementation location**: `src/mastra/inngest/` contains custom durability code
- Must preserve Inngest setup in `src/mastra/index.ts` for production deployment
- Inngest CLI (`inngest-cli`) enables local development server

**Rationale**: Without Inngest, workflows would lose state on failure. Inngest provides free retry logic, observability, and resume capability for production reliability.

## Memory & State Management

**Storage abstraction**: Multiple backend support via adapters
- LibSQL (default for local development): `@mastra/libsql` with file or in-memory storage
- PostgreSQL (production): `@mastra/pg` with pgvector extension for semantic search
- Upstash (serverless): `@mastra/upstash` for Redis + Vector

**Memory types implemented**:
1. **Conversation history**: Last N messages (default 10, configurable)
2. **Semantic recall**: RAG-based retrieval of relevant past messages using vector embeddings
3. **Working memory**: Persistent scratchpad for user preferences/context (Markdown or Zod schema)

**Thread & Resource scoping**:
- `thread`: Unique conversation identifier
- `resource`: User/entity owner (enables cross-thread memory persistence)

**Current setup**: SharedPostgresStorage configured in `src/mastra/storage.ts` (inferred from imports)

## Model Integration

**Model router pattern**: Provider-agnostic abstraction via AI SDK
- Supports 600+ models through standardized interface
- Primary providers: OpenAI (`@ai-sdk/openai`), Anthropic, OpenRouter (`@openrouter/ai-sdk-provider`)
- Model selection per-agent: `openai("gpt-4o-mini")` notation
- Environment variable auto-detection: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

**Streaming architecture**: Dual APIs for backward compatibility
- `.stream()`: AI SDK v5 (`LanguageModelV2`) - modern approach
- `.streamLegacy()`: AI SDK v4 (`LanguageModelV1`) - **required for Replit Playground UI**

**Constraint**: Replit Playground requires `generateLegacy()` and `streamLegacy()` methods for UI compatibility.

## Trigger System

**Two trigger types**:
1. **Time-based (cron)**: Scheduled workflows via Inngest
2. **Webhook**: HTTP endpoints for external service integration

**Webhook implementation pattern** (see `src/triggers/`):
- Registration function creates API routes via `registerApiRoute()`
- Handler receives payload, extracts relevant data, invokes workflow/agent
- Examples: Slack, Telegram, WhatsApp integrations
- Generic pattern documented in `docs/triggers/README.md` and `exampleConnectorTrigger.ts`

## Project Structure

```
src/
├── mastra/
│   ├── index.ts              # Main Mastra instance, agent registration
│   ├── inngest/              # Inngest durability customization
│   ├── agents/               # Agent definitions
│   ├── workflows/            # Workflow definitions
│   ├── tools/                # Tool implementations
│   └── storage.ts            # Storage adapter configuration
├── triggers/                 # Webhook trigger handlers
└── global.d.ts               # Type declarations
```

**Key files**:
- `src/mastra/index.ts`: Mastra initialization, logger setup, agent/workflow registration
- `package.json`: Scripts include `mastra dev`, `mastra build` for CLI operations

## Logging & Observability

**Logger implementation**: Custom PinoLogger extending MastraLogger
- Production logger in `src/mastra/index.ts` with ISO timestamps
- JSON-formatted structured logging
- Configurable log levels (DEBUG, INFO, WARN, ERROR)

**Observability**: Inngest dashboard provides workflow execution visibility

## Development Tooling

**TypeScript configuration**: ES2022 modules with bundler resolution
- Strict mode enabled
- No emit (runtime handled by tsx/mastra CLI)

**CLI commands**:
- `mastra dev`: Local development with hot reload
- `mastra build`: Production build
- Prettier for code formatting

**Node requirement**: >= 20.9.0 (specified in engines)

# External Dependencies

## AI/LLM Services
- **OpenAI API**: Primary LLM provider (GPT-4o, GPT-4o-mini models)
- **Anthropic API**: Alternative LLM provider support
- **OpenRouter**: Multi-provider AI access

## Infrastructure Services
- **Inngest**: Durable workflow execution, event orchestration, retry logic
- **PostgreSQL with pgvector**: Production database for memory storage and vector search (via `@mastra/pg`)
- **LibSQL**: Local/development database (via `@mastra/libsql`)
- **Upstash**: Serverless Redis + Vector database option (via `@mastra/upstash`)

## Communication Platforms
- **Slack Web API** (`@slack/web-api`): Webhook triggers, message handling
- **Telegram Bot API**: Webhook integration for bot interactions
- **WhatsApp Business API**: Message sending, webhook handling
- **Google APIs** (`googleapis`): Gmail, Calendar, Drive integrations

## Search & Data
- **Exa.js** (`exa-js`): AI-powered web search API for research automation

## Core Framework Dependencies
- **AI SDK** (`ai` package): Vercel's AI SDK for LLM streaming and tool calling
- **Zod**: Schema validation for inputs/outputs, working memory structure
- **Pino**: High-performance JSON logging

## Development Dependencies
- **Mastra CLI** (`mastra`): Code generation, local development server
- **Inngest CLI** (`inngest-cli`): Local Inngest dev server
- **tsx**: TypeScript execution for Node.js
- **Prettier**: Code formatting
- **TypeScript**: Type checking and compilation