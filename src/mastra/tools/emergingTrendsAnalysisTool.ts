import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { DatabaseService } from "../storage/db";
import { analyzeKeywords, saveKeywordOccurrences, getEmergingMarketInsights } from "../../utils/keywordAnalysis";

/**
 * Tool to analyze emerging market trends using keyword frequency analysis
 * Compares current keywords against historical data to identify new and rising trends
 */
export const emergingTrendsAnalysisTool = createTool({
  id: "emerging-trends-analysis-tool",
  description: "Analyzes research text to identify emerging market trends using keyword frequency analysis and historical comparison. Extracts keywords from the provided text, compares them against previous weeks' data, and identifies NEW keywords (appearing for the first time) and RISING keywords (with significantly increased frequency). Returns insights formatted for the Emerging Markets & Niches section.",
  
  inputSchema: z.object({
    researchText: z.string().describe("The combined research text from all sources (news, reports, etc.)"),
    reportingWeekStart: z.string().describe("ISO date for the Monday of this reporting week (YYYY-MM-DD)"),
    contextType: z.string().default("market_research").describe("Context type: market_research, competitor_news, etc."),
  }),
  
  outputSchema: z.object({
    newKeywords: z.array(z.object({
      keyword: z.string(),
      frequency: z.number(),
      contextType: z.string(),
    })),
    risingKeywords: z.array(z.object({
      keyword: z.string(),
      frequency: z.number(),
      previousFrequency: z.number(),
    })),
    insights: z.string(),
    summary: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [emergingTrendsAnalysisTool] Starting keyword trend analysis:', {
      textLength: context.researchText.length,
      reportingWeekStart: context.reportingWeekStart,
      contextType: context.contextType,
    });
    
    try {
      const dbService = new DatabaseService();
      
      // Step 1: Extract keywords from research text
      logger?.info('🔍 [emergingTrendsAnalysisTool] Extracting keywords...');
      const normalizedText = context.researchText.toLowerCase()
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
      
      // Extract n-grams (1-3 words)
      const words = normalizedText.split(' ').filter(w => w.length > 0);
      const keywordCounts = new Map<string, number>();
      
      // Extract 2-grams and 3-grams (more meaningful for emerging trends)
      for (let i = 0; i < words.length - 1; i++) {
        const word1 = words[i];
        const word2 = words[i + 1];
        
        if (!stopWords.has(word1) && !stopWords.has(word2) && 
            word1.length >= 3 && word2.length >= 3) {
          const phrase = `${word1} ${word2}`;
          keywordCounts.set(phrase, (keywordCounts.get(phrase) || 0) + 1);
        }
        
        // 3-grams
        if (i < words.length - 2) {
          const word3 = words[i + 2];
          if (!stopWords.has(word1) && !stopWords.has(word2) && !stopWords.has(word3) &&
              word1.length >= 3 && word2.length >= 3 && word3.length >= 3) {
            const phrase = `${word1} ${word2} ${word3}`;
            keywordCounts.set(phrase, (keywordCounts.get(phrase) || 0) + 1);
          }
        }
      }
      
      // Filter and sort keywords
      const keywords = Array.from(keywordCounts.entries())
        .filter(([_, count]) => count >= 2) // Minimum frequency: 2
        .map(([keyword, frequency]) => ({
          keyword,
          frequency,
          contextType: context.contextType,
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 50); // Top 50 keywords
      
      logger?.info('🔍 [emergingTrendsAnalysisTool] Extracted keywords:', {
        totalKeywords: keywords.length,
        topKeywords: keywords.slice(0, 10).map(k => `${k.keyword} (${k.frequency})`),
      });
      
      // Step 2: Analyze keywords against historical data
      logger?.info('📊 [emergingTrendsAnalysisTool] Analyzing against historical data...');
      const analysis = await analyzeKeywords(keywords, context.reportingWeekStart, dbService);
      
      logger?.info('📊 [emergingTrendsAnalysisTool] Analysis complete:', {
        newKeywords: analysis.newKeywords.length,
        risingKeywords: analysis.risingKeywords.length,
      });
      
      // Step 3: Extract source URLs from research text
      logger?.info('🔗 [emergingTrendsAnalysisTool] Extracting source URLs...');
      const urlPattern = /https?:\/\/[^\s\)]+/g;
      const extractedUrls = context.researchText.match(urlPattern) || [];
      const uniqueUrls = Array.from(new Set(extractedUrls)).slice(0, 20); // Max 20 URLs
      
      logger?.info('🔗 [emergingTrendsAnalysisTool] Found source URLs:', {
        count: uniqueUrls.length,
        urls: uniqueUrls.slice(0, 5), // Log first 5
      });
      
      // Step 4: Save keywords to database for future comparison
      logger?.info('💾 [emergingTrendsAnalysisTool] Saving keywords to database...');
      await saveKeywordOccurrences(keywords, context.reportingWeekStart, dbService, uniqueUrls);
      
      // Step 5: Generate insights for the agent
      const insights = await getEmergingMarketInsights(context.reportingWeekStart, dbService);
      
      logger?.info('✅ [emergingTrendsAnalysisTool] Keyword analysis complete');
      
      return {
        newKeywords: analysis.newKeywords.map(k => ({
          keyword: k.keyword,
          frequency: k.frequency,
          contextType: k.contextType,
        })),
        risingKeywords: analysis.risingKeywords.map(k => ({
          keyword: k.keyword,
          frequency: k.frequency,
          previousFrequency: k.previousFrequency ?? 0,
        })),
        insights,
        summary: analysis.summary,
      };
    } catch (error: any) {
      logger?.error('❌ [emergingTrendsAnalysisTool] Error during keyword analysis:', error);
      
      return {
        newKeywords: [],
        risingKeywords: [],
        insights: '_Keyword trend analysis failed. Manual analysis required._',
        summary: `Error: ${error.message}`,
      };
    }
  },
});
