import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webSearchTool = createTool({
  id: "web-search-tool",
  description:
    "Performs AI-powered web search using Perplexity Sonar to find recent, relevant articles, news, and information about DAP market topics. Returns comprehensive search results with real-time data.",
  
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
    logger?.info('🔍 [webSearchTool] Perplexity Sonar search for:', { query: context.query });
    
    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey) {
        throw new Error('PERPLEXITY_API_KEY not configured');
      }

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
    } catch (error) {
      logger?.error('❌ [webSearchTool] Perplexity search error:', {
        query: context.query,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        query: context.query,
        answer: '',
        citations: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
