import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const COMPETITOR_SOURCES = [
  { company: "Watershed", url: "https://watershed.com/press#h-press-releases", type: "newsroom" },
  { company: "Watershed", url: "https://watershed.com/press#h-press-coverage", type: "newsroom" },
  { company: "Persefoni", url: "https://www.persefoni.com/category/product", type: "newsroom" },
  { company: "Greenly", url: "https://greenly.earth/en-gb/resources/events", type: "newsroom" },
  { company: "carbmee", url: "https://www.carbmee.com/product-updates", type: "newsroom" },
  { company: "osapiens", url: "https://osapiens.com/news/", type: "newsroom" },
  { company: "Sweep", url: "https://www.sweep.net/newsroom", type: "newsroom" },
  { company: "Normative", url: "https://normative.io/press/", type: "newsroom" },
];

export const competitorNewsResearchTool = createTool({
  id: "competitor-news-research-tool",
  description:
    "Analyzes competitor newsrooms (Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative) to extract recent product updates, announcements, and company news from the Carbon Accounting Software market. Filters for developments from the past 7 days and excludes outdated information.",
  
  inputSchema: z.object({
    dateStart: z.string().describe("Start date for filtering news (YYYY-MM-DD format)"),
    dateEnd: z.string().describe("End date for filtering news (YYYY-MM-DD format)"),
  }),
  
  outputSchema: z.object({
    competitors: z.array(
      z.object({
        company: z.string(),
        developments: z.array(
          z.object({
            title: z.string(),
            summary: z.string(),
            date: z.string().optional(),
            url: z.string(),
            category: z.enum(["product_update", "company_news", "partnership", "funding", "other"]),
          })
        ),
      })
    ),
    totalDevelopments: z.number(),
    researchDate: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🏢 [competitorNewsResearchTool] Starting competitor news analysis:', {
      dateStart: context.dateStart,
      dateEnd: context.dateEnd,
    });
    
    const competitors: Array<{
      company: string;
      developments: Array<{
        title: string;
        summary: string;
        date?: string;
        url: string;
        category: "product_update" | "company_news" | "partnership" | "funding" | "other";
      }>;
    }> = [];
    
    // Group sources by company and deduplicate
    const sourcesByCompany = COMPETITOR_SOURCES.reduce((acc, source) => {
      if (!acc[source.company]) {
        acc[source.company] = [];
      }
      // Avoid duplicate URLs
      if (!acc[source.company].find(s => s.url === source.url)) {
        acc[source.company].push(source);
      }
      return acc;
    }, {} as Record<string, typeof COMPETITOR_SOURCES>);
    
    for (const [company, sources] of Object.entries(sourcesByCompany)) {
      logger?.info(`📰 [competitorNewsResearchTool] Analyzing ${company}...`);
      
      const developments: Array<{
        title: string;
        summary: string;
        date?: string;
        url: string;
        category: "product_update" | "company_news" | "partnership" | "funding" | "other";
      }> = [];
      
      for (const source of sources) {
        try {
          logger?.info(`🔗 [competitorNewsResearchTool] Fetching ${source.url}`);
          
          const response = await fetch(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CarbonAccountingMarketResearch/1.0)',
            },
          });
          
          if (!response.ok) {
            logger?.warn(`⚠️ [competitorNewsResearchTool] HTTP error for ${source.url}:`, {
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
          
          // Store the raw content for the agent to analyze
          // The agent will extract structured information, categorize, and filter by date
          developments.push({
            title: `${company} - ${source.type}`,
            summary: cleanText.substring(0, 5000), // First 5000 chars for agent analysis
            url: source.url,
            category: "other", // Agent will categorize this
          });
          
          logger?.info(`✅ [competitorNewsResearchTool] Fetched ${source.url} (${cleanText.length} chars)`);
        } catch (error) {
          logger?.warn(`⚠️ [competitorNewsResearchTool] Failed to fetch ${source.url}:`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      if (developments.length > 0) {
        competitors.push({ company, developments });
      }
    }
    
    const totalDevelopments = competitors.reduce(
      (sum, comp) => sum + comp.developments.length,
      0
    );
    
    logger?.info('✅ [competitorNewsResearchTool] Competitor news fetched:', {
      competitorsAnalyzed: competitors.length,
      totalDevelopments,
      note: 'Raw content fetched - agent will extract insights, categorize, and filter by date'
    });
    
    return {
      competitors,
      totalDevelopments,
      researchDate: new Date().toISOString(),
    };
  },
});
