/**
 * Data Quality Pipeline
 *
 * This module provides a comprehensive data quality pipeline for processing
 * web-scraped content before AI synthesis.
 *
 * Pipeline stages:
 * 1. Content Extraction - Clean text extraction from HTML
 * 2. Content Scoring - Relevance, quality, freshness, credibility scoring
 * 3. Entity Extraction - Structured entity and metric extraction
 * 4. Citation Validation - URL validation and accessibility checks
 */

export * from './ContentExtractor';
export * from './ContentScorer';
export * from './EntityExtractor';
export * from './CitationValidator';

import { ContentExtractor, type RawContent, type ExtractedContent } from './ContentExtractor';
import { ContentScorer, type ScoredContent } from './ContentScorer';
import { EntityExtractor, type EnrichedContent } from './EntityExtractor';
import { CitationValidator, type ValidatedCitation } from './CitationValidator';

/**
 * DataQualityPipeline - Main orchestrator for the data quality pipeline
 */
export class DataQualityPipeline {
  private entityExtractor: EntityExtractor;

  constructor() {
    this.entityExtractor = new EntityExtractor();
  }

  /**
   * Process raw HTML content through the complete pipeline
   */
  async process(rawContent: RawContent, context?: {
    targetCompetitor?: string;
    targetTopic?: string;
  }): Promise<EnrichedContent | null> {
    // Stage 1: Extract content
    const extracted = ContentExtractor.extract(rawContent);

    // Validate extraction quality
    const qualityCheck = ContentExtractor.validateQuality(extracted);
    if (!qualityCheck.isValid) {
      console.warn(`Content extraction quality issues for ${rawContent.url}:`, qualityCheck.issues);
      // Continue anyway, but log the issues
    }

    // Stage 2: Score content
    const scored = ContentScorer.score(extracted, context);

    // Filter out low-quality content
    if (scored.overallScore < 40) {
      console.info(`Filtering out low-quality content: ${rawContent.url} (score: ${scored.overallScore})`);
      return null;
    }

    // Stage 3: Enrich with entities
    const enriched = await this.entityExtractor.enrich(scored);

    return enriched;
  }

  /**
   * Process multiple raw content items in batch
   */
  async processBatch(rawContents: RawContent[], context?: {
    targetCompetitor?: string;
    targetTopic?: string;
  }): Promise<EnrichedContent[]> {
    const results: EnrichedContent[] = [];

    // Extract and score all content first
    const scored: ScoredContent[] = [];
    for (const rawContent of rawContents) {
      try {
        const extracted = ContentExtractor.extract(rawContent);
        const scoredContent = ContentScorer.score(extracted, context);

        // Filter by minimum score
        if (scoredContent.overallScore >= 40) {
          scored.push(scoredContent);
        }
      } catch (error) {
        console.error(`Failed to extract/score content from ${rawContent.url}:`, error);
      }
    }

    // Apply diversity filter
    const diverse = ContentScorer.ensureDiversity(scored, 5);

    // Get top N by score
    const topScored = ContentScorer.getTopN(diverse, 50);

    // Enrich with entities in batch
    const enriched = await this.entityExtractor.enrichBatch(topScored);

    return enriched;
  }

  /**
   * Validate all citations in enriched content
   */
  static async validateCitations(enrichedContents: EnrichedContent[]): Promise<{
    validatedCitations: Map<string, ValidatedCitation>;
    summary: ReturnType<typeof CitationValidator.getSummary>;
  }> {
    const urls = enrichedContents.map(c => c.url);
    const validated = await CitationValidator.validateBatch(urls);

    const validatedCitations = new Map<string, ValidatedCitation>();
    validated.forEach(v => validatedCitations.set(v.url, v));

    const summary = CitationValidator.getSummary(validated);

    return {
      validatedCitations,
      summary,
    };
  }
}
