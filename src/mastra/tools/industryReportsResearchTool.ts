import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const INDUSTRY_SOURCES = [
  {
    source: "Forrester",
    url: "https://www.forrester.com/allSearch?query=digital%20adoption%20platform&activeTab=blogs&sortOrder=desc&publishedSinceInDays=30&sortType=relevance&accessOnly=false&isFuzzyNeeded=true",
    type: "industry_report",
  },
  {
    source: "TechCrunch",
    url: "https://techcrunch.com/?s=digital+adoption+platforms",
    type: "industry_report",
  },
  {
    source: "VentureBeat",
    url: "https://venturebeat.com/search/digital%20adoption%20platform",
    type: "industry_report",
  },
  {
    source: "eLearning Industry",
    url: "https://elearningindustry.com/mastering-learning-in-the-flow-of-work-with-digital-adoption-platforms",
    type: "industry_report",
  },
];

export const industryReportsResearchTool = createTool({
  id: "industry-reports-research-tool",
  description:
    "Analyzes industry reports and analyst content from Forrester, TechCrunch, VentureBeat, and eLearning Industry to identify current DAP market trends, growth data, investment activity, and emerging opportunities.",
  
  inputSchema: z.object({
    dateStart: z.string().describe("Start date for filtering reports (YYYY-MM-DD format)"),
    dateEnd: z.string().describe("End date for filtering reports (YYYY-MM-DD format)"),
  }),
  
  outputSchema: z.object({
    reports: z.array(
      z.object({
        source: z.string(),
        title: z.string(),
        summary: z.string(),
        keyInsights: z.array(z.string()),
        url: z.string(),
        publicationDate: z.string().optional(),
      })
    ),
    marketTrends: z.array(z.string()),
    investmentActivity: z.array(z.string()),
    totalReports: z.number(),
    researchDate: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [industryReportsResearchTool] Starting industry reports analysis:', {
      dateStart: context.dateStart,
      dateEnd: context.dateEnd,
    });
    
    const reports: Array<{
      source: string;
      title: string;
      summary: string;
      keyInsights: string[];
      url: string;
      publicationDate?: string;
    }> = [];
    
    const marketTrends: string[] = [];
    const investmentActivity: string[] = [];
    
    for (const industrySource of INDUSTRY_SOURCES) {
      try {
        logger?.info(`📰 [industryReportsResearchTool] Fetching ${industrySource.source}...`);
        
        const response = await fetch(industrySource.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DAPMarketResearch/1.0)',
          },
        });
        
        if (!response.ok) {
          logger?.warn(`⚠️ [industryReportsResearchTool] HTTP error for ${industrySource.source}:`, {
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
        // The agent will extract market trends, investment activity, and filter by date
        reports.push({
          source: industrySource.source,
          title: `${industrySource.source} - DAP Market Analysis`,
          summary: cleanText.substring(0, 5000), // First 5000 chars for agent analysis
          keyInsights: [], // Agent will populate this
          url: industrySource.url,
        });
        
        logger?.info(`✅ [industryReportsResearchTool] Fetched ${industrySource.source} (${cleanText.length} chars)`);
      } catch (error) {
        logger?.warn(`⚠️ [industryReportsResearchTool] Failed to fetch ${industrySource.source}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    logger?.info('✅ [industryReportsResearchTool] Industry reports fetched:', {
      totalReports: reports.length,
      note: 'Raw content fetched - agent will extract trends, investment activity, and filter by date'
    });
    
    return {
      reports,
      marketTrends, // Agent will populate these from analysis
      investmentActivity, // Agent will populate these from analysis
      totalReports: reports.length,
      researchDate: new Date().toISOString(),
    };
  },
});
