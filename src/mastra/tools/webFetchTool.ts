import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webFetchTool = createTool({
  id: "web-fetch-tool",
  description:
    "Fetches web content from a URL and returns cleaned text content. Useful for scraping newsrooms, reports, and review pages.",
  
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch content from"),
    extractText: z.boolean().optional().describe("Whether to extract and clean text content (default: true)"),
  }),
  
  outputSchema: z.object({
    url: z.string(),
    content: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🌐 [webFetchTool] Fetching URL:', { url: context.url });
    
    try {
      const response = await fetch(context.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DAPMarketResearch/1.0)',
        },
      });
      
      if (!response.ok) {
        logger?.warn('⚠️ [webFetchTool] HTTP error:', { status: response.status, url: context.url });
        return {
          url: context.url,
          content: '',
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      let content = await response.text();
      
      // Basic HTML cleaning if text extraction is requested
      if (context.extractText !== false) {
        content = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      logger?.info('✅ [webFetchTool] Successfully fetched content:', {
        url: context.url,
        contentLength: content.length,
      });
      
      return {
        url: context.url,
        content,
        success: true,
      };
    } catch (error) {
      logger?.error('❌ [webFetchTool] Error fetching URL:', {
        url: context.url,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        url: context.url,
        content: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
