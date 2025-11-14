import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const crunchbaseMetricsTool = createTool({
  id: "crunchbase-metrics-tool",
  description:
    "Fetches real company funding data from Crunchbase API including total funding raised, number of funding rounds, last funding date, and investment type for competitor health assessment. Requires company permalink (URL slug).",
  
  inputSchema: z.object({
    companyPermalink: z.string().describe("Company permalink/slug from Crunchbase URL (e.g., 'walkme', 'whatfix', 'pendo')"),
  }),
  
  outputSchema: z.object({
    companyName: z.string().optional(),
    companyPermalink: z.string(),
    fundingTotal: z.number().optional().describe("Total funding raised in USD"),
    formattedFunding: z.string().optional().describe("Human-readable total funding"),
    numFundingRounds: z.number().optional().describe("Number of funding rounds"),
    lastFundingType: z.string().optional().describe("Type of last funding round"),
    lastFundingAt: z.string().optional().describe("Date of last funding (YYYY-MM-DD)"),
    fundingRounds: z.array(
      z.object({
        id: z.string(),
        announcedOn: z.string(),
        investmentType: z.string(),
        moneyRaised: z.number().optional(),
        formattedMoneyRaised: z.string().optional(),
      })
    ).optional().describe("List of recent funding rounds"),
    dataSource: z.string().describe("Data source identifier"),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('💰 [crunchbaseMetricsTool] Starting Crunchbase funding lookup for:', { permalink: context.companyPermalink });
    
    try {
      const apiKey = process.env.CRUNCHBASE_API_KEY;
      if (!apiKey) {
        logger?.warn('⚠️ [crunchbaseMetricsTool] CRUNCHBASE_API_KEY not configured - returning mock placeholder');
        
        // Return graceful fallback when API key is not available
        return {
          companyPermalink: context.companyPermalink,
          dataSource: 'Crunchbase API (not configured)',
          success: false,
          error: 'CRUNCHBASE_API_KEY not configured - please set up API key to fetch real metrics',
        };
      }

      logger?.info('🔍 [crunchbaseMetricsTool] Making Crunchbase API request...');
      
      // Crunchbase v4 API - organization lookup with funding data
      const url = `https://api.crunchbase.com/v4/data/entities/organizations/${context.companyPermalink}`;
      const params = new URLSearchParams({
        user_key: apiKey,
        card_ids: 'raised_funding_rounds',
        field_ids: 'funding_total,num_funding_rounds,last_funding_type,last_funding_at,name',
      });
      
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Crunchbase API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Helper functions to handle Crunchbase v4's inconsistent nesting and value wrapping
      const unwrapNode = (node: any): Record<string, any> => {
        if (!node) return {};
        if (typeof node.properties === 'object') return unwrapNode(node.properties);
        return node as Record<string, any>;
      };
      
      const getScalar = (field: any) => 
        field?.value ?? field?.value_localized ?? (typeof field === 'object' ? undefined : field);
      
      const getMoney = (field: any) => 
        field?.value_usd ?? field?.value ?? (typeof field === 'number' ? field : undefined);
      
      const formatMoney = (amount: number | undefined): string | undefined => 
        amount ? `$${(amount / 1_000_000).toFixed(1)}M` : undefined;
      
      // Extract organization properties with defensive unwrapping
      const organization = unwrapNode(data.properties);
      const fundingTotal = getMoney(organization.funding_total);
      const formattedFunding = formatMoney(fundingTotal);
      
      // Extract funding rounds with defensive unwrapping (limit to 5 most recent)
      const fundingRoundsItems = data.cards?.raised_funding_rounds?.items || [];
      const fundingRounds = fundingRoundsItems.slice(0, 5).map((item: any) => {
        const props = unwrapNode(item.properties);
        const moneyRaised = getMoney(props.money_raised);
        
        return {
          id: item.identifier?.uuid || item.uuid || 'unknown',
          announcedOn: getScalar(props.announced_on) || 'Unknown',
          investmentType: getScalar(props.investment_type) || 'Unknown',
          moneyRaised: moneyRaised,
          formattedMoneyRaised: formatMoney(moneyRaised),
        };
      });

      const result = {
        companyName: getScalar(organization.name),
        companyPermalink: context.companyPermalink,
        fundingTotal,
        formattedFunding,
        numFundingRounds: getScalar(organization.num_funding_rounds) || 0,
        lastFundingType: getScalar(organization.last_funding_type) || undefined,
        lastFundingAt: getScalar(organization.last_funding_at) || undefined,
        fundingRounds: fundingRounds.length > 0 ? fundingRounds : undefined,
        dataSource: 'Crunchbase API',
        success: true,
      };

      logger?.info('✅ [crunchbaseMetricsTool] Crunchbase funding data retrieved:', {
        companyName: result.companyName,
        fundingTotal: result.formattedFunding,
        numRounds: result.numFundingRounds,
      });
      
      return result;
    } catch (error) {
      logger?.error('❌ [crunchbaseMetricsTool] Failed to fetch Crunchbase data:', {
        permalink: context.companyPermalink,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        companyPermalink: context.companyPermalink,
        dataSource: 'Crunchbase API',
        success: false,
        error: `Failed to fetch Crunchbase data: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
