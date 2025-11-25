import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const INDUSTRY_SOURCES = [
  {
    source: "Gartner Digital Adoption Platforms",
    url: "https://www.gartner.com/reviews/market/digital-adoption-platforms",
    type: "industry_report",
  },
  {
    source: "G2 Digital Adoption Platform Category",
    url: "https://www.g2.com/categories/digital-adoption-platforms",
    type: "industry_report",
  },
  {
    source: "Product-Led Alliance",
    url: "https://productled.com/blog",
    type: "industry_report",
  },
  {
    source: "SaaS Industry News",
    url: "https://www.saastr.com/blog/",
    type: "industry_report",
  },
  {
    source: "UserOnboard",
    url: "https://www.useronboard.com/blog/",
    type: "industry_report",
  },
  {
    source: "Product Management Insider",
    url: "https://www.productmanagementinsider.com/",
    type: "industry_report",
  },
];

export const industryReportsResearchTool = createTool({
  id: "industry-reports-research-tool",
  description:
    "Analyzes industry reports and analyst content from Gartner, G2, Product-Led Alliance, SaaS Industry News, UserOnboard, and Product Management Insider to identify current Digital Adoption Platform market trends, growth data, investment activity, and emerging opportunities in SaaS and product-led growth.",
  
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
          title: `${industrySource.source} - Digital Adoption Platform Market Analysis`,
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
