import { z } from 'zod';
import { ScoredContent } from './ContentScorer';
import { OpenAI } from 'openai';

export const ExtractedMetricSchema = z.object({
  type: z.enum(['revenue', 'valuation', 'funding', 'employees', 'customers', 'arr', 'growth_rate', 'churn_rate']),
  value: z.number(),
  unit: z.string().optional(), // e.g., "USD", "M", "B", "%"
  confidence: z.number().min(0).max(100),
  source: z.string(),
  extractedText: z.string(),
});

export const EnrichedContentSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  plainText: z.string(),
  publishDate: z.date().optional(),
  author: z.string().optional(),
  wordCount: z.number(),
  mainContent: z.string(),
  relevanceScore: z.number(),
  qualityScore: z.number(),
  freshnessScore: z.number(),
  sourceCredibilityScore: z.number(),
  overallScore: z.number(),
  scoringReasons: z.array(z.string()),
  entities: z.object({
    companies: z.array(z.string()),
    products: z.array(z.string()),
    people: z.array(z.string()),
    metrics: z.array(ExtractedMetricSchema),
    dates: z.array(z.date()),
  }),
  topics: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

export type ExtractedMetric = z.infer<typeof ExtractedMetricSchema>;
export type EnrichedContent = z.infer<typeof EnrichedContentSchema>;

/**
 * EntityExtractor - Extracts structured entities and metrics from content using LLM
 *
 * Extracts:
 * - Companies mentioned
 * - Products mentioned
 * - People (executives, analysts)
 * - Financial metrics (revenue, valuation, funding)
 * - Operational metrics (employees, customers, ARR)
 * - Dates (announcements, events)
 * - Topics/themes
 * - Sentiment
 */
export class EntityExtractor {
  private openaiClient: OpenAI;

