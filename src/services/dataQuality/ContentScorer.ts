import { z } from 'zod';
import { ExtractedContent } from './ContentExtractor';

export const ScoredContentSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  plainText: z.string(),
  publishDate: z.date().optional(),
  author: z.string().optional(),
  wordCount: z.number(),
  mainContent: z.string(),
  relevanceScore: z.number().min(0).max(100),
  qualityScore: z.number().min(0).max(100),
  freshnessScore: z.number().min(0).max(100),
  sourceCredibilityScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  scoringReasons: z.array(z.string()),
});

export type ScoredContent = z.infer<typeof ScoredContentSchema>;

/**
 * ContentScorer - Scores content based on relevance, quality, freshness, and source credibility
 *
 * Scoring Dimensions:
 * 1. Relevance (0-100): How relevant is the content to DAP market research?
 * 2. Quality (0-100): How well-written and informative is the content?
 * 3. Freshness (0-100): How recent is the content?
 * 4. Source Credibility (0-100): How trustworthy is the source?
 */
export class ContentScorer {
  private static readonly DAP_KEYWORDS = [
    'digital adoption',
    'digital adoption platform',
    'dap',
    'user onboarding',
    'product adoption',
    'walkthrough',
    'in-app guidance',
    'user guidance',
    'product analytics',
    'user analytics',
    'feature adoption',
    'walkme',
    'whatfix',
    'pendo',
    'appcues',
    'apty',
  ];

  private static readonly TIER1_SOURCES = [
    'gartner.com',
    'forrester.com',
    'idc.com',
    'g2.com',
    'techcrunch.com',
    'venturebeat.com',
    'theinformation.com',
  ];

  private static readonly TIER2_SOURCES = [
    'forbes.com',
    'bloomberg.com',
    'reuters.com',
    'wsj.com',
    'ft.com',
  ];

  /**
   * Score extracted content
   */
  static score(
    content: ExtractedContent,
    context?: {
      targetCompetitor?: string;
      targetTopic?: string;
    }
  ): ScoredContent {
    const scoringReasons: string[] = [];

    // Calculate individual scores
    const relevanceScore = this.calculateRelevanceScore(content, context, scoringReasons);
    const qualityScore = this.calculateQualityScore(content, scoringReasons);
    const freshnessScore = this.calculateFreshnessScore(content, scoringReasons);
    const sourceCredibilityScore = this.calculateSourceCredibilityScore(content, scoringReasons);

    // Calculate weighted overall score
    const overallScore = Math.round(
      relevanceScore * 0.35 +
      qualityScore * 0.25 +
      freshnessScore * 0.25 +
      sourceCredibilityScore * 0.15
    );

    const scored: ScoredContent = {
      ...content,
      relevanceScore,
      qualityScore,
      freshnessScore,
      sourceCredibilityScore,
      overallScore,
      scoringReasons,
    };

    return ScoredContentSchema.parse(scored);
  }

  /**
   * Calculate relevance score (0-100)
   */
  private static calculateRelevanceScore(
    content: ExtractedContent,
    context: { targetCompetitor?: string; targetTopic?: string } | undefined,
    reasons: string[]
  ): number {
    let score = 0;
    const text = (content.title + ' ' + content.mainContent).toLowerCase();

    // Check for DAP keywords
    const keywordsFound = this.DAP_KEYWORDS.filter(keyword =>
      text.includes(keyword.toLowerCase())
    );

    const keywordScore = Math.min(100, (keywordsFound.length / this.DAP_KEYWORDS.length) * 200);
    score += keywordScore * 0.6;

    if (keywordsFound.length > 0) {
      reasons.push(`Found ${keywordsFound.length} DAP-related keywords: ${keywordsFound.slice(0, 3).join(', ')}`);
    } else {
      reasons.push('No DAP-related keywords found');
    }

    // Check for target competitor mention
    if (context?.targetCompetitor) {
      if (text.includes(context.targetCompetitor.toLowerCase())) {
        score += 40 * 0.3;
        reasons.push(`Mentions target competitor: ${context.targetCompetitor}`);
      } else {
        reasons.push(`Does not mention target competitor: ${context.targetCompetitor}`);
      }
    }

    // Check for target topic
    if (context?.targetTopic) {
      if (text.includes(context.targetTopic.toLowerCase())) {
        score += 20 * 0.1;
        reasons.push(`Mentions target topic: ${context.targetTopic}`);
      }
    }

    return Math.round(Math.min(100, score));
  }

