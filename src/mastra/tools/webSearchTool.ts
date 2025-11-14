import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { perplexityRateLimiter } from "./rateLimiter";
import { getJson } from "serpapi";

export const webSearchTool = createTool({
  id: "web-search-tool",
  description:
    "Performs AI-powered web search using Perplexity Sonar (primary) or SerpAPI (fallback) to find recent, relevant articles, news, and information about DAP market topics. Returns comprehensive search results with real-time data. Automatically falls back to SerpAPI if Perplexity rate limits are reached.",
  
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    maxResults: z.number().optional().describe("Maximum number of results to return (default: 5)"),
  }),
  
  outputSchema: z.object({
    query: z.string(),
    answer: z.string().describe("Comprehensive answer synthesized from search results"),
    citations: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })
    ),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [webSearchTool] Starting web search for:', { query: context.query });
    
    // Try Perplexity first
    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey) {
        throw new Error('PERPLEXITY_API_KEY not configured');
      }

      logger?.info('🔍 [webSearchTool] Attempting Perplexity Sonar search...');
      
      // Wait for rate limiter before making request
      const rateLimitStatus = perplexityRateLimiter.getStatus();
      logger?.info('⏱️ [webSearchTool] Rate limiter status:', rateLimitStatus);
      
      await perplexityRateLimiter.throttle();
      logger?.info('✓ [webSearchTool] Rate limit check passed, making Perplexity API request');

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are a market research assistant. Provide comprehensive, factual answers with specific data points, dates, and citations. Focus on recent developments from the last 7 days when available.',
            },
            {
              role: 'user',
              content: context.query,
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
          return_citations: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      const answer = data.choices?.[0]?.message?.content || 'No answer generated';
      const searchResults = data.search_results || [];
      const citations = searchResults.slice(0, context.maxResults || 5).map((result: any) => ({
        title: result.title || 'No title',
        url: result.url || '',
        snippet: result.date ? `Published: ${result.date}` : 'Citation from Perplexity search',
      }));

      logger?.info('✅ [webSearchTool] Perplexity search completed:', {
        query: context.query,
        citationsCount: citations.length,
        answerLength: answer.length,
      });
      
      return {
        query: context.query,
        answer,
        citations,
        success: true,
      };
    } catch (perplexityError) {
      logger?.warn('⚠️ [webSearchTool] Perplexity search failed, falling back to SerpAPI:', {
        query: context.query,
        error: perplexityError instanceof Error ? perplexityError.message : String(perplexityError),
      });
      
      // Fallback to SerpAPI
      try {
        const serpApiKey = process.env.SERPAPI_API_KEY;
        if (!serpApiKey) {
          throw new Error('SERPAPI_API_KEY not configured - cannot use fallback');
        }

        logger?.info('🔍 [webSearchTool] Attempting SerpAPI search...');
        
        const serpResults = await getJson({
          engine: "google",
          api_key: serpApiKey,
          q: context.query,
          num: context.maxResults || 5,
        });

        // Extract organic results
        const organicResults = serpResults.organic_results || [];
        
        // Create citations from organic results
        const citations = organicResults.slice(0, context.maxResults || 5).map((result: any) => ({
          title: result.title || 'No title',
          url: result.link || '',
          snippet: result.snippet || 'Google search result via SerpAPI',
        }));

        // Create a synthesized answer from the results
        const answer = organicResults.length > 0
          ? `Based on Google search results:\n\n${organicResults
              .slice(0, 3)
              .map((r: any, i: number) => `${i + 1}. ${r.title}: ${r.snippet}`)
              .join('\n\n')}`
          : 'No search results found';

        logger?.info('✅ [webSearchTool] SerpAPI search completed:', {
          query: context.query,
          citationsCount: citations.length,
          answerLength: answer.length,
        });
        
        return {
          query: context.query,
          answer,
          citations,
          success: true,
        };
      } catch (serpError) {
        logger?.error('❌ [webSearchTool] Both Perplexity and SerpAPI failed:', {
          query: context.query,
          perplexityError: perplexityError instanceof Error ? perplexityError.message : String(perplexityError),
          serpError: serpError instanceof Error ? serpError.message : String(serpError),
        });
        
        return {
          query: context.query,
          answer: '',
          citations: [],
          success: false,
          error: `Both search providers failed. Perplexity: ${perplexityError instanceof Error ? perplexityError.message : String(perplexityError)}, SerpAPI: ${serpError instanceof Error ? serpError.message : String(serpError)}`,
        };
      }
    }
  },
});