  constructor() {
    this.openaiClient = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });
  }

  /**
   * Enrich scored content with extracted entities
   */
  async enrich(scoredContent: ScoredContent): Promise<EnrichedContent> {
    // Use LLM to extract entities
    const entities = await this.extractEntities(scoredContent);
    const topics = await this.extractTopics(scoredContent);
    const sentiment = await this.analyzeSentiment(scoredContent);

    const enriched: EnrichedContent = {
      ...scoredContent,
      entities,
      topics,
      sentiment,
    };

    return EnrichedContentSchema.parse(enriched);
  }

  /**
   * Extract entities using LLM
   */
  private async extractEntities(content: ScoredContent): Promise<EnrichedContent['entities']> {
    const systemPrompt = `You are an entity extraction specialist. Extract structured entities from the provided text.

Extract:
1. Companies: All company names mentioned
2. Products: All product/service names mentioned
3. People: Names of executives, analysts, or notable figures
4. Metrics: Financial and operational metrics with their values
5. Dates: Important dates mentioned (announcements, events)

Return a JSON object with this exact structure:
{
  "companies": ["Company1", "Company2"],
  "products": ["Product1", "Product2"],
  "people": ["Person1", "Person2"],
  "metrics": [
    {
      "type": "revenue|valuation|funding|employees|customers|arr|growth_rate|churn_rate",
      "value": 100,
      "unit": "M|B|%",
      "confidence": 85,
      "source": "exact quote from text",
      "extractedText": "the company raised $100M"
    }
  ],
  "dates": ["2025-12-17"]
}

Only include entities explicitly mentioned in the text. Do not infer or guess.`;

    const userPrompt = `Title: ${content.title}

Content:
${content.mainContent.substring(0, 3000)}`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const extractedData = JSON.parse(response.choices[0].message.content || '{}');

      // Parse and validate dates
      const dates = (extractedData.dates || [])
        .map((dateStr: string) => {
          try {
            return new Date(dateStr);
          } catch {
            return null;
          }
        })
        .filter((date: Date | null): date is Date => date !== null && !isNaN(date.getTime()));

      return {
        companies: extractedData.companies || [],
        products: extractedData.products || [],
        people: extractedData.people || [],
        metrics: extractedData.metrics || [],
        dates,
      };
    } catch (error) {
      console.error('Entity extraction failed:', error);
      // Return empty entities if extraction fails
      return {
        companies: [],
        products: [],
        people: [],
        metrics: [],
        dates: [],
      };
    }
  }

  /**
   * Extract topics/themes from content
   */
  private async extractTopics(content: ScoredContent): Promise<string[]> {
    const systemPrompt = `You are a topic extraction specialist. Identify the main topics/themes in the text.

Return a JSON array of 3-5 topic strings. Topics should be:
- Concise (2-4 words)
- Specific to the content
- Relevant to Digital Adoption Platforms market

Example: ["AI-powered onboarding", "Product analytics", "User engagement", "Enterprise adoption"]`;

    const userPrompt = `Title: ${content.title}

Content:
${content.mainContent.substring(0, 2000)}`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const data = JSON.parse(response.choices[0].message.content || '{"topics": []}');
      return data.topics || [];
    } catch (error) {
      console.error('Topic extraction failed:', error);
      return [];
    }
  }

  /**
   * Analyze sentiment of content
   */
  private async analyzeSentiment(content: ScoredContent): Promise<'positive' | 'neutral' | 'negative'> {
    const systemPrompt = `You are a sentiment analysis specialist. Analyze the overall sentiment of the text.

Return a JSON object with sentiment classification:
{
  "sentiment": "positive" | "neutral" | "negative"
}

Guidelines:
- "positive": Optimistic, promotional, celebrating success
- "neutral": Factual, objective, informational
- "negative": Critical, concerning, reporting problems`;

    const userPrompt = `Title: ${content.title}

Content:
${content.mainContent.substring(0, 1500)}`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const data = JSON.parse(response.choices[0].message.content || '{"sentiment": "neutral"}');
      return data.sentiment || 'neutral';
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return 'neutral';
    }
  }

  /**
   * Batch enrich multiple content items
   */
  async enrichBatch(scoredContent: ScoredContent[]): Promise<EnrichedContent[]> {
    const enriched: EnrichedContent[] = [];

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < scoredContent.length; i += batchSize) {
      const batch = scoredContent.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(content => this.enrich(content))
      );
      enriched.push(...batchResults);

      // Small delay between batches to respect rate limits
      if (i + batchSize < scoredContent.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return enriched;
  }

  /**
   * Extract metrics using regex patterns (fallback for when LLM fails)
   */
  static extractMetricsRegex(text: string): ExtractedMetric[] {
    const metrics: ExtractedMetric[] = [];

    // Revenue patterns: "$100M revenue", "$1.5B in revenue"
    const revenuePattern = /\$(\d+(?:\.\d+)?)\s*([MB])\s+(?:in\s+)?revenue/gi;
    let match;
    while ((match = revenuePattern.exec(text)) !== null) {
      metrics.push({
        type: 'revenue',
        value: parseFloat(match[1]),
        unit: match[2],
        confidence: 70,
        source: match[0],
        extractedText: match[0],
      });
    }

    // Funding patterns: "raised $50M", "secured $100M in funding"
    const fundingPattern = /(?:raised|secured)\s+\$(\d+(?:\.\d+)?)\s*([MB])/gi;
    while ((match = fundingPattern.exec(text)) !== null) {
      metrics.push({
        type: 'funding',
        value: parseFloat(match[1]),
        unit: match[2],
        confidence: 75,
        source: match[0],
        extractedText: match[0],
      });
    }

    // Valuation patterns: "valued at $1B", "$500M valuation"
    const valuationPattern = /(?:valued at|valuation of)\s+\$(\d+(?:\.\d+)?)\s*([MB])/gi;
    while ((match = valuationPattern.exec(text)) !== null) {
      metrics.push({
        type: 'valuation',
        value: parseFloat(match[1]),
        unit: match[2],
        confidence: 70,
        source: match[0],
        extractedText: match[0],
      });
    }

    // Employee patterns: "500 employees", "team of 1,000"
    const employeePattern = /(\d+(?:,\d+)?)\s+employees/gi;
    while ((match = employeePattern.exec(text)) !== null) {
      metrics.push({
        type: 'employees',
        value: parseInt(match[1].replace(/,/g, '')),
        confidence: 65,
        source: match[0],
        extractedText: match[0],
      });
    }

    // Customer patterns: "10,000 customers", "serving 5K+ customers"
    const customerPattern = /(\d+(?:,\d+)?(?:[KM])?)\s*\+?\s*customers/gi;
    while ((match = customerPattern.exec(text)) !== null) {
      let value = match[1].replace(/,/g, '');
      if (value.endsWith('K')) {
        value = (parseFloat(value.slice(0, -1)) * 1000).toString();
      } else if (value.endsWith('M')) {
        value = (parseFloat(value.slice(0, -1)) * 1000000).toString();
      }
      metrics.push({
        type: 'customers',
        value: parseInt(value),
        confidence: 65,
        source: match[0],
        extractedText: match[0],
      });
    }

    return metrics;
  }
}
