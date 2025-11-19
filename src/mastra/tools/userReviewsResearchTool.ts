import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const REVIEW_SOURCES = [
  // G2 Reviews for Carbon Accounting Software competitors (verified URLs)
  { company: "Greenly", url: "https://www.g2.com/products/greenly/reviews", platform: "G2", type: "user_reviews" }, // 35 reviews
  { company: "Workiva", url: "https://www.g2.com/products/workiva-workiva/reviews", platform: "G2", type: "user_reviews" }, // Verified
  { company: "Persefoni", url: "https://www.g2.com/products/persefoni/reviews", platform: "G2", type: "user_reviews" }, // 11 reviews
  
  // Capterra Reviews for additional coverage (verified URLs)
  { company: "Greenly", url: "https://www.capterra.com/p/219931/Greenly-Climate-Dashboard/", platform: "Capterra", type: "user_reviews" },
  
  // Note: The following competitors do not have public review pages on G2/Capterra:
  // - carbmee (enterprise-focused, limited public reviews)
  // - Trace (may be listed but unclear if same product)
  // - osapiens (newer platform, no reviews found)
  // - StepChange (no reviews found)
  // - coolset (no reviews found)
  // - Google Carbon Footprint (part of Google Cloud, no dedicated review page)
  // - Carbonze (no reviews found)
  // - vaayu (no reviews found)
  // The agent will note "No recent user feedback available" for these competitors in the report.
];

export const userReviewsResearchTool = createTool({
  id: "user-reviews-research-tool",
  description:
    "Analyzes recent customer reviews from G2 and Capterra for Carbon Accounting Software competitors (Greenly, Workiva, Persefoni, carbmee, Trace, osapiens, StepChange, coolset, Google Carbon Footprint, Carbonze, vaayu) to identify satisfaction patterns, feature feedback, and competitive positioning.",
  
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
              'User-Agent': 'Mozilla/5.0 (compatible; CarbonAccountingMarketResearch/1.0)',
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
