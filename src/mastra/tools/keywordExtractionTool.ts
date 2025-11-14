import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const keywordExtractionTool = createTool({
  id: "keyword-extraction-tool",
  description: "Extracts significant keywords and phrases from research text to identify emerging market trends. Filters out common words and focuses on industry-specific terminology, product names, and technical concepts.",
  
  inputSchema: z.object({
    text: z.string().describe("The text content to analyze for keywords"),
    minFrequency: z.number().default(2).describe("Minimum frequency threshold for keywords (default: 2)"),
    contextType: z.string().default("general").describe("Context type: competitor_news, market_data, industry_reports, etc."),
  }),
  
  outputSchema: z.object({
    keywords: z.array(z.object({
      keyword: z.string(),
      frequency: z.number(),
      contextType: z.string(),
    })),
    totalProcessed: z.number(),
    summary: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [keywordExtractionTool] Starting keyword extraction:', {
      textLength: context.text.length,
      minFrequency: context.minFrequency,
      contextType: context.contextType,
    });
    
    // Normalize text: lowercase, remove special characters
    const normalizedText = context.text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
      'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
      'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
      'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
      'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
      'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
      'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
      'most', 'us', 'is', 'are', 'was', 'were', 'been', 'has', 'had', 'may', 'such',
    ]);
    
    // Extract meaningful n-grams (1-3 words)
    const words = normalizedText.split(' ').filter(w => w.length > 0);
    const keywordCounts = new Map<string, number>();
    
    // Extract 1-grams (single words)
    for (const word of words) {
      if (word.length >= 3 && !stopWords.has(word)) {
        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
      }
    }
    
    // Extract 2-grams (two-word phrases)
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i];
      const word2 = words[i + 1];
      
      if (!stopWords.has(word1) && !stopWords.has(word2) && 
          word1.length >= 3 && word2.length >= 3) {
        const phrase = `${word1} ${word2}`;
        keywordCounts.set(phrase, (keywordCounts.get(phrase) || 0) + 1);
      }
    }
    
    // Extract 3-grams (three-word phrases)
    for (let i = 0; i < words.length - 2; i++) {
      const word1 = words[i];
      const word2 = words[i + 1];
      const word3 = words[i + 2];
      
      if (!stopWords.has(word1) && !stopWords.has(word2) && !stopWords.has(word3) &&
          word1.length >= 3 && word2.length >= 3 && word3.length >= 3) {
        const phrase = `${word1} ${word2} ${word3}`;
        keywordCounts.set(phrase, (keywordCounts.get(phrase) || 0) + 1);
      }
    }
    
    // Filter by minimum frequency and convert to array
    const keywords = Array.from(keywordCounts.entries())
      .filter(([_, count]) => count >= context.minFrequency)
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        contextType: context.contextType,
      }))
      .sort((a, b) => b.frequency - a.frequency); // Sort by frequency descending
    
    logger?.info('✅ [keywordExtractionTool] Keyword extraction complete:', {
      totalKeywords: keywords.length,
      topKeywords: keywords.slice(0, 10).map(k => `${k.keyword} (${k.frequency})`),
    });
    
    return {
      keywords,
      totalProcessed: keywordCounts.size,
      summary: `Extracted ${keywords.length} keywords (frequency >= ${context.minFrequency}) from ${words.length} words`,
    };
  },
});