  /**
   * Calculate quality score (0-100)
   */
  private static calculateQualityScore(
    content: ExtractedContent,
    reasons: string[]
  ): number {
    let score = 50; // Base score

    // Word count check
    if (content.wordCount >= 300 && content.wordCount <= 3000) {
      score += 20;
      reasons.push(`Good word count: ${content.wordCount} words`);
    } else if (content.wordCount < 100) {
      score -= 30;
      reasons.push(`Very short content: ${content.wordCount} words`);
    } else if (content.wordCount > 5000) {
      score -= 10;
      reasons.push(`Very long content: ${content.wordCount} words (may include noise)`);
    }

    // Title quality
    if (content.title && content.title !== 'Untitled' && content.title.length > 10) {
      score += 10;
      reasons.push('Has meaningful title');
    } else {
      score -= 10;
      reasons.push('Missing or poor quality title');
    }

    // Author attribution
    if (content.author) {
      score += 5;
      reasons.push(`Has author attribution: ${content.author}`);
    }

    // Content structure (check for headings, lists, etc.)
    const hasStructure = content.mainContent.length > 500 &&
                         content.mainContent.split('.').length > 5;
    if (hasStructure) {
      score += 15;
      reasons.push('Well-structured content');
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Calculate freshness score (0-100)
   * Recent content gets higher scores
   */
  private static calculateFreshnessScore(
    content: ExtractedContent,
    reasons: string[]
  ): number {
    if (!content.publishDate) {
      reasons.push('No publish date available (assuming moderate freshness)');
      return 50;
    }

    const now = new Date();
    const ageInDays = Math.floor((now.getTime() - content.publishDate.getTime()) / (1000 * 60 * 60 * 24));

    let score: number;

    if (ageInDays <= 7) {
      score = 100;
      reasons.push(`Very fresh: ${ageInDays} days old`);
    } else if (ageInDays <= 30) {
      score = 90 - ((ageInDays - 7) / 23) * 30; // Linear decay from 90 to 60
      reasons.push(`Fresh: ${ageInDays} days old`);
    } else if (ageInDays <= 90) {
      score = 60 - ((ageInDays - 30) / 60) * 30; // Linear decay from 60 to 30
      reasons.push(`Moderately fresh: ${ageInDays} days old`);
    } else if (ageInDays <= 180) {
      score = 30 - ((ageInDays - 90) / 90) * 20; // Linear decay from 30 to 10
      reasons.push(`Aging: ${ageInDays} days old`);
    } else {
      score = 10;
      reasons.push(`Old content: ${ageInDays} days old`);
    }

    return Math.round(score);
  }

  /**
   * Calculate source credibility score (0-100)
   */
  private static calculateSourceCredibilityScore(
    content: ExtractedContent,
    reasons: string[]
  ): number {
    const url = content.url.toLowerCase();

    // Check for tier-1 sources (highest credibility)
    for (const source of this.TIER1_SOURCES) {
      if (url.includes(source)) {
        reasons.push(`Tier-1 source: ${source}`);
        return 100;
      }
    }

    // Check for tier-2 sources (high credibility)
    for (const source of this.TIER2_SOURCES) {
      if (url.includes(source)) {
        reasons.push(`Tier-2 source: ${source}`);
        return 80;
      }
    }

    // Check for official competitor sources
    const competitorDomains = ['walkme.com', 'whatfix.com', 'pendo.io', 'appcues.com', 'apty.ai'];
    for (const domain of competitorDomains) {
      if (url.includes(domain)) {
        reasons.push(`Official competitor source: ${domain}`);
        return 90;
      }
    }

    // Check for review platforms
    if (url.includes('g2.com') || url.includes('gartner.com')) {
      reasons.push('Review platform source');
      return 85;
    }

    // Default credibility
    reasons.push('Standard source credibility');
    return 60;
  }

  /**
   * Filter content based on minimum score threshold
   */
  static filterByScore(
    scoredContent: ScoredContent[],
    minOverallScore: number = 40
  ): ScoredContent[] {
    return scoredContent.filter(content => content.overallScore >= minOverallScore);
  }

  /**
   * Get top N items by score
   */
  static getTopN(
    scoredContent: ScoredContent[],
    n: number = 50
  ): ScoredContent[] {
    return scoredContent
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, n);
  }

  /**
   * Ensure source diversity (don't let one source dominate)
   */
  static ensureDiversity(
    scoredContent: ScoredContent[],
    maxPerSource: number = 5
  ): ScoredContent[] {
    const sourceCount = new Map<string, number>();
    const result: ScoredContent[] = [];

    // Sort by score first
    const sorted = [...scoredContent].sort((a, b) => b.overallScore - a.overallScore);

    for (const content of sorted) {
      const domain = new URL(content.url).hostname;
      const count = sourceCount.get(domain) || 0;

      if (count < maxPerSource) {
        result.push(content);
        sourceCount.set(domain, count + 1);
      }
    }

    return result;
  }
}
