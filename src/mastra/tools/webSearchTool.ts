import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webSearchTool = createTool({
  id: "web-search-tool",
  description:
    "Performs web search to find recent articles, news, and information about DAP market topics. Returns search results with titles, URLs, and snippets.",
  
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    maxResults: z.number().optional().describe("Maximum number of results to return (default: 10)"),
  }),
  
  outputSchema: z.object({
    query: z.string(),
    results: z.array(
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
    logger?.info('🔍 [webSearchTool] Searching for:', { query: context.query });
    
    try {
      // Use DuckDuckGo HTML search (no API key required)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(context.query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DAPMarketResearch/1.0)',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Parse DuckDuckGo results (simple regex parsing)
      const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;
      
      const results: Array<{ title: string; url: string; snippet: string }> = [];
      const maxResults = context.maxResults || 10;
      
      let match;
      const urls: string[] = [];
      const titles: string[] = [];
      
      while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
        urls.push(match[1]);
        titles.push(match[2].trim());
      }
      
      const snippets: string[] = [];
      while ((match = snippetPattern.exec(html)) !== null) {
        snippets.push(match[1].trim());
      }
      
      for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
        results.push({
          title: titles[i] || 'No title',
          url: urls[i],
          snippet: snippets[i] || 'No description available',
        });
      }
      
      logger?.info('✅ [webSearchTool] Search completed:', {
        query: context.query,
        resultsCount: results.length,
      });
      
      return {
        query: context.query,
        results,
        success: true,
      };
    } catch (error) {
      logger?.error('❌ [webSearchTool] Search error:', {
        query: context.query,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        query: context.query,
        results: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
