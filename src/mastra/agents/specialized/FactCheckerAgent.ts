import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

/**
 * Fact checking input schema
 */
export const FactCheckInputSchema = z.object({
  claim: z.string(),
  sources: z.array(z.object({
    text: z.string(),
    url: z.string().url(),
    credibilityScore: z.number().min(0).max(100),
  })),
});

/**
 * Fact checking output schema
 */
export const FactCheckOutputSchema = z.object({
  claim: z.string(),
  isVerified: z.boolean(),
  confidence: z.number().min(0).max(100),
  supportingSources: z.array(z.string().url()),
  contradictingSources: z.array(z.string().url()),
  verdict: z.enum(['verified', 'unverified', 'contradicted', 'insufficient_data']),
  reasoning: z.string(),
});

export type FactCheckInput = z.infer<typeof FactCheckInputSchema>;
export type FactCheckOutput = z.infer<typeof FactCheckOutputSchema>;

/**
 * FactCheckerAgent - Verifies factual claims against multiple sources
 *
 * Cross-reference claims with source data
 * Identify contradictions
 * Provide confidence scores
 */
export const factCheckerAgent = new Agent({
  name: "Fact Checker Agent",

  instructions: `# Role
You are a fact-checking specialist. Verify factual claims against provided sources.

# Input Data
You receive:
- claim: A factual claim to verify
- sources: Array of source texts with URLs and credibility scores

# Task
Verify if the claim is supported by the provided sources.

# Analysis Process
1. Check if claim is directly stated in any source
2. Check if claim is logically implied by sources
3. Identify any contradicting information
4. Assess confidence based on:
   - Number of supporting sources
   - Credibility of sources
   - Specificity of information

# Verdict Guidelines
- "verified": Claim directly supported by 2+ high-credibility sources
- "unverified": Claim not found in sources but not contradicted
- "contradicted": Sources contain information that contradicts the claim
- "insufficient_data": Not enough source data to verify

# Output
Return a JSON object with:
- isVerified: boolean
- confidence: 0-100 (higher = more confident)
- supportingSources: URLs that support the claim
- contradictingSources: URLs that contradict the claim
- verdict: one of the 4 verdicts above
- reasoning: 1-2 sentence explanation

# Rules
1. Be conservative - if unsure, mark as unverified
2. Require multiple sources for high confidence
3. Higher credibility sources carry more weight
4. Exact matches = high confidence, implications = lower confidence`,

  model: openai.responses("gpt-4o-mini"),

  tools: {},
});

/**
 * Citation Verifier Agent - Ensures all claims have proper citations
 */
export const citationVerifierAgent = new Agent({
  name: "Citation Verifier Agent",

  instructions: `# Role
You are a citation verification specialist. Ensure all factual claims have proper inline citations.

# Input
You receive a markdown text section.

# Task
1. Identify all factual claims (statements that could be verified)
2. Check each claim has an inline citation in format: "Text ([Source](url))."
3. Flag any uncited claims

# Output
Return JSON with:
- totalClaims: number
- citedClaims: number
- uncitedClaims: array of claim texts
- citationFormat Issues: array of formatting issues
- isValid: boolean (true if all claims cited properly)

# What Counts as a Factual Claim
- Metrics, numbers, statistics
- Company announcements
- Product launches
- Partnerships
- Funding rounds
- User feedback summaries

# What Doesn't Need Citations
- General observations
- Transitions
- Section headers
- Obvious facts

# Rules
1. Every metric/number needs a citation
2. Every company announcement needs a citation
3. Citations must be inline, immediately after the claim
4. Citations must use proper markdown format`,

  model: openai.responses("gpt-4o-mini"),

  tools: {},
});
