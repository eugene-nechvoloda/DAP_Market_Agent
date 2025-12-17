import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

/**
 * Input schema for competitor spotlight generation
 */
export const CompetitorSpotlightInputSchema = z.object({
  competitor: z.string(),
  strategicMoves: z.array(z.object({
    text: z.string(),
    source: z.string(),
    url: z.string().url(),
    date: z.string(),
    confidence: z.number().min(0).max(100),
  })).optional(),
  productUpdates: z.array(z.object({
    text: z.string(),
    source: z.string(),
    url: z.string().url(),
    date: z.string(),
    confidence: z.number().min(0).max(100),
  })).optional(),
  partnerships: z.array(z.object({
    text: z.string(),
    source: z.string(),
    url: z.string().url(),
    date: z.string(),
    confidence: z.number().min(0).max(100),
  })).optional(),
  userFeedback: z.array(z.object({
    text: z.string(),
    source: z.string(),
    platform: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
  })).optional(),
});

/**
 * Output schema for competitor spotlight
 */
export const CompetitorSpotlightOutputSchema = z.object({
  markdown: z.string(),
  citationCount: z.number(),
  citationsUsed: z.array(z.string().url()),
  hasContent: z.boolean(),
});

export type CompetitorSpotlightInput = z.infer<typeof CompetitorSpotlightInputSchema>;
export type CompetitorSpotlightOutput = z.infer<typeof CompetitorSpotlightOutputSchema>;

/**
 * ReportWriterAgent - Specialized agent for generating high-quality report sections
 *
 * Focused prompt (50 lines vs 330-line monolith)
 * Structured input/output with Zod validation
 * Single responsibility: Write one report section
 */
export const reportWriterAgent = new Agent({
  name: "Report Writer Agent",

  instructions: `# Role
You are a professional market research report writer. Generate one competitor spotlight section.

# Input Data
You receive pre-validated, structured data for a single competitor:
- strategicMoves: Recent fundings, acquisitions, announcements
- productUpdates: New features, product launches
- partnerships: New partnerships and integrations
- userFeedback: Aggregated user review themes

# Task
Generate a competitor spotlight section in markdown format.

## Structure

### {Competitor Name}

Only include subsections if data exists:

#### Strategic Moves
[Write 1-2 sentences per strategic move with inline citation]
Example: "Pendo secured $50M in Series B funding ([PR Newswire](https://example.com))."

#### Product Updates
[Write 1-2 sentences per product update with inline citation]
Example: "WalkMe launched AI-powered user guidance system ([WalkMe Blog](https://example.com))."

#### Partnerships & Integrations
[Write 1-2 sentences per partnership with inline citation]
Example: "Pendo partnered with Salesforce for native integration ([Pendo Newsroom](https://example.com))."

#### User Feedback
[Summarize 2-3 key themes from user reviews]
Example: "Users on G2 praise the intuitive onboarding builder but request better analytics dashboard ([G2 Reviews](https://example.com))."

# Citation Format
MANDATORY: Every factual sentence must have an inline citation.
Format: "Text here ([Source Name](url))."

# Rules
1. If no data for a subsection, omit it entirely (don't write "No data")
2. Maximum 2-4 sentences per item
3. No speculation or inference beyond provided data
4. If NO data for entire competitor, return ONLY: "_No new updates this period._"
5. Be concise and factual
6. Every claim needs a citation

# Output
Return only the markdown text for this competitor section.
Do not include explanations or metadata.`,

  model: openai.responses("gpt-4o"),

  tools: {},
});

/**
 * Executive Summary Input Schema
 */
export const ExecutiveSummaryInputSchema = z.object({
  competitorHighlights: z.array(z.object({
    competitor: z.string(),
    highlight: z.string(),
    source: z.string().url(),
  })),
  marketTrends: z.array(z.object({
    trend: z.string(),
    source: z.string().url(),
  })),
  strategicImplications: z.array(z.object({
    implication: z.string(),
    source: z.string().url(),
  })),
});

export const ExecutiveSummaryOutputSchema = z.object({
  markdown: z.string(),
  citationCount: z.number(),
});

export type ExecutiveSummaryInput = z.infer<typeof ExecutiveSummaryInputSchema>;
export type ExecutiveSummaryOutput = z.infer<typeof ExecutiveSummaryOutputSchema>;

/**
 * Executive Summary Writer Agent
 */
export const executiveSummaryAgent = new Agent({
  name: "Executive Summary Writer Agent",

  instructions: `# Role
You are a strategic business analyst writing executive summaries.

# Input Data
You receive:
- competitorHighlights: Key developments from each competitor
- marketTrends: Broader market trends
- strategicImplications: Business implications

# Task
Generate a concise executive summary (3-4 key insights, max 300 words).

Focus on:
1. Most significant competitor moves
2. Emerging market trends
3. Strategic implications for product strategy

# Format
Write 3-4 bullet points, each 2-3 sentences.
Each bullet must have inline citations.

Example:
"WalkMe's AI-powered guidance launch signals industry shift toward automation ([WalkMe News](https://example.com)). This creates pressure on competitors to accelerate AI roadmaps, particularly in onboarding personalization."

# Rules
1. Be strategic, not just factual
2. Focus on business implications
3. Every claim needs a citation
4. Maximum 300 words total
5. No filler or generic statements`,

  model: openai.responses("gpt-4o"),

  tools: {},
});

/**
 * Market Data Section Writer Agent
 */
export const marketDataAgent = new Agent({
  name: "Market Data Writer Agent",

  instructions: `# Role
You are a market research analyst writing market data sections.

# Input Data
You receive search results about:
- Market size and growth rates
- Investment trends and funding
- Analyst forecasts

# Task
Generate a "Overall Market Data" section with these subsections (only if data exists):

## Key Market Trends
[2-3 bullet points about market growth, size, CAGR]

## Strategic Implications
[2-3 bullet points about what this means for the industry]

## Market Trajectory Analysis
[1-2 sentences about future projections]

# Rules
1. Every statistic needs a citation
2. Format: "The DAP market grew 25% QoQ reaching $2.4B ([Gartner Report](https://example.com))."
3. If no market data found, write: "_No new market data available this period._"
4. Be concise (max 200 words)
5. Focus on recent data only`,

  model: openai.responses("gpt-4o"),

  tools: {},
});
