import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { webSearchTool } from "./webSearchTool";

const COMPETITORS_FOR_REVIEWS = [
  "Watershed",
  "Persefoni",
  "Greenly",
  "carbmee",
  "osapiens",
  "Sweep",
  "Normative"
];

export const userReviewsResearchTool = createTool({
  id: "user-reviews-research-tool",
  description:
    "Uses AI-powered web search (Perplexity + SerpAPI) to find recent customer reviews and feedback for Carbon Accounting Software competitors (Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative) from G2, forums, Reddit, Twitter, and other platforms. Calendar-month filtering: includes all reviews from the current month (e.g., all November reviews throughout November). More reliable than HTML scraping for finding actual review content.",
  
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
    logger?.info('⭐ [userReviewsResearchTool] Starting user reviews analysis using web search:', {
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
      // OPTIMIZED APPROACH: Single batched search for ALL competitors to avoid rate limits
      // Instead of 7 sequential searches (which hit Perplexity rate limits), do ONE comprehensive search
      const competitorList = COMPETITORS_FOR_REVIEWS.join(", ");
      const query = `G2 reviews user feedback ${context.currentMonth} for carbon accounting software: ${competitorList}. Include pros cons ratings customer experience for each competitor`;
      
      logger?.info(`🔍 [userReviewsResearchTool] Batched web search for all competitors:`, { query });
      
      const searchResult = await webSearchTool.execute({
        context: { query },
        runtimeContext,
        mastra,
      });
      
      if (searchResult.answer) {
        logger?.info(`✅ [userReviewsResearchTool] Found batched reviews (${searchResult.answer.length} chars)`);
        
        // Store batched results - agent will parse per-competitor insights
        // Each competitor gets the same search results (agent extracts relevant parts)
        const sharedSnippet = searchResult.answer.substring(0, 5000);
        
        for (const company of COMPETITORS_FOR_REVIEWS) {
          competitors.push({
            company,
            platforms: [{
              platform: "Web Search (G2, Forums, Social Media)",
              recentReviews: [{
                sentiment: "neutral", // Agent will analyze
                keyThemes: [],
                snippet: sharedSnippet, // Shared search results, agent extracts relevant parts
              }],
              commonPros: [],
              commonCons: [],
            }],
          });
        }
        
        logger?.info(`✅ [userReviewsResearchTool] User reviews search complete:`, {
          competitorsAnalyzed: competitors.length,
          note: 'Single batched search avoids rate limits - agent will extract per-competitor insights'
        });
      } else {
        logger?.warn('⚠️ [userReviewsResearchTool] No reviews found in batched search');
      }
    } catch (error) {
      logger?.error('❌ [userReviewsResearchTool] Failed to search reviews:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    return {
      competitors,
      overallSentiment: {}, // Agent will populate from analysis
      totalReviewsAnalyzed: competitors.length,
      researchDate: new Date().toISOString(),
    };
  },
});
