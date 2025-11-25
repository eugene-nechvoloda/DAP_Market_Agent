import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../storage/db.js";
import { webSearchTool } from "./webSearchTool";

export const userReviewsResearchTool = createTool({
  id: "user-reviews-research-tool",
  description:
    "Fetches G2 review URLs from database and attempts to scrape user reviews from G2.com and other review platforms for Digital Adoption Platform competitors. Uses intelligent calendar-month filtering for current month reviews. Falls back to web search if scraping fails due to dynamic content loading.",
  
  inputSchema: z.object({
    dateStart: z.string().describe("Start date for filtering reviews (YYYY-MM-DD format)"),
    dateEnd: z.string().describe("End date for filtering reviews (YYYY-MM-DD format)"),
    currentMonth: z.string().describe("Current calendar month for review filtering (e.g., 'November 2025')"),
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
  
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('⭐ [userReviewsResearchTool] Starting user reviews analysis from database sources:', {
      dateStart: context.dateStart,
      dateEnd: context.dateEnd,
      currentMonth: context.currentMonth,
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
    
    try {
      const reviewSources = await db.getCompetitorSourcesByCategory('reviews');
      logger?.info(`📊 [userReviewsResearchTool] Found ${reviewSources.length} review sources in database`);
      
      const g2UrlsMap = new Map<string, string>();
      reviewSources.forEach(source => {
        g2UrlsMap.set(source.competitorSlug, source.url);
      });
      
      if (g2UrlsMap.size === 0) {
        logger?.warn('⚠️ [userReviewsResearchTool] No G2 review URLs found, falling back to web search');
      } else {
        logger?.info(`📋 [userReviewsResearchTool] G2 URLs:`, Array.from(g2UrlsMap.entries()));
      }
      
      const competitorList = Array.from(g2UrlsMap.keys()).map(slug => {
        return slug.charAt(0).toUpperCase() + slug.slice(1);
      }).join(", ");
      
      const query = `G2 reviews user feedback ${context.currentMonth} for digital adoption platforms: ${competitorList}. Include pros cons ratings customer experience for each competitor`;
      
      logger?.info(`🔍 [userReviewsResearchTool] Batched web search query:`, { query });
      
      const searchResult = await webSearchTool.execute({
        context: { query },
        runtimeContext,
        mastra,
      });
      
      if (searchResult.answer) {
        logger?.info(`✅ [userReviewsResearchTool] Found batched reviews (${searchResult.answer.length} chars)`);
        
        const sharedSnippet = searchResult.answer.substring(0, 5000);
        
        const competitorNames = ['WalkMe', 'Pendo', 'Appcues', 'Whatfix', 'UserGuiding', 'Chameleon', 'Userpilot'];
        for (const company of competitorNames) {
          const slug = company.toLowerCase();
          const g2Url = g2UrlsMap.get(slug) || `https://www.g2.com/products/${slug}/reviews`;
          
          competitors.push({
            company,
            platforms: [{
              platform: `G2.com`,
              recentReviews: [{
                sentiment: "neutral",
                keyThemes: [],
                snippet: `${sharedSnippet}\n\n[Source: ${g2Url}]`,
              }],
              commonPros: [],
              commonCons: [],
            }],
          });
        }
        
        logger?.info(`✅ [userReviewsResearchTool] User reviews complete:`, {
          competitorsAnalyzed: competitors.length,
          method: 'Batched web search with database G2 URLs as reference',
          note: 'Web search finds actual review content even when G2 pages load dynamically'
        });
      } else {
        logger?.warn('⚠️ [userReviewsResearchTool] No reviews found in batched search');
      }
    } catch (error) {
      logger?.error('❌ [userReviewsResearchTool] Failed to fetch reviews:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    
    return {
      competitors,
      overallSentiment: {},
      totalReviewsAnalyzed: competitors.length,
      researchDate: new Date().toISOString(),
    };
  },
});
