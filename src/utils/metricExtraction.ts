import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

const anthropic = createAnthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

export interface ExtractedMetrics {
  competitorSlug: string;
  revenueUsd?: number;
  revenueRange?: string;
  valuationUsd?: number;
  fundingTotalUsd?: number;
  lastRoundAmountUsd?: number;
  lastRoundType?: string;
  lastRoundDate?: string;
  employeeCount?: number;
  customerCount?: number;
  churnRate?: number;
  retentionRate?: number;
  userBase?: number;
  userGrowthRate?: number;
  sourceUrls: string[];
  rawContext: string;
}

/**
 * Uses LLM to extract financial metrics from search result text
 */
export async function extractMetricsFromText(
  searchResults: string,
  competitorNames: string[],
  logger?: any
): Promise<ExtractedMetrics[]> {
  logger?.info('🔍 [MetricExtraction] Extracting metrics from search results...');
  
  const prompt = `You are a financial data extraction expert. Extract company metrics from the following search results.

COMPETITOR NAMES TO LOOK FOR:
${competitorNames.join(', ')}

SEARCH RESULTS:
${searchResults}

EXTRACTION RULES:
1. Extract ONLY factual data with explicit mentions (e.g., "raised $50M", "valued at $1B", "500 customers")
2. Convert all monetary values to USD numbers (e.g., "$50M" → 50000000, "€20M" → ~22000000)
3. For revenue ranges (e.g., "$10M-$50M"), store as revenueRange and estimate midpoint for revenueUsd
4. Extract customer counts (e.g., "1,000 customers" → 1000, "500+ clients" → 500)
5. Extract churn/retention rates as percentages (e.g., "5% churn" → 5, "95% retention" → 95)
6. Extract user base counts (e.g., "10,000 active users" → 10000, "5K users" → 5000)
7. Extract user growth rates as percentages (e.g., "15% user growth" → 15, "grew users by 20%" → 20)
8. Include source context and dates when available
9. Return null for any metric not found (do NOT guess or estimate)
10. Use competitor slug format: lowercase, hyphens (e.g., "Greenly" → "greenly")

OUTPUT FORMAT (JSON array):
[
  {
    "competitorSlug": "greenly",
    "revenueUsd": 50000000,
    "revenueRange": "$40M-$60M",
    "valuationUsd": 2000000000,
    "fundingTotalUsd": 150000000,
    "lastRoundAmountUsd": 50000000,
    "lastRoundType": "Series C",
    "lastRoundDate": "2024-11-01",
    "employeeCount": 200,
    "customerCount": 1000,
    "churnRate": 5,
    "retentionRate": 95,
    "userBase": 10000,
    "userGrowthRate": 15,
    "sourceUrls": ["https://techcrunch.com/..."],
    "rawContext": "Greenly raised $50M in Series C funding with 1,000 customers and 10,000 active users, growing at 15% YoY..."
  }
]

Extract metrics for ALL competitors mentioned in the search results. Return empty array if no metrics found.`;

  try {
    const response = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      prompt,
      temperature: 0.1, // Low temperature for factual extraction
    });

    logger?.info('✅ [MetricExtraction] LLM extraction complete');

    // Parse JSON response
    const text = response.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      logger?.warn('⚠️ [MetricExtraction] No valid JSON array found in LLM response');
      return [];
    }

    const metrics: ExtractedMetrics[] = JSON.parse(jsonMatch[0]);
    logger?.info('✅ [MetricExtraction] Extracted metrics for competitors:', {
      count: metrics.length,
      competitors: metrics.map(m => m.competitorSlug),
    });

    return metrics;
  } catch (error) {
    logger?.error('❌ [MetricExtraction] Failed to extract metrics:', error);
    return [];
  }
}

/**
 * Maps competitor names to database slugs
 */
export function getCompetitorSlug(name: string): string {
  const slugMap: Record<string, string> = {
    'watershed': 'watershed',
    'persefoni': 'persefoni',
    'greenly': 'greenly',
    'carbmee': 'carbmee',
    'carbmee eis': 'carbmee',
    'osapiens': 'osapiens',
    'sweep': 'sweep',
    'normative': 'normative',
  };

  const normalized = name.toLowerCase().trim();
  return slugMap[normalized] || normalized.replace(/\s+/g, '-');
}

/**
 * Get all competitor slugs
 */
export function getAllCompetitorSlugs(): string[] {
  return [
    'watershed',
    'persefoni',
    'greenly',
    'carbmee',
    'osapiens',
    'sweep',
    'normative',
  ];
}

/**
 * Get all competitor names
 */
export function getAllCompetitorNames(): string[] {
  return [
    'Watershed',
    'Persefoni',
    'Greenly',
    'carbmee',
    'osapiens',
    'Sweep',
    'Normative',
  ];
}
