import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const semrushMetricsTool = createTool({
  id: "semrush-metrics-tool",
  description:
    "Fetches real website traffic and SEO metrics from Semrush API including organic traffic, keyword rankings, backlinks, and authority score for competitor health assessment. Requires domain name.",
  
  inputSchema: z.object({
    domain: z.string().describe("Company domain (e.g., 'walkme.com', 'whatfix.com')"),
    database: z.string().optional().default("us").describe("Country database code (default: 'us')"),
  }),
  
  outputSchema: z.object({
    domain: z.string(),
    semrushRank: z.number().optional().describe("Global Semrush rank"),
    organicTraffic: z.number().optional().describe("Monthly organic search traffic estimate"),
    organicKeywords: z.number().optional().describe("Number of organic keywords ranking"),
    organicTrafficCost: z.number().optional().describe("Estimated cost of organic traffic if bought via ads (USD)"),
    paidTraffic: z.number().optional().describe("Monthly paid search traffic estimate"),
    paidKeywords: z.number().optional().describe("Number of paid keywords"),
    dataSource: z.string().describe("Data source identifier"),
    database: z.string().describe("Country database used"),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [semrushMetricsTool] Starting Semrush traffic lookup for:', { domain: context.domain });
    
    try {
      const apiKey = process.env.SEMRUSH_API_KEY;
      if (!apiKey) {
        logger?.warn('⚠️ [semrushMetricsTool] SEMRUSH_API_KEY not configured - returning mock placeholder');
        
        // Return graceful fallback when API key is not available
        return {
          domain: context.domain,
          database: context.database || 'us',
          dataSource: 'Semrush API (not configured)',
          success: false,
          error: 'SEMRUSH_API_KEY not configured - please set up API key to fetch real metrics',
        };
      }

      logger?.info('🔍 [semrushMetricsTool] Making Semrush API request...');
      
      // Semrush Analytics API - Domain Ranks (traffic overview)
      // Using the base API endpoint (not /analytics/v1/)
      // Supported columns for domain_ranks: Dn,Rk,Or,Ot,Oc,Ad,At,Cr,Np,Dr,Dt
      // Note: Backlinks (Bl), Referring Domains (Rd), Authority Score (As) require separate API calls
      const baseUrl = 'https://api.semrush.com/';
      const params = new URLSearchParams({
        key: apiKey,
        type: 'domain_ranks',
        domain: context.domain,
        database: context.database || 'us',
        export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At',
      });
      
      logger?.debug('[semrushMetricsTool] Request URL:', `${baseUrl}?${params.toString()}`);
      
      const response = await fetch(`${baseUrl}?${params.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger?.error('❌ [semrushMetricsTool] Semrush API returned error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 500),
        });
        throw new Error(`Semrush API error: ${response.status} - ${errorText}`);
      }

      const rawData = await response.text();
      logger?.debug('[semrushMetricsTool] Raw API response:', rawData.substring(0, 500));
      
      // Parse CSV-like response (Semrush returns semicolon-separated values)
      const lines = rawData.trim().split('\n');
      if (lines.length < 2) {
        logger?.warn('⚠️ [semrushMetricsTool] No data found for domain:', {
          domain: context.domain,
          linesCount: lines.length,
          rawResponse: rawData.substring(0, 200),
        });
        return {
          domain: context.domain,
          database: context.database || 'us',
          dataSource: 'Semrush API',
          success: false,
          error: `No traffic data found for domain "${context.domain}". The domain may not have sufficient data in Semrush database or the database code may be incorrect.`,
        };
      }
      
      // First line is headers, second line is data
      const headers = lines[0].split(';');
      const values = lines[1].split(';');
      
      // Map headers to values
      const dataMap: Record<string, string> = {};
      headers.forEach((header, index) => {
        dataMap[header] = values[index] || '';
      });
      
      // Parse metrics (Semrush column codes)
      // Dn=Domain, Rk=Rank, Or=Organic Traffic, Ot=Organic Keywords,
      // Oc=Organic Traffic Cost, Ad=Paid Traffic, At=Paid Keywords
      const result = {
        domain: dataMap.Dn || context.domain,
        semrushRank: dataMap.Rk ? parseInt(dataMap.Rk, 10) : undefined,
        organicTraffic: dataMap.Or ? parseInt(dataMap.Or, 10) : undefined,
        organicKeywords: dataMap.Ot ? parseInt(dataMap.Ot, 10) : undefined,
        organicTrafficCost: dataMap.Oc ? parseFloat(dataMap.Oc) : undefined,
        paidTraffic: dataMap.Ad ? parseInt(dataMap.Ad, 10) : undefined,
        paidKeywords: dataMap.At ? parseInt(dataMap.At, 10) : undefined,
        database: context.database || 'us',
        dataSource: 'Semrush API',
        success: true,
      };

      logger?.info('✅ [semrushMetricsTool] Semrush traffic data retrieved:', {
        domain: result.domain,
        organicTraffic: result.organicTraffic,
        semrushRank: result.semrushRank,
      });
      
      return result;
    } catch (error) {
      logger?.error('❌ [semrushMetricsTool] Failed to fetch Semrush data:', {
        domain: context.domain,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        domain: context.domain,
        database: context.database || 'us',
        dataSource: 'Semrush API',
        success: false,
        error: `Failed to fetch Semrush data: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
