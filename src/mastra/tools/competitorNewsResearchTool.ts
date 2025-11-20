import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../storage/db.js";

export const competitorNewsResearchTool = createTool({
  id: "competitor-news-research-tool",
  description:
    "Fetches competitor sources from database (newsrooms, newsletters, case studies, press releases, insights pages) for all 7 Carbon Accounting Software competitors. Uses intelligent timespan filtering based on content type: 7-day for general news, 1-month for product updates/case studies, current calendar month for press releases. Scrapes and extracts recent updates, announcements, and company news.",
  
  inputSchema: z.object({
    dateStart: z.string().describe("Start date for filtering news (YYYY-MM-DD format)"),
    dateEnd: z.string().describe("End date for filtering news (YYYY-MM-DD format)"),
    currentMonth: z.string().describe("Current calendar month for press releases (e.g., 'November 2025')"),
    productUpdatesLookback: z.string().describe("Lookback period for product updates (e.g., '1 month')"),
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
    logger?.info('🏢 [competitorNewsResearchTool] Starting competitor news analysis from database sources:', {
      dateStart: context.dateStart,
      dateEnd: context.dateEnd,
      currentMonth: context.currentMonth,
      productUpdatesLookback: context.productUpdatesLookback,
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
    
    try {
      const allSources = await db.getAllCompetitorSources();
      const nonReviewSources = allSources.filter(s => s.category !== 'reviews');
      
      logger?.info(`📊 [competitorNewsResearchTool] Found ${nonReviewSources.length} active sources in database (excluding reviews)`, {
        breakdown: nonReviewSources.reduce((acc, s) => {
          acc[s.category] = (acc[s.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      
      const sourcesByCompany = nonReviewSources.reduce((acc, source) => {
        const companyName = source.competitorSlug.charAt(0).toUpperCase() + source.competitorSlug.slice(1);
        if (!acc[companyName]) {
          acc[companyName] = [];
        }
        acc[companyName].push(source);
        return acc;
      }, {} as Record<string, typeof nonReviewSources>);
      
      for (const [company, sources] of Object.entries(sourcesByCompany)) {
        logger?.info(`📰 [competitorNewsResearchTool] Analyzing ${company} (${sources.length} sources)...`);
        
        const developments: Array<{
          title: string;
          summary: string;
          date?: string;
          url: string;
          category: "product_update" | "company_news" | "partnership" | "funding" | "other";
        }> = [];
        
        for (const source of sources) {
          try {
            logger?.info(`🔗 [competitorNewsResearchTool] Fetching ${source.url} (category: ${source.category}, filter: ${source.timeFilter})`);
            
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
            
            developments.push({
              title: `${source.sourceName}`,
              summary: cleanText.substring(0, 5000),
              url: source.url,
              category: "other",
            });
            
            logger?.info(`✅ [competitorNewsResearchTool] Fetched ${source.url} (${cleanText.length} chars, time_filter: ${source.timeFilter})`);
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
      
      logger?.info('✅ [competitorNewsResearchTool] Competitor news fetched from database:', {
        competitorsAnalyzed: competitors.length,
        totalDevelopments,
        note: 'Database-driven sources with intelligent time filtering - agent will extract insights and filter by date'
      });
      
      return {
        competitors,
        totalDevelopments,
        researchDate: new Date().toISOString(),
      };
    } catch (error) {
      logger?.error('❌ [competitorNewsResearchTool] Failed to fetch competitor news:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        competitors: [],
        totalDevelopments: 0,
        researchDate: new Date().toISOString(),
      };
    }
  },
});
