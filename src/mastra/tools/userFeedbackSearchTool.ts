import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const COMPETITORS = [
  "Watershed",
  "Persefoni",
  "Greenly",
  "carbmee",
  "osapiens",
  "Sweep",
  "Normative",
];

export const userFeedbackSearchTool = createTool({
  id: "user-feedback-search-tool",
  description:
    "Performs keyword-based web searches to find user feedback, reviews, and opinions about Carbon Accounting Software competitors from forums, Reddit, Twitter, LinkedIn, and other platforms. Complements G2 reviews with broader user sentiment from the web.",
  
  inputSchema: z.object({
    competitor: z.string().describe("Competitor name to search feedback for"),
  }),
  
  outputSchema: z.object({
    competitor: z.string(),
    feedbackSources: z.array(
      z.object({
        platform: z.string(),
        snippet: z.string(),
        url: z.string().optional(),
        sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      })
    ),
    searchQuery: z.string(),
    totalSources: z.number(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [userFeedbackSearchTool] Searching user feedback for:', {
      competitor: context.competitor,
    });
    
    // Construct search queries to find user feedback
    const searchQueries = [
      `"${context.competitor}" carbon accounting reviews`,
      `"${context.competitor}" user experience feedback`,
      `"${context.competitor}" vs alternatives reddit`,
    ];
    
    const feedbackSources: Array<{
      platform: string;
      snippet: string;
      url?: string;
      sentiment?: "positive" | "neutral" | "negative";
    }> = [];
    
    // Note: In a real implementation, this would call webSearchTool or use an API
    // For now, we'll return a placeholder structure that the agent can work with
    // The actual web search will be done in the workflow step
    
    logger?.info('✅ [userFeedbackSearchTool] User feedback search query prepared');
    
    return {
      competitor: context.competitor,
      feedbackSources,
      searchQuery: searchQueries.join(" OR "),
      totalSources: 0,
    };
  },
});
