import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const REVIEW_SOURCES = [
  { company: "WalkMe", url: "https://www.g2.com/products/walkme/reviews?qs=pros-and-cons", platform: "G2", type: "user_reviews" },
  { company: "WhatFix", url: "https://www.g2.com/products/whatfix/reviews?qs=pros-and-cons", platform: "G2", type: "user_reviews" },
  { company: "Pendo", url: "https://www.g2.com/products/pendo-io-pendo/reviews?qs=pros-and-cons", platform: "G2", type: "user_reviews" },
  { company: "Apty", url: "https://www.g2.com/products/apty/reviews?qs=pros-and-cons", platform: "G2", type: "user_reviews" },
  { company: "WalkMe", url: "https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/walkme/product/walkme-digital-adoption-platform/reviews", platform: "Gartner", type: "user_reviews" },
  { company: "WhatFix", url: "https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/whatfix/product/whatfix-digital-adoption-platform/reviews", platform: "Gartner", type: "user_reviews" },
  { company: "Pendo", url: "https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/pendo/product/pendo/reviews", platform: "Gartner", type: "user_reviews" },
  { company: "Apty", url: "https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/apty/product/apty/reviews", platform: "Gartner", type: "user_reviews" },
];

export const userReviewsResearchTool = createTool({
  id: "user-reviews-research-tool",
  description:
    "Analyzes recent customer reviews from G2 and Gartner for DAP competitors (WalkMe, WhatFix, Pendo, Apty) to identify satisfaction patterns, feature feedback, and competitive positioning.",
  
  inputSchema: z.object({
    dateStart: z.string().describe("Start date for filtering reviews (YYYY-MM-DD format)"),
    dateEnd: z.string().describe("End date for filtering reviews (YYYY-MM-DD format)"),
  }),
  
  outputSchema: z.object({
    competitors: z.array(
      z.object({
        company: z.string(),
        platforms: z.array(
          z.object({
            platform: z.string(),
            recentReviews: z.array(
              z.object({
                sentiment: z.enum(["positive", "neutral", "negative"]),
                keyThemes: z.array(z.string()),
                snippet: z.string(),
              })
            ),
            commonPros: z.array(z.string()),
            commonCons: z.array(z.string()),
          })
        ),
      })
    ),
    overallSentiment: z.record(z.string(), z.string()),
    totalReviewsAnalyzed: z.number(),
    researchDate: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('⭐ [userReviewsResearchTool] Starting user reviews analysis:', {
      dateStart: context.dateStart,
      dateEnd: context.dateEnd,
    });
    
    const competitors: Array<{
      company: string;
      platforms: Array<{
        platform: string;
        recentReviews: Array<{
          sentiment: "positive" | "neutral" | "negative";
          keyThemes: string[];
          snippet: string;
        }>;
        commonPros: string[];
        commonCons: string[];
      }>;
    }> = [];
    
    // Group sources by company
    const sourcesByCompany = REVIEW_SOURCES.reduce((acc, source) => {
      if (!acc[source.company]) {
        acc[source.company] = [];
      }
      acc[source.company].push(source);
      return acc;
    }, {} as Record<string, typeof REVIEW_SOURCES>);
    
    let totalReviewsAnalyzed = 0;
    
    for (const [company, sources] of Object.entries(sourcesByCompany)) {
      logger?.info(`⭐ [userReviewsResearchTool] Analyzing reviews for ${company}...`);
      
      const platforms: Array<{
        platform: string;
        recentReviews: Array<{
          sentiment: "positive" | "neutral" | "negative";
          keyThemes: string[];
          snippet: string;
        }>;
        commonPros: string[];
        commonCons: string[];
      }> = [];
      
      for (const source of sources) {
        try {
          logger?.info(`🔗 [userReviewsResearchTool] Fetching reviews from ${source.platform} for ${company}`);
          
          const response = await fetch(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; DAPMarketResearch/1.0)',
            },
          });
          
          if (!response.ok) {
            logger?.warn(`⚠️ [userReviewsResearchTool] HTTP error for ${source.platform}:`, {
              status: response.status,
            });
            continue;
          }
          
          const html = await response.text();
          const cleanText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Store raw content for agent analysis
          // Agent will extract sentiment, themes, pros/cons, and filter by date
          platforms.push({
            platform: source.platform,
            recentReviews: [{
              sentiment: "neutral",
              keyThemes: [],
              snippet: cleanText.substring(0, 5000), // First 5000 chars for agent analysis
            }],
            commonPros: [], // Agent will populate from analysis
            commonCons: [], // Agent will populate from analysis
          });
          
          totalReviewsAnalyzed++;
          logger?.info(`✅ [userReviewsResearchTool] Fetched reviews from ${source.platform} (${cleanText.length} chars)`);
        } catch (error) {
          logger?.warn(`⚠️ [userReviewsResearchTool] Failed to fetch reviews from ${source.platform}:`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      if (platforms.length > 0) {
        competitors.push({ company, platforms });
      }
    }
    
    logger?.info('✅ [userReviewsResearchTool] User reviews fetched:', {
      competitorsAnalyzed: competitors.length,
      totalReviewsAnalyzed,
      note: 'Raw content fetched - agent will analyze sentiment, themes, pros/cons, and filter by date'
    });
    
    return {
      competitors,
      overallSentiment: {}, // Agent will populate from analysis
      totalReviewsAnalyzed,
      researchDate: new Date().toISOString(),
    };
  },
});
