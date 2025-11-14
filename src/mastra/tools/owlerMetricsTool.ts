import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const owlerMetricsTool = createTool({
  id: "owler-metrics-tool",
  description:
    "Fetches real company metrics from Owler API including revenue estimates, valuation, employee count, and CEO information for competitor health assessment. Requires company name or website URL.",
  
  inputSchema: z.object({
    companyName: z.string().describe("Company name to look up (e.g., 'WalkMe', 'WhatFix')"),
    websiteUrl: z.string().optional().describe("Company website URL for more accurate lookup (optional)"),
  }),
  
  outputSchema: z.object({
    companyName: z.string(),
    revenue: z.number().optional().describe("Estimated annual revenue in USD"),
    formattedRevenue: z.string().optional().describe("Human-readable revenue (e.g., '69.4B')"),
    revenueRange: z.string().optional().describe("Revenue range bracket"),
    employeeCount: z.number().optional().describe("Total employee count"),
    employeeRange: z.string().optional().describe("Employee count range"),
    totalFunding: z.number().optional().describe("Total funding raised in USD"),
    formattedFunding: z.string().optional().describe("Human-readable funding amount"),
    ownership: z.string().optional().describe("Public or Private status"),
    ceoName: z.string().optional().describe("CEO name"),
    ceoRating: z.number().optional().describe("CEO approval rating"),
    dataSource: z.string().describe("Data source identifier"),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('💼 [owlerMetricsTool] Starting Owler metrics lookup for:', { companyName: context.companyName });
    
    try {
      const apiKey = process.env.OWLER_API_KEY;
      if (!apiKey) {
        logger?.warn('⚠️ [owlerMetricsTool] OWLER_API_KEY not configured - returning mock placeholder');
        
        // Return graceful fallback when API key is not available
        return {
          companyName: context.companyName,
          dataSource: 'Owler API (not configured)',
          success: false,
          error: 'OWLER_API_KEY not configured - please set up API key to fetch real metrics',
        };
      }

      logger?.info('🔍 [owlerMetricsTool] Making Owler API request...');
      
      // Owler CompanyAPI - search by name
      const searchUrl = `https://api.owler.com/v1/company/search?q=${encodeURIComponent(context.companyName)}`;
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Owler API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Extract company data from search results (usually first result is most relevant)
      const companyData = data.companies?.[0] || data;
      
      if (!companyData || Object.keys(companyData).length === 0) {
        logger?.warn('⚠️ [owlerMetricsTool] No company data found for:', context.companyName);
        return {
          companyName: context.companyName,
          dataSource: 'Owler API',
          success: false,
          error: `No company data found for "${context.companyName}"`,
        };
      }

      const result = {
        companyName: companyData.name || context.companyName,
        revenue: companyData.revenue,
        formattedRevenue: companyData.formatted_revenue,
        revenueRange: companyData.revenue_range,
        employeeCount: companyData.employee_count,
        employeeRange: companyData.employee_range,
        totalFunding: companyData.total_funding,
        formattedFunding: companyData.formatted_funding,
        ownership: companyData.ownership,
        ceoName: companyData.ceo_detail?.name,
        ceoRating: companyData.ceo_detail?.approval_rating,
        dataSource: 'Owler API',
        success: true,
      };

      logger?.info('✅ [owlerMetricsTool] Owler metrics retrieved:', {
        companyName: result.companyName,
        revenue: result.formattedRevenue,
        employees: result.employeeRange,
      });
      
      return result;
    } catch (error) {
      logger?.error('❌ [owlerMetricsTool] Failed to fetch Owler metrics:', {
        companyName: context.companyName,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        companyName: context.companyName,
        dataSource: 'Owler API',
        success: false,
        error: `Failed to fetch Owler metrics: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
