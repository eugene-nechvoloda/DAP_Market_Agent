import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { dapMarketResearchAgent } from "../agents/dapMarketResearchAgent";
import { getAllCompetitorTrends } from "../../utils/trendCalculation";
import { competitorNewsResearchTool } from "../tools/competitorNewsResearchTool";
import { industryReportsResearchTool } from "../tools/industryReportsResearchTool";
import { userReviewsResearchTool } from "../tools/userReviewsResearchTool";
import { webSearchTool } from "../tools/webSearchTool";
import { webFetchTool } from "../tools/webFetchTool";
import { googleDocsExportTool } from "../tools/googleDocsExportTool";
import { slackNotificationTool } from "../tools/slackNotificationTool";
import { db } from "../storage/db.js";
import { extractMetricsFromText, getAllCompetitorNames } from "../../utils/metricExtraction";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Configure OpenAI with Replit AI Integrations
const openaiClient = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Configure Anthropic with Replit AI Integrations  
const anthropicClient = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

const workflowInputSchema = z.object({});

// Step 0: Intelligent Timespan Determination using GPT-5
const determineIntelligentTimespans = createStep({
  id: "determine-intelligent-timespans",
  description: "Uses GPT-5 to intelligently determine date ranges for different content types based on current date context",
  
  inputSchema: workflowInputSchema,
  
  outputSchema: z.object({
    runId: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    dateEnd: z.string(),
    currentMonth: z.string(),
    productUpdatesLookback: z.string(),
    reasoning: z.string(),
  }),
  
  execute: async ({ mastra, runId }) => {
    const logger = mastra?.getLogger();
    logger?.info('🧠 [Step 0] Determining intelligent date ranges using GPT-5...');
    
    // Use workflow execution runId from context (NOT Date.now()) to ensure consistency across all steps
    logger?.info('📋 [Step 0] Using workflow run ID from context:', { runId });
    
    const now = new Date();
    const dateEnd = now.toISOString().split('T')[0];
    const dayOfMonth = now.getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    
    // Get previous month name
    const prevMonthDate = new Date(now);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const previousMonthName = monthNames[prevMonthDate.getMonth()];
    const previousMonthYear = prevMonthDate.getFullYear();
    
    logger?.info(`📅 [Step 0] Current date context: ${currentMonthName} ${dayOfMonth}, ${currentYear}`);
    
    const prompt = `You are a market research analyst determining intelligent date ranges for different content types in a weekly market research report.

**Current Date:** ${currentMonthName} ${dayOfMonth}, ${currentYear}
**Previous Month:** ${previousMonthName} ${previousMonthYear}

**Your Task:** Determine smart date ranges for each content type based on the current date context:

1. **General News/Announcements** - Typically 7 days, but consider if we're early in the month
2. **Product Updates/Launches** - Usually 1 month, but consider current month context
3. **User Reviews** - Should capture current month, but consider if we're early/mid/late in month
4. **Press Releases** - Should capture current month activity

**Guidelines:**
- **Mid to Late Month (day 15-31)**: Include ALL content from the entire current month
  - Example: If today is November 21, include all November content (Nov 1-21)
- **Early Month (day 1-7)**: Include late previous month + current month
  - Example: If today is December 3, include late November (Nov 15-30) + early December (Dec 1-3)
- **Always prioritize recency** - More recent content is more valuable
- **Be generous with inclusion** - Better to include too much than miss important updates

Return your decision as structured data with:
- generalNewsDateStart: Start date for general news (YYYY-MM-DD)
- productUpdatesDateStart: Start date for product updates (YYYY-MM-DD)
- reviewsDateStart: Start date for reviews (YYYY-MM-DD)
- pressReleasesDateStart: Start date for press releases (YYYY-MM-DD)
- currentMonth: Current month name and year (e.g., "November 2025")
- productUpdatesLookback: Human-readable lookback period (e.g., "1 month")
- reasoning: Brief explanation of your date range decisions`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that responds in JSON format. Always respond with valid JSON matching the requested structure."
          },
          {
            role: "user",
            content: prompt + `\n\nRespond with valid JSON in this exact format:
{
  "generalNewsDateStart": "YYYY-MM-DD",
  "productUpdatesDateStart": "YYYY-MM-DD",
  "reviewsDateStart": "YYYY-MM-DD",
  "pressReleasesDateStart": "YYYY-MM-DD",
  "currentMonth": "Month YYYY",
  "productUpdatesLookback": "human readable period",
  "reasoning": "your explanation"
}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const resultText = response.choices[0]?.message?.content || "{}";
      const timespans = JSON.parse(resultText);
      
      logger?.info('✅ [Step 0] GPT-5 determined intelligent timespans:', timespans);
      
      return {
        runId,
        dateEnd,
        generalNewsDateStart: timespans.generalNewsDateStart,
        productUpdatesDateStart: timespans.productUpdatesDateStart,
        reviewsDateStart: timespans.reviewsDateStart,
        pressReleasesDateStart: timespans.pressReleasesDateStart,
        currentMonth: timespans.currentMonth,
        productUpdatesLookback: timespans.productUpdatesLookback,
        reasoning: timespans.reasoning,
      };
    } catch (error) {
      logger?.error('❌ [Step 0] Failed to determine intelligent timespans, falling back to defaults:', error);
      
      // Fallback to sensible defaults if GPT-5 fails
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      return {
        runId,
        dateEnd,
        generalNewsDateStart: sevenDaysAgo.toISOString().split('T')[0],
        productUpdatesDateStart: monthStart.toISOString().split('T')[0],
        reviewsDateStart: monthStart.toISOString().split('T')[0],
        pressReleasesDateStart: monthStart.toISOString().split('T')[0],
        currentMonth: `${currentMonthName} ${currentYear}`,
        productUpdatesLookback: "1 month",
        reasoning: "Fallback: GPT-5 failed, using default ranges (7 days for news, current month for updates/reviews/press)",
      };
    }
  },
});

const gatherMarketData = createStep({
  id: "gather-market-data",
  description: "Gathers market data from competitor newsrooms, industry reports, and user reviews using GPT-5 determined date ranges",
  
  inputSchema: z.object({
    runId: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    dateEnd: z.string(),
    currentMonth: z.string(),
    productUpdatesLookback: z.string(),
    reasoning: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 1] Starting market data gathering with GPT-5 determined timespans...');
    logger?.info('🧠 [Step 1] GPT-5 Reasoning:', inputData.reasoning);
    
    // Use the most general date start (general news) for overall week range
    const dateStartStr = inputData.generalNewsDateStart;
    const dateEndStr = inputData.dateEnd;
    
    // Format week range label for document title
    const dateStart = new Date(dateStartStr);
    const dateEnd = new Date(dateEndStr);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const weekRangeLabel = startMonth === endMonth && dateStart.getFullYear() === dateEnd.getFullYear()
      ? `${startMonth} ${dateStart.getDate()}-${dateEnd.getDate()}, ${dateEnd.getFullYear()}`
      : `${startMonth} ${dateStart.getDate()}, ${dateStart.getFullYear()}-${endMonth} ${dateEnd.getDate()}, ${dateEnd.getFullYear()}`;
    
    logger?.info('📅 [Step 1] Using intelligent date ranges:', { 
      generalNews: `${inputData.generalNewsDateStart} to ${dateEndStr}`,
      productUpdates: `${inputData.productUpdatesDateStart} to ${dateEndStr}`,
      reviews: `${inputData.reviewsDateStart} to ${dateEndStr}`,
      pressReleases: `${inputData.pressReleasesDateStart} to ${dateEndStr}`,
      currentMonth: inputData.currentMonth,
    });
    
    // Gather data from all sources using intelligent timespans
    logger?.info('🏢 [Step 1] Gathering competitor news...');
    const competitorData = await competitorNewsResearchTool.execute({
      context: { 
        dateStart: inputData.generalNewsDateStart, // General news uses 7-day window
        dateEnd: dateEndStr,
        currentMonth: inputData.currentMonth,
        productUpdatesLookback: inputData.productUpdatesLookback,
        productUpdatesDateStart: inputData.productUpdatesDateStart, // Product updates use longer timespan
        pressReleasesDateStart: inputData.pressReleasesDateStart, // Press releases use current month
        reviewsDateStart: inputData.reviewsDateStart, // Reviews use current month
      },
      runtimeContext,
      mastra,
    });
    
    logger?.info('📊 [Step 1] Gathering industry reports...');
    const industryData = await industryReportsResearchTool.execute({
      context: { 
        dateStart: inputData.generalNewsDateStart, 
        dateEnd: dateEndStr 
      },
      runtimeContext,
      mastra,
    });
    
    logger?.info('⭐ [Step 1] Gathering user reviews...');
    const reviewsData = await userReviewsResearchTool.execute({
      context: { 
        dateStart: inputData.reviewsDateStart, // Use reviews-specific date range
        dateEnd: dateEndStr,
        currentMonth: inputData.currentMonth,
      },
      runtimeContext,
      mastra,
    });
    
    logger?.info('✅ [Step 1] Market data gathering complete');
    
    // Save curated data to database to avoid Inngest step output size limits
    logger?.info('💾 [Step 1] Saving curated data to database:', {
      competitorDataSize: JSON.stringify(competitorData).length,
      industryDataSize: JSON.stringify(industryData).length,
      reviewsDataSize: JSON.stringify(reviewsData).length,
    });
    
    await db.saveReportSources(inputData.runId, competitorData, industryData, reviewsData);
    logger?.info('✅ [Step 1] Curated data saved to database');
    
    // Return metadata including intelligent timespan info for downstream search queries
    return {
      runId: inputData.runId,
      dateStart: dateStartStr,
      dateEnd: dateEndStr,
      weekRangeLabel,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      currentMonth: inputData.currentMonth,
      reasoning: inputData.reasoning,
    };
  },
});

const performWebSearches = createStep({
  id: "perform-web-searches",
  description: "Performs two web searches for comprehensive market intelligence using GPT-5 intelligent timespans",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [Step 2] Performing web searches for market intelligence with intelligent timespans...');
    logger?.info('🧠 [Step 2] Using GPT-5 date logic:', inputData.reasoning);
    
    // Format intelligent date range for general news search (use generalNewsDateStart)
    const dateStart = new Date(inputData.generalNewsDateStart);
    const dateEnd = new Date(inputData.dateEnd);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const dateRange = `${startMonth} ${dateStart.getDate()}-${endMonth !== startMonth ? endMonth + ' ' : ''}${dateEnd.getDate()} ${dateEnd.getFullYear()}`;
    
    // Search 1: Broad weekly market pulse (using intelligent general news timespan)
    logger?.info('🔍 [Step 2.1] Executing broad weekly market pulse search...');
    const broadPulseQuery = `Carbon accounting software news ${dateRange}: Watershed Persefoni Greenly carbmee osapiens Sweep Normative funding acquisitions product launches partnerships industry trends market analysis`;
    
    logger?.info('📝 [Step 2.1] Query with intelligent timespan:', broadPulseQuery);
    
    const broadPulseSearch = await webSearchTool.execute({
      context: {
        query: broadPulseQuery,
        maxResults: 5,
      },
      runtimeContext,
      mastra,
    });
    
    logger?.info('✅ [Step 2.1] Broad pulse search completed:', {
      success: broadPulseSearch.success,
      citationsCount: broadPulseSearch.citations?.length || 0,
    });
    
    // Search 2: Targeted follow-up (market data focus - current month context)
    logger?.info('🔍 [Step 2.2] Executing targeted follow-up search...');
    const targetedQuery = `Carbon accounting software market size growth rate as of ${inputData.currentMonth}, investment trends, CAGR analyst reports, Forrester/Gartner climate tech sustainability ESG market forecast`;
    
    logger?.info('📝 [Step 2.2] Query with current month context:', targetedQuery);
    
    const targetedFollowUpSearch = await webSearchTool.execute({
      context: {
        query: targetedQuery,
        maxResults: 5,
      },
      runtimeContext,
      mastra,
    });
    
    logger?.info('✅ [Step 2.2] Targeted follow-up search completed:', {
      success: targetedFollowUpSearch.success,
      citationsCount: targetedFollowUpSearch.citations?.length || 0,
    });
    
    logger?.info('✅ [Step 2] Web searches complete');
    
    // Keep full answers for metric extraction but limit citations to reduce payload size
    const trimCitations = (citations: any[]) => 
      citations.slice(0, 5).map(c => ({
        title: c.title?.substring(0, 150) || '',
        url: c.url || '',
        // Remove snippet to save space
      }));
    
    const trimmedBroadPulse = {
      success: broadPulseSearch.success,
      query: broadPulseSearch.query,
      answer: broadPulseSearch.answer || '', // Keep full answer for metric extraction
      citations: trimCitations(broadPulseSearch.citations || []),
      error: broadPulseSearch.error,
    };
    
    const trimmedTargetedSearch = {
      success: targetedFollowUpSearch.success,
      query: targetedFollowUpSearch.query,
      answer: targetedFollowUpSearch.answer || '', // Keep full answer for metric extraction
      citations: trimCitations(targetedFollowUpSearch.citations || []),
      error: targetedFollowUpSearch.error,
    };
    
    logger?.info('📦 [Step 2] Prepared web search payloads for Inngest:', {
      broadPulseAnswerLength: trimmedBroadPulse.answer.length,
      targetedAnswerLength: trimmedTargetedSearch.answer.length,
      totalCitations: (trimmedBroadPulse.citations?.length || 0) + (trimmedTargetedSearch.citations?.length || 0),
    });
    
    return {
      runId: inputData.runId,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      weekRangeLabel: inputData.weekRangeLabel,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      currentMonth: inputData.currentMonth,
      reasoning: inputData.reasoning,
      webSearchResults: {
        broadPulseSearch: trimmedBroadPulse,
        targetedFollowUpSearch: trimmedTargetedSearch,
      },
    };
  },
});

// Step 2.5.1: Search for funding metrics
const searchFundingMetrics = createStep({
  id: "search-funding-metrics",
  description: "Search for competitor funding and valuation data using GPT-5 intelligent timespans",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💸 [Step 2.5.1] Searching for funding and financial data with intelligent timespans...');
    logger?.info('🧠 [Step 2.5.1] Using GPT-5 date logic:', inputData.reasoning);
    
    // Calculate reporting week start (Monday of the current week)
    const dateEnd = new Date(inputData.dateEnd);
    const dayOfWeek = dateEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const reportingWeekStart = new Date(dateEnd);
    reportingWeekStart.setDate(reportingWeekStart.getDate() - daysToMonday);
    reportingWeekStart.setHours(0, 0, 0, 0);
    
    logger?.info('📅 [Step 2.5.1] Reporting week start:', { 
      reportingWeekStart: reportingWeekStart.toISOString().split('T')[0] 
    });
    
    // Format intelligent date range for press releases (funding announcements)
    const pressStart = new Date(inputData.pressReleasesDateStart);
    const pressEnd = new Date(inputData.dateEnd);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const pressStartMonth = monthNames[pressStart.getMonth()];
    const pressEndMonth = monthNames[pressEnd.getMonth()];
    const pressDateRange = `${pressStartMonth} ${pressStart.getDate()}-${pressEndMonth !== pressStartMonth ? pressEndMonth + ' ' : ''}${pressEnd.getDate()} ${pressEnd.getFullYear()}`;
    
    const competitorNames = getAllCompetitorNames();
    const fundingQuery = `${competitorNames.join(' OR ')} carbon accounting software funding rounds (Series A B C investment, TechCrunch/Crunchbase) ${pressDateRange}, valuation, revenue as of ${inputData.currentMonth}`;
    
    logger?.info('📝 [Step 2.5.1] Query with intelligent timespan:', fundingQuery);
    
    const fundingSearch = await webSearchTool.execute({
      context: {
        query: fundingQuery,
        maxResults: 5,
      },
      runtimeContext,
      mastra,
    });
    
    let fundingMetrics: any[] = [];
    
    if (fundingSearch.success && fundingSearch.answer) {
      logger?.info('📝 [Step 2.5.1] Perplexity search successful:', {
        answerLength: fundingSearch.answer.length,
        answerPreview: fundingSearch.answer.substring(0, 300),
        citationCount: fundingSearch.citations?.length || 0,
        citations: fundingSearch.citations?.map((c: any) => c.url).slice(0, 3),
      });
      
      logger?.info('📄 [Step 2.5.1] Fetching full article content from citations...');
      const citationTexts: string[] = [fundingSearch.answer];
      
      const citationsToFetch = (fundingSearch.citations || []).slice(0, 3);
      for (const citation of citationsToFetch) {
        if (citation.url) {
          try {
            const fetchResult = await webFetchTool.execute({
              context: { url: citation.url },
              runtimeContext,
              mastra,
            });
            if (fetchResult.success && fetchResult.content) {
              citationTexts.push(fetchResult.content.substring(0, 5000));
            }
          } catch (error) {
            logger?.warn(`⚠️ [Step 2.5.1] Failed to fetch ${citation.url}:`, error);
          }
        }
      }
      
      const fullText = citationTexts.join('\n\n');
      logger?.info(`📝 [Step 2.5.1] Collected ${fullText.length} characters for extraction`);
      
      fundingMetrics = await extractMetricsFromText(fullText, competitorNames, logger);
    }
    
    logger?.info(`✅ [Step 2.5.1] Extracted metrics for ${fundingMetrics.length} competitors`);
    
    return {
      ...inputData,
      fundingMetrics,
      reportingWeekStart: reportingWeekStart.toISOString().split('T')[0],
    };
  },
});

// Step 2.5.2: Search for revenue and employee metrics
const searchRevenueMetrics = createStep({
  id: "search-revenue-metrics",
  description: "Search for competitor revenue and employee data at running report date",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [Step 2.5.2] Searching for revenue and employee data at running report date...');
    logger?.info('🧠 [Step 2.5.2] Using GPT-5 date logic:', inputData.reasoning);
    
    const competitorNames = getAllCompetitorNames();
    const revenueQuery = `${competitorNames.join(' OR ')} carbon accounting software revenue, ARR, annual recurring employees headcount, company size as of ${inputData.currentMonth}`;
    
    logger?.info('📝 [Step 2.5.2] Query with current month context:', revenueQuery);
    
    const revenueSearch = await webSearchTool.execute({
      context: {
        query: revenueQuery,
        maxResults: 5,
      },
      runtimeContext,
      mastra,
    });
    
    let revenueMetrics: any[] = [];
    
    if (revenueSearch.success && revenueSearch.answer) {
      logger?.info('📝 [Step 2.5.2] Perplexity search successful:', {
        answerLength: revenueSearch.answer.length,
        answerPreview: revenueSearch.answer.substring(0, 300),
        citationCount: revenueSearch.citations?.length || 0,
        citations: revenueSearch.citations?.map((c: any) => c.url).slice(0, 3),
      });
      
      logger?.info('📄 [Step 2.5.2] Fetching full article content from citations...');
      const citationTexts: string[] = [revenueSearch.answer];
      
      const citationsToFetch = (revenueSearch.citations || []).slice(0, 3);
      for (const citation of citationsToFetch) {
        if (citation.url) {
          try {
            const fetchResult = await webFetchTool.execute({
              context: { url: citation.url },
              runtimeContext,
              mastra,
            });
            if (fetchResult.success && fetchResult.content) {
              citationTexts.push(fetchResult.content.substring(0, 5000));
            }
          } catch (error) {
            logger?.warn(`⚠️ [Step 2.5.2] Failed to fetch ${citation.url}:`, error);
          }
        }
      }
      
      const fullText = citationTexts.join('\n\n');
      logger?.info(`📝 [Step 2.5.2] Collected ${fullText.length} characters for extraction`);
      
      revenueMetrics = await extractMetricsFromText(fullText, competitorNames, logger);
    }
    
    logger?.info(`✅ [Step 2.5.2] Extracted metrics for ${revenueMetrics.length} competitors`);
    
    return {
      ...inputData,
      revenueMetrics,
    };
  },
});

// Step 2.5.3: Search for customer health metrics
const searchCustomerMetrics = createStep({
  id: "search-customer-metrics",
  description: "Search for competitor customer count, churn, and retention data at running report date",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    customerMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('👥 [Step 2.5.3] Searching for customer base and churn data at running report date...');
    logger?.info('🧠 [Step 2.5.3] Using GPT-5 date logic:', inputData.reasoning);
    
    const competitorNames = getAllCompetitorNames();
    const customerQuery = `${competitorNames.join(' OR ')} carbon accounting software customers client count user base active users churn rate retention rate user growth as of ${inputData.currentMonth}`;
    
    logger?.info('📝 [Step 2.5.3] Query with current month context:', customerQuery);
    
    const customerSearch = await webSearchTool.execute({
      context: {
        query: customerQuery,
        maxResults: 5,
      },
      runtimeContext,
      mastra,
    });
    
    let customerMetrics: any[] = [];
    
    if (customerSearch.success && customerSearch.answer) {
      logger?.info('📝 [Step 2.5.3] Perplexity search successful:', {
        answerLength: customerSearch.answer.length,
        answerPreview: customerSearch.answer.substring(0, 300),
        citationCount: customerSearch.citations?.length || 0,
        citations: customerSearch.citations?.map((c: any) => c.url).slice(0, 3),
      });
      
      logger?.info('📄 [Step 2.5.3] Fetching full article content from citations...');
      const citationTexts: string[] = [customerSearch.answer];
      
      const citationsToFetch = (customerSearch.citations || []).slice(0, 3);
      for (const citation of citationsToFetch) {
        if (citation.url) {
          try {
            const fetchResult = await webFetchTool.execute({
              context: { url: citation.url },
              runtimeContext,
              mastra,
            });
            if (fetchResult.success && fetchResult.content) {
              citationTexts.push(fetchResult.content.substring(0, 5000));
            }
          } catch (error) {
            logger?.warn(`⚠️ [Step 2.5.3] Failed to fetch ${citation.url}:`, error);
          }
        }
      }
      
      const fullText = citationTexts.join('\n\n');
      logger?.info(`📝 [Step 2.5.3] Collected ${fullText.length} characters for extraction`);
      
      customerMetrics = await extractMetricsFromText(fullText, competitorNames, logger);
    }
    
    logger?.info(`✅ [Step 2.5.3] Extracted metrics for ${customerMetrics.length} competitors`);
    
    return {
      ...inputData,
      customerMetrics,
    };
  },
});

// Step 2.5.4a: Per-Competitor Intelligence Searches
const searchPerCompetitorIntelligence = createStep({
  id: "search-per-competitor-intelligence",
  description: "Search for detailed intelligence on each competitor individually using Perplexity/SerpAPI to ground parsing in factual per-competitor data",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    customerMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    customerMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [Step 2.5.4a] Searching for per-competitor intelligence...');
    logger?.info('🧠 [Step 2.5.4a] Using GPT-5 date logic:', inputData.reasoning);
    
    // Format date range for current month (for recent news)
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const endDate = new Date(inputData.dateEnd);
    const currentMonth = monthNames[endDate.getMonth()];
    const currentYear = endDate.getFullYear();
    const dateRange = `${currentMonth} ${currentYear}`;
    
    // List of competitors
    const competitors = [
      { name: "Watershed", slug: "watershed" },
      { name: "Persefoni", slug: "persefoni" },
      { name: "Greenly", slug: "greenly" },
      { name: "carbmee", slug: "carbmee" },
      { name: "osapiens", slug: "osapiens" },
      { name: "Sweep", slug: "sweep" },
      { name: "Normative", slug: "normative" },
    ];
    
    const perCompetitorSearches: Record<string, any> = {};
    
    // Search for each competitor individually (sequential to avoid rate limits)
    for (const competitor of competitors) {
      const query = `${competitor.name} carbon accounting software latest news funding product updates partnerships user reviews ${dateRange}`;
      
      logger?.info(`🔍 [Step 2.5.4a] Searching for ${competitor.name}:`, { query });
      
      try {
        const searchResult = await webSearchTool.execute({
          context: {
            query,
            maxResults: 5,
          },
          runtimeContext,
          mastra,
        });
        
        // Trim citations
        const trimmedResult = {
          success: searchResult.success,
          query: searchResult.query,
          answer: searchResult.answer || '',
          citations: searchResult.citations?.slice(0, 5).map(c => ({
            title: c.title?.substring(0, 150) || '',
            url: c.url || '',
            snippet: c.snippet || '',
          })) || [],
          error: searchResult.error,
        };
        
        perCompetitorSearches[competitor.slug] = trimmedResult;
        
        logger?.info(`✅ [Step 2.5.4a] ${competitor.name} search completed:`, {
          success: trimmedResult.success,
          citationsCount: trimmedResult.citations.length,
          answerLength: trimmedResult.answer.length,
        });
        
        // Rate limit: wait 1 second between searches to avoid overwhelming Perplexity
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger?.error(`❌ [Step 2.5.4a] Failed to search for ${competitor.name}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        perCompetitorSearches[competitor.slug] = {
          success: false,
          query,
          answer: '',
          citations: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    
    logger?.info('✅ [Step 2.5.4a] All per-competitor searches completed:', {
      total: Object.keys(perCompetitorSearches).length,
      successful: Object.values(perCompetitorSearches).filter((s: any) => s.success).length,
    });
    
    return {
      runId: inputData.runId,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      weekRangeLabel: inputData.weekRangeLabel,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      currentMonth: inputData.currentMonth,
      reasoning: inputData.reasoning,
      webSearchResults: {
        ...inputData.webSearchResults,
        perCompetitorSearches,
      },
      fundingMetrics: inputData.fundingMetrics,
      revenueMetrics: inputData.revenueMetrics,
      customerMetrics: inputData.customerMetrics,
      reportingWeekStart: inputData.reportingWeekStart,
    };
  },
});

// Step 2.5.4b: Search for user feedback and reviews
const searchUserFeedback = createStep({
  id: "search-user-feedback",
  description: "Search for recent real user feedback and reviews with GPT-5 intelligent timespans",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    customerMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      userFeedbackSearch: z.any().optional(),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    customerMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💬 [Step 2.5.4] Searching for recent real user feedback and reviews...');
    logger?.info('🧠 [Step 2.5.4] Using GPT-5 date logic:', inputData.reasoning);
    
    // Format intelligent date range for reviews (use reviewsDateStart)
    const reviewsStart = new Date(inputData.reviewsDateStart);
    const reviewsEnd = new Date(inputData.dateEnd);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const reviewsStartMonth = monthNames[reviewsStart.getMonth()];
    const reviewsEndMonth = monthNames[reviewsEnd.getMonth()];
    const reviewsDateRange = `${reviewsStartMonth} ${reviewsStart.getDate()}-${reviewsEndMonth !== reviewsStartMonth ? reviewsEndMonth + ' ' : ''}${reviewsEnd.getDate()} ${reviewsEnd.getFullYear()}`;
    
    const competitorNames = getAllCompetitorNames();
    const feedbackQuery = `${competitorNames.join(' OR ')} carbon accounting software recent real users feedback/review ${reviewsDateRange}`;
    
    logger?.info('📝 [Step 2.5.4] Query with intelligent timespan:', feedbackQuery);
    
    const feedbackSearch = await webSearchTool.execute({
      context: {
        query: feedbackQuery,
        maxResults: 5,
      },
      runtimeContext,
      mastra,
    });
    
    logger?.info('✅ [Step 2.5.4] User feedback search completed:', {
      success: feedbackSearch.success,
      citationsCount: feedbackSearch.citations?.length || 0,
    });
    
    // Trim feedback search results similar to other searches
    const trimCitations = (citations: any[]) => 
      citations.slice(0, 5).map(c => ({
        title: c.title?.substring(0, 150) || '',
        url: c.url || '',
      }));
    
    const trimmedFeedbackSearch = {
      success: feedbackSearch.success,
      query: feedbackSearch.query,
      answer: feedbackSearch.answer || '',
      citations: trimCitations(feedbackSearch.citations || []),
      error: feedbackSearch.error,
    };
    
    // Return all intelligent timespan data for downstream steps
    return {
      runId: inputData.runId,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      weekRangeLabel: inputData.weekRangeLabel,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      currentMonth: inputData.currentMonth,
      reasoning: inputData.reasoning,
      webSearchResults: {
        ...inputData.webSearchResults,
        userFeedbackSearch: trimmedFeedbackSearch,
      },
      fundingMetrics: inputData.fundingMetrics,
      revenueMetrics: inputData.revenueMetrics,
      customerMetrics: inputData.customerMetrics,
      reportingWeekStart: inputData.reportingWeekStart,
    };
  },
});

// Step 2.5.5: Persist all metrics to database
const persistCompetitorMetrics = createStep({
  id: "persist-competitor-metrics",
  description: "Merge and persist all competitor metrics to database",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    generalNewsDateStart: z.string(),
    productUpdatesDateStart: z.string(),
    reviewsDateStart: z.string(),
    pressReleasesDateStart: z.string(),
    currentMonth: z.string(),
    reasoning: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
      userFeedbackSearch: z.any().optional(),
    }),
    fundingMetrics: z.array(z.any()),
    revenueMetrics: z.array(z.any()),
    customerMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
      userFeedbackSearch: z.any().optional(),
    }),
    metricsGathered: z.boolean(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('💾 [Step 2.5.5] Merging and persisting competitor metrics...');
    
    // Merge all metrics by competitor slug
    const allMetrics: any[] = [];
    const metricsMap = new Map<string, any>();
    
    // Add funding metrics
    for (const metric of inputData.fundingMetrics) {
      metricsMap.set(metric.competitorSlug, { ...metric });
    }
    
    // Merge revenue metrics
    for (const metric of inputData.revenueMetrics) {
      const existing = metricsMap.get(metric.competitorSlug);
      if (existing) {
        Object.assign(existing, metric);
      } else {
        metricsMap.set(metric.competitorSlug, { ...metric });
      }
    }
    
    // Merge customer metrics
    for (const metric of inputData.customerMetrics) {
      const existing = metricsMap.get(metric.competitorSlug);
      if (existing) {
        Object.assign(existing, metric);
      } else {
        metricsMap.set(metric.competitorSlug, { ...metric });
      }
    }
    
    // Convert map to array
    metricsMap.forEach(metric => allMetrics.push(metric));
    
    logger?.info(`📊 [Step 2.5.5] Merged metrics for ${allMetrics.length} competitors`, {
      competitors: allMetrics.map(m => ({
        slug: m.competitorSlug,
        hasRevenue: !!m.revenueUsd,
        revenue: m.revenueUsd,
        hasValuation: !!m.valuationUsd,
        valuation: m.valuationUsd,
        hasFunding: !!m.fundingTotalUsd,
        funding: m.fundingTotalUsd,
        hasEmployees: !!m.employeeCount,
        employees: m.employeeCount,
        hasCustomers: !!m.customerCount,
        customers: m.customerCount,
        hasUserBase: !!m.userBase,
        userBase: m.userBase,
      })),
    });
    
    // Store metrics in database
    const reportingWeekStart = new Date(inputData.reportingWeekStart);
    let storedCount = 0;
    
    for (const metrics of allMetrics) {
      try {
        logger?.info(`💾 [Step 2.5.5] Storing metrics for ${metrics.competitorSlug}:`, {
          revenue: metrics.revenueUsd,
          valuation: metrics.valuationUsd,
          funding: metrics.fundingTotalUsd,
          employees: metrics.employeeCount,
          customers: metrics.customerCount,
          churn: metrics.churnRate,
          retention: metrics.retentionRate,
          userBase: metrics.userBase,
          userGrowth: metrics.userGrowthRate,
        });
        
        await db.saveCompetitorMetrics({
          competitorSlug: metrics.competitorSlug,
          reportingWeekStart,
          revenueUsd: metrics.revenueUsd,
          revenueRange: metrics.revenueRange,
          valuationUsd: metrics.valuationUsd,
          employeeCount: metrics.employeeCount,
          owlerRawPayload: null,
          owlerSuccess: false,
          fundingTotalUsd: metrics.fundingTotalUsd,
          lastRoundAmountUsd: metrics.lastRoundAmountUsd,
          lastRoundType: metrics.lastRoundType,
          lastRoundDate: metrics.lastRoundDate ? new Date(metrics.lastRoundDate) : null,
          investorCount: null,
          fundingRounds: null,
          crunchbaseRawPayload: { 
            sourceUrls: metrics.sourceUrls,
            rawContext: metrics.rawContext 
          },
          crunchbaseSuccess: true,
          organicTraffic: null,
          organicKeywords: null,
          semrushRank: null,
          semrushDatabase: null,
          semrushRawPayload: null,
          semrushSuccess: false,
          customerCount: metrics.customerCount,
          churnRate: metrics.churnRate,
          retentionRate: metrics.retentionRate,
          userBase: metrics.userBase,
          userGrowthRate: metrics.userGrowthRate,
          dataSourceVersion: 'public-web-search-v1',
          missingSources: [],
          error: null,
        });
        storedCount++;
      } catch (error) {
        logger?.error(`❌ [Step 2.5.5] Failed to store metrics for ${metrics.competitorSlug}:`, error);
      }
    }
    
    logger?.info(`✅ [Step 2.5.5] Stored metrics for ${storedCount}/${allMetrics.length} competitors`);
    
    return {
      runId: inputData.runId,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      weekRangeLabel: inputData.weekRangeLabel,
      webSearchResults: inputData.webSearchResults,
      metricsGathered: storedCount > 0,
    };
  },
});

// Step 2.5.5: Calculate competitor trends
const calculateCompetitorTrends = createStep({
  id: "calculate-competitor-trends",
  description: "Calculate trends by comparing current week's metrics vs previous week",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
      userFeedbackSearch: z.any().optional(),
    }),
    metricsGathered: z.boolean(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
      userFeedbackSearch: z.any().optional(),
    }),
    metricsGathered: z.boolean(),
    competitorTrends: z.any(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [Step 2.5.5] Calculating competitor trends vs previous week...');
    
    // Skip trend calculation if no metrics were stored
    if (!inputData.metricsGathered) {
      logger?.warn('⚠️ [Step 2.5.5] No metrics gathered, skipping trend calculation');
      return {
        ...inputData,
        competitorTrends: null,
      };
    }
    
    // Calculate reporting week start
    const dateEnd = new Date(inputData.dateEnd);
    const dayOfWeek = dateEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const reportingWeekStart = new Date(dateEnd);
    reportingWeekStart.setDate(reportingWeekStart.getDate() - daysToMonday);
    reportingWeekStart.setHours(0, 0, 0, 0);
    
    logger?.info(`📅 [Step 2.5.5] Reporting week start: ${reportingWeekStart.toISOString().split('T')[0]}`);
    
    // Get all competitor trends
    const competitorTrends = await getAllCompetitorTrends(reportingWeekStart);
    
    // Log trend summary
    const trendsCount = Object.keys(competitorTrends).length;
    logger?.info(`✅ [Step 2.5.5] Calculated trends for ${trendsCount} competitors`);
    
    return {
      ...inputData,
      competitorTrends,
    };
  },
});

// Step 2.6: Parse Web Search Results into Structured Per-Competitor Data
const parseCompetitorIntelligence = createStep({
  id: "parse-competitor-intelligence",
  description: "Uses Claude Sonnet 4.5 to parse Perplexity/SerpAPI search results into structured per-competitor information (primary source), with curated data as supplementary context",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
      userFeedbackSearch: z.any().optional(),
    }),
    metricsGathered: z.boolean(),
    competitorTrends: z.any().optional(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
      perCompetitorSearches: z.record(z.any()),
      userFeedbackSearch: z.any().optional(),
    }),
    metricsGathered: z.boolean(),
    competitorTrends: z.any().optional(),
    perCompetitorData: z.any(), // Structured data keyed by competitor
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📋 [Step 2.6] Parsing per-competitor Perplexity/SerpAPI search results with Claude Sonnet 4.5...');
    
    // Extract per-competitor search results (PRIMARY SOURCE)
    const perCompetitorSearches = inputData.webSearchResults.perCompetitorSearches || {};
    
    const competitors = [
      { name: "Watershed", slug: "watershed" },
      { name: "Persefoni", slug: "persefoni" },
      { name: "Greenly", slug: "greenly" },
      { name: "carbmee", slug: "carbmee" },
      { name: "osapiens", slug: "osapiens" },
      { name: "Sweep", slug: "sweep" },
      { name: "Normative", slug: "normative" },
    ];
    
    // Build comprehensive prompt with all per-competitor searches
    let competitorDataText = '';
    let citationCounter = 1;
    const allCitations: any[] = [];
    
    for (const competitor of competitors) {
      const searchData = perCompetitorSearches[competitor.slug];
      if (searchData && searchData.success) {
        competitorDataText += `\n## ${competitor.name}\n`;
        competitorDataText += `**Search Result:**\n${searchData.answer}\n\n`;
        
        // Add citations for this competitor
        if (searchData.citations && searchData.citations.length > 0) {
          competitorDataText += `**Sources:**\n`;
          for (const citation of searchData.citations) {
            competitorDataText += `[${citationCounter}] ${citation.title} - ${citation.url}\n`;
            allCitations.push({ ...citation, number: citationCounter });
            citationCounter++;
          }
          competitorDataText += '\n';
        }
      } else {
        competitorDataText += `\n## ${competitor.name}\n`;
        competitorDataText += `No recent search data available.\n\n`;
      }
    }
    
    logger?.info('📊 [Step 2.6] Per-competitor search data prepared:', {
      totalCitations: allCitations.length,
      competitorsWithData: competitors.filter(c => perCompetitorSearches[c.slug]?.success).length,
      dataLength: competitorDataText.length,
    });
    
    // Simplified parsing prompt focusing on PER-COMPETITOR Perplexity/SerpAPI answers
    const parsingPrompt = `You are extracting structured competitor intelligence from per-competitor Perplexity/SerpAPI search results about the Carbon Accounting Software market (November 2025).

**PER-COMPETITOR SEARCH RESULTS (PRIMARY SOURCE):**
${competitorDataText}

**YOUR TASK:**
Extract information for each of these 7 competitors based on THEIR SPECIFIC search results above: Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative

For each competitor found in the search results, extract:
- **strategicMoves**: Funding rounds, acquisitions, major announcements (include citation [1], [2], etc.)
- **productUpdates**: New features, product launches, platform updates (include citation)
- **partnerships**: New partnerships, integrations, collaborations (include citation)
- **userFeedback**: User sentiment, reviews, feedback mentioned (include citation)

**OUTPUT FORMAT:**
Return ONLY valid JSON (no markdown, no explanations):
{
  "watershed": {
    "strategicMoves": ["Persefoni secured $23M funding [4]", "..."],
    "productUpdates": ["Q3 2025 updates with AI-accelerated reporting [1]", "..."],
    "partnerships": ["Partnership with Microsoft [2]", "..."],
    "userFeedback": ["Users praise comprehensive emissions tracking [5]", "..."]
  },
  "persefoni": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "greenly": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "carbmee": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "osapiens": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "sweep": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "normative": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] }
}

**RULES:**
- Use empty array [] if no info found for a category
- Include citation numbers [1], [2] in each item
- Include dates when mentioned (e.g., "November 2025", "Q3 2025")
- Be specific but concise (1-2 sentences per item)
- Only extract factual information from the search results above`;
    
    try {
      logger?.info('🤖 [Step 2.6] Calling Claude Sonnet 4.5 to parse search results...');
      
      const response = await anthropicClient.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: parsingPrompt,
          },
        ],
      });
      
      // Extract JSON from Claude's response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
      
      // Parse JSON (Claude might wrap it in markdown, so extract it)
      let parsedDataStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        parsedDataStr = jsonMatch[1];
      }
      
      const perCompetitorData = JSON.parse(parsedDataStr);
      
      logger?.info('✅ [Step 2.6] Successfully parsed per-competitor data:', {
        competitorsCovered: Object.keys(perCompetitorData).length,
        totalItems: Object.values(perCompetitorData).reduce((sum: number, comp: any) => 
          sum + (comp.strategicMoves?.length || 0) + (comp.productUpdates?.length || 0) + 
          (comp.partnerships?.length || 0) + (comp.userFeedback?.length || 0), 0
        ),
      });
      
      return {
        ...inputData,
        perCompetitorData,
      };
    } catch (error) {
      logger?.error('❌ [Step 2.6] Failed to parse search results:', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Return empty structure on error
      const emptyStructure = {
        watershed: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
        persefoni: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
        greenly: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
        carbmee: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
        osapiens: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
        sweep: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
        normative: { strategicMoves: [], productUpdates: [], partnerships: [], userFeedback: [] },
      };
      
      return {
        ...inputData,
        perCompetitorData: emptyStructure,
      };
    }
  },
});

const analyzeAndCompileReport = createStep({
  id: "analyze-and-compile-report",
  description: "Agent analyzes gathered data and compiles comprehensive weekly market research report",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    metricsGathered: z.boolean(),
    competitorTrends: z.any().optional(),
    perCompetitorData: z.any(), // NEW: Structured per-competitor data
  }),
  
  outputSchema: z.object({
    reportId: z.number(),
    runId: z.string(),
    summary: z.string(),
    weekRangeLabel: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🤖 [Step 3] Agent analyzing market data and compiling report...');
    
    // Load curated data from database using runId
    logger?.info('💾 [Step 3] Loading curated data from database:', { runId: inputData.runId });
    const sources = await db.getReportSources(inputData.runId);
    
    if (!sources) {
      logger?.error('❌ [Step 3] No curated data found for runId:', { runId: inputData.runId });
      throw new Error(`Curated data not found for runId: ${inputData.runId}`);
    }
    
    logger?.info('✅ [Step 3] Curated data loaded:', {
      competitorDataSize: JSON.stringify(sources.competitorData).length,
      industryDataSize: JSON.stringify(sources.industryData).length,
      reviewsDataSize: JSON.stringify(sources.reviewsData).length,
    });
    
    // Load competitor metrics from database
    logger?.info('💰 [Step 3] Loading competitor metrics from database...');
    const dateEnd = new Date(inputData.dateEnd);
    const dayOfWeek = dateEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const reportingWeekStart = new Date(dateEnd);
    reportingWeekStart.setDate(reportingWeekStart.getDate() - daysToMonday);
    reportingWeekStart.setHours(0, 0, 0, 0);
    
    const allMetrics = await db.getAllLatestCompetitorMetrics(reportingWeekStart);
    logger?.info(`✅ [Step 3] Loaded metrics for ${allMetrics.length} competitors`);
    
    // Format metrics for prompt with trend indicators
    const formatMetricWithTrend = (value: number | string | null | undefined, trend: any, unit: string = ''): string => {
      if (value === null || value === undefined) return 'Data not available';
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return 'Data not available';
      const valueStr = unit === '$M' ? `$${(numValue / 1000000).toFixed(1)}M` : 
                       unit === '%' ? `${numValue}%` :
                       numValue.toString();
      const trendStr = trend?.formattedChange || '';
      return trendStr ? `${valueStr} ${trendStr}` : valueStr;
    };
    
    const metricsText = allMetrics.length > 0 
      ? allMetrics.map(m => {
          const trends = inputData.competitorTrends?.[m.competitorSlug]?.trends || {};
          return `${m.competitorSlug}: ${m.revenueUsd ? formatMetricWithTrend(m.revenueUsd, trends.revenue, '$M') + ' revenue, ' : ''}${m.valuationUsd ? formatMetricWithTrend(m.valuationUsd, trends.valuation, '$M') + ' valuation, ' : ''}${m.fundingTotalUsd ? formatMetricWithTrend(m.fundingTotalUsd, trends.fundingTotal, '$M') + ' funding, ' : ''}${m.employeeCount ? formatMetricWithTrend(m.employeeCount, trends.employeeCount) + ' employees, ' : ''}${m.customerCount ? formatMetricWithTrend(m.customerCount, trends.customerCount) + ' customers, ' : ''}${m.userBase ? formatMetricWithTrend(m.userBase, trends.userBase) + ' users, ' : ''}${m.churnRate ? formatMetricWithTrend(m.churnRate, trends.churnRate, '%') + ' churn, ' : ''}${m.retentionRate ? formatMetricWithTrend(m.retentionRate, trends.retentionRate, '%') + ' retention, ' : ''}${m.userGrowthRate ? formatMetricWithTrend(m.userGrowthRate, trends.userGrowthRate, '%') + ' user growth' : ''}`;
        }).join('\n')
      : 'No competitor metrics available (will be populated after first run)';
    
    // Calculate flexible timespan parameters for agent prompt (reusing dateEnd from metrics section)
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = `${monthNames[dateEnd.getMonth()]} ${dateEnd.getFullYear()}`;
    const productUpdatesLookback = "1 month";
    
    // Validate data completeness and provide structured summaries
    // Note: reviewsData is an object with { competitors: [...] }, not a plain array
    const competitorCount = Array.isArray(sources.competitorData) ? sources.competitorData.length : 0;
    const reviewsCount = (sources.reviewsData?.competitors && Array.isArray(sources.reviewsData.competitors)) 
      ? sources.reviewsData.competitors.length 
      : 0;
    const industryCount = Array.isArray(sources.industryData) ? sources.industryData.length : 0;
    
    logger?.info('📊 [Step 3] Data completeness check:', {
      competitorDataItems: competitorCount,
      reviewsDataItems: reviewsCount,
      industryDataItems: industryCount,
      reviewsDataStructure: sources.reviewsData ? Object.keys(sources.reviewsData) : 'null',
    });
    
    // Smart summarization with bounded size per category (prevents token overflow)
    const createBoundedSummary = (data: any, maxChars: number = 10000): string => {
      if (!data) return '_No data available_';
      const jsonStr = JSON.stringify(data, null, 2);
      if (jsonStr.length <= maxChars) return jsonStr;
      
      // Intelligently truncate while preserving structure
      const truncated = jsonStr.substring(0, maxChars);
      const lastCompleteObject = truncated.lastIndexOf('},');
      return lastCompleteObject > 0 
        ? truncated.substring(0, lastCompleteObject + 2) + '\n  ...[Additional items truncated - see full data above]\n]'
        : truncated + '...[truncated]';
    };
    
    // Ensure all competitors are represented with data summary
    const allCompetitors = ['watershed', 'persefoni', 'greenly', 'carbmee', 'osapiens', 'sweep', 'normative'];
    const competitorDataMap = new Map();
    if (Array.isArray(sources.competitorData)) {
      sources.competitorData.forEach((item: any) => {
        const slug = item.competitorSlug || item.competitor;
        if (slug && !competitorDataMap.has(slug)) {
          competitorDataMap.set(slug, []);
        }
        if (slug) {
          competitorDataMap.get(slug).push(item);
        }
      });
    }
    
    // Log which competitors have data
    const competitorsWithData = Array.from(competitorDataMap.keys());
    const competitorsWithoutData = allCompetitors.filter(c => !competitorsWithData.includes(c));
    logger?.info('📊 [Step 3] Competitor coverage:', {
      withData: competitorsWithData,
      withoutData: competitorsWithoutData,
    });
    
    const prompt = `
You are conducting the weekly Carbon Accounting Software market research for the period: ${inputData.dateStart} to ${inputData.dateEnd}.

**FLEXIBLE TIMESPAN PARAMETERS FOR CONTENT FILTERING**:
- Current Calendar Month: ${currentMonth} (use for press releases and user reviews)
- Product Updates Lookback: ${productUpdatesLookback} (use for product updates/releases)
- General News: 7 days (${inputData.dateStart} to ${inputData.dateEnd})

You have been provided with comprehensive market intelligence from BOTH curated sources AND web searches.

## 🎯 STRUCTURED PER-COMPETITOR DATA (PRIORITY - USE THIS FIRST!):

We have pre-parsed the web search results into structured data for each competitor. **USE THIS DATA DIRECTLY for populating Competitor Spotlights sections**:

${JSON.stringify(inputData.perCompetitorData, null, 2)}

**HOW TO USE THIS DATA:**
- For each competitor (watershed, persefoni, greenly, carbmee, osapiens, sweep, normative):
  - **Strategic Moves** section → Use items from perCompetitorData[competitor].strategicMoves
  - **Product Updates** section → Use items from perCompetitorData[competitor].productUpdates
  - **Partnerships & Integrations** section → Use items from perCompetitorData[competitor].partnerships
  - **User Feedback** section → Use items from perCompetitorData[competitor].userFeedback
- If an array is empty [], write "_No [section name] this week._"
- Citation numbers [1], [2], etc. are already included in the items

## WEB SEARCH RESULTS (Primary Intelligence):

### Broad Market Pulse Search:
**Query**: Carbon accounting software news this week
**Answer**: ${inputData.webSearchResults.broadPulseSearch.answer || 'No answer available'}
**Citations**: ${JSON.stringify(inputData.webSearchResults.broadPulseSearch.citations || [], null, 2)}

### Targeted Market Data Search:
**Query**: Carbon accounting software market size, growth, investment trends
**Answer**: ${inputData.webSearchResults.targetedFollowUpSearch.answer || 'No answer available'}
**Citations**: ${JSON.stringify(inputData.webSearchResults.targetedFollowUpSearch.citations || [], null, 2)}

## CURATED SOURCE DATA (Structured with Bounded Summaries):

### Competitor News Data (${competitorCount} items covering ${competitorsWithData.length}/7 competitors):
**Competitors with data**: ${competitorsWithData.join(', ') || 'None'}
**Competitors without curated data** (use web search for these): ${competitorsWithoutData.join(', ') || 'None'}
${createBoundedSummary(sources.competitorData, 15000)}

### Industry Reports Data (${industryCount} items):
${createBoundedSummary(sources.industryData, 10000)}

### User Reviews Data (${reviewsCount} items - MUST analyze ALL):
${createBoundedSummary(sources.reviewsData, 10000)}

## COMPETITOR METRICS (From Database):

${metricsText}

**YOUR TASK:**
1. **Prioritize web search results** - they provide the most comprehensive, recent market intelligence
2. Use curated sources to supplement and validate findings from web searches
3. **Apply flexible timespan filtering based on content type (DEFAULT TO INCLUSION FOR CURRENT MONTH)**:
   - General news/announcements: 7 days (${inputData.dateStart} to ${inputData.dateEnd}), but include current month if no recent news
   - Product updates/releases: ${productUpdatesLookback} lookback - INCLUDE ALL from ${currentMonth}
   - Press releases: **ALL from ${currentMonth}** (November 1-21 if generated on Nov 21) - DO NOT exclude early-month press releases
   - User reviews: **ALL from ${currentMonth}** (November 1-21 if generated on Nov 21) - DO NOT exclude early-month reviews
   - Case studies: ${productUpdatesLookback} lookback - INCLUDE ALL from ${currentMonth}
4. Filter out outdated information from 2020-2024 or earlier years only
5. **ANTI-PATTERN**: Do NOT say "No new updates this week" if there are updates from earlier in ${currentMonth}
6. Generate a comprehensive market research report following the exact structure in your instructions
7. Create a brief 2-3 sentence executive summary highlighting the most important findings

**MANDATORY CONTENT REQUIREMENTS (MUST BE POPULATED)**:
You MUST include ALL of the following sections in your report. If data is missing for a section, write "_No updates found for [section name]._" instead of omitting the section entirely.

✅ **REQUIRED SECTIONS**:
- Executive Summary (ALWAYS required)
- Recent Carbon Accounting Market News (ALWAYS required - write "_No significant market news this week._" if empty)
- Competitor Spotlights for ALL 7 competitors (Watershed, Persefoni, Greenly, carbmee, osapiens, Sweep, Normative) - ALWAYS required, write "_No updates found for [competitor]._" if no data
- User Sentiment & Reviews (ALWAYS required - ${reviewsCount} reviews provided, MUST summarize ALL)
- Industry Trends & Emerging Themes (ALWAYS required)
- Market Opportunities (ALWAYS required)
- Potential Threats & Risks (ALWAYS required)
- Sources & Citations (ALWAYS required - include ALL citations from web searches)

**CRITICAL DATA VALIDATION**:
- User Reviews: You have ${reviewsCount} review items in the curated data - YOU MUST analyze and summarize ALL of them
- Competitor Data: You have ${competitorCount} competitor items - YOU MUST create spotlights for ALL 7 competitors using this data
- Industry Data: You have ${industryCount} industry items - YOU MUST extract sustainability tech trends and market insights
- If any competitor has no data in the curated sources, use web search results to find updates or write "_No updates found._"

**CRITICAL INCLUSION RULES**: 
- **When in doubt about current month content, INCLUDE IT** - Don't be overly restrictive
- The web search results are COMPREHENSIVE - you have sufficient data to generate the full report
- Additional tool calls are OPTIONAL and only needed for specific gaps (e.g., missing user sentiment)
- You have a budget of up to 3 tool calls if needed, but the provided data should be sufficient
- Include ALL citations from web searches in your Sources & Citations section
- Focus on actionable insights for Climatiq.io's product strategy
- **Example**: If generating a report on Nov 21, include Watershed's CDP partnership announced on Nov 20, Greenly's EcoPilot from earlier in November, etc.

Generate the complete markdown report now using the web search results as your primary source and ensuring ALL ${competitorCount + reviewsCount + industryCount} curated data items are analyzed.
`;
    
    const response = await dapMarketResearchAgent.generateLegacy(
      [{ role: "user", content: prompt }],
      {
        resourceId: "weekly-research",
        threadId: `weekly-research-${inputData.runId}`, // Use unique runId instead of dateEnd to avoid memory conflicts
        maxSteps: 5, // Allow agent to complete tool calls (up to 3) AND generate final report text
      }
    );
    
    logger?.info('✅ [Step 3] Agent analysis and report compilation complete');
    
    // Extract a summary from the report (first paragraph or executive summary)
    const reportText = response.text || '';
    
    // Log response structure for debugging
    logger?.info('📝 [Step 3] Agent response:', {
      hasText: !!response.text,
      textLength: reportText.length,
      textPreview: reportText.substring(0, 200),
      responseKeys: Object.keys(response),
    });
    
    // Validate report content
    if (!reportText || reportText.trim().length === 0) {
      logger?.error('❌ [Step 3] Agent returned empty report text!', {
        response: JSON.stringify(response).substring(0, 500),
      });
      throw new Error('Agent returned empty report text - check agent configuration and prompt');
    }
    
    const summaryMatch = reportText.match(/##\s*Executive Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    const summary = summaryMatch 
      ? summaryMatch[1].trim().substring(0, 500) 
      : reportText.substring(0, 500);
    
    // Save report to database immediately to avoid Inngest step output size limit
    logger?.info('💾 [Step 3] Saving report to database...');
    const title = `Carbon Accounting Market Research Report - Week of ${inputData.weekRangeLabel}`;
    
    const savedReport = await db.saveReport({
      runId: inputData.runId, // Idempotent writes using unique workflow run identifier
      title,
      reportContent: reportText,
      reportContentHtml: null, // HTML version will be generated later if needed
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      googleDocsUrl: null,
      slackNotificationSent: false,
      triggerType: 'manual', // Will be updated in later step with actual trigger type
    });
    
    const reportId = savedReport.id;
    logger?.info('✅ [Step 3] Report saved to database:', { reportId });
    
    // Optional: Clean up curated data cache to save space
    // await db.deleteReportSources(inputData.runId);
    // logger?.info('🗑️ [Step 3] Curated data cache cleaned up');
    
    return {
      reportId,
      runId: inputData.runId,
      summary,
      weekRangeLabel: inputData.weekRangeLabel,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
    };
  },
});

const exportToGoogleDocs = createStep({
  id: "export-to-google-docs",
  description: "Exports the market research report to Google Docs",
  
  inputSchema: z.object({
    reportId: z.number(),
    runId: z.string(),
    summary: z.string(),
    weekRangeLabel: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
  }),
  
  outputSchema: z.object({
    reportId: z.number(),
    summary: z.string(),
    documentUrl: z.string().optional(),
    exportSuccess: z.boolean(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('📄 [Step 4] Exporting report to Google Docs...');
    
    // Read report from database to avoid passing large content through Inngest steps
    const reportRecord = await db.getReportById(inputData.reportId);
    
    if (!reportRecord || !reportRecord.reportContent) {
      logger?.error('❌ [Step 4] Report not found in database:', { reportId: inputData.reportId });
      return {
        reportId: inputData.reportId,
        summary: inputData.summary,
        documentUrl: undefined,
        exportSuccess: false,
        dateStart: inputData.dateStart,
        dateEnd: inputData.dateEnd,
        weekRangeLabel: inputData.weekRangeLabel,
      };
    }
    
    const title = `Carbon Accounting Market Research Report - Week of ${inputData.weekRangeLabel}`;
    
    const result = await googleDocsExportTool.execute({
      context: {
        title,
        content: reportRecord.reportContent,
        reportId: inputData.reportId,
      },
      runtimeContext,
      mastra,
    });
    
    if (result.success) {
      logger?.info('✅ [Step 4] Report exported to Google Docs:', { url: result.documentUrl });
    } else {
      logger?.warn('⚠️ [Step 4] Failed to export to Google Docs:', { error: result.error });
    }
    
    return {
      reportId: inputData.reportId,
      summary: inputData.summary,
      documentUrl: result.documentUrl,
      exportSuccess: result.success,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      weekRangeLabel: inputData.weekRangeLabel,
    };
  },
});

const updateReportMetadata = createStep({
  id: "update-report-metadata",
  description: "Updates report metadata with Google Docs URL and trigger type",
  
  inputSchema: z.object({
    reportId: z.number(),
    summary: z.string(),
    documentUrl: z.string().optional(),
    exportSuccess: z.boolean(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
  }),
  
  outputSchema: z.object({
    reportId: z.number(),
    summary: z.string(),
    documentUrl: z.string().optional(),
    exportSuccess: z.boolean(),
    dateStart: z.string(),
    dateEnd: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💾 [Step 5] Updating report metadata...');
    
    // Update existing report with Google Docs URL and trigger type
    await db.updateReport(inputData.reportId, {
      googleDocsUrl: inputData.documentUrl || null,
      triggerType: (runtimeContext as any).triggerType || 'scheduled',
    });
    
    logger?.info('✅ [Step 5] Report metadata updated:', { reportId: inputData.reportId });
    
    return {
      reportId: inputData.reportId,
      summary: inputData.summary,
      documentUrl: inputData.documentUrl,
      exportSuccess: inputData.exportSuccess,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
    };
  },
});

const sendSlackNotification = createStep({
  id: "send-slack-notification",
  description: "Sends notification to Slack channel with report summary and web/Google Docs links",
  
  inputSchema: z.object({
    reportId: z.number(),
    summary: z.string(),
    documentUrl: z.string().optional(),
    exportSuccess: z.boolean(),
    dateStart: z.string(),
    dateEnd: z.string(),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    reportGenerated: z.boolean(),
    documentUrl: z.string().optional(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💬 [Step 5] Sending Slack notification...');
    
    const channelId = await db.getSetting('slack_channel_id') || "C09SK3N27MH"; // Get from settings or use default
    
    // Construct web version URL (assumes standard Replit deployment URL structure)
    const webVersionUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/reports/${inputData.reportId}`;
    
    const message = `🔔 *Weekly Carbon Accounting Market Research Report*

${inputData.summary}`;
    
    const result = await slackNotificationTool.execute({
      context: {
        channelId,
        message,
        webVersionUrl,
        documentUrl: inputData.documentUrl,
      },
      runtimeContext,
      mastra,
    });
    
    if (result.success) {
      logger?.info('✅ [Step 5] Slack notification sent successfully');
      
      // Mark Slack notification as sent in database
      await db.updateReport(inputData.reportId, { slackNotificationSent: true });
    } else {
      logger?.warn('⚠️ [Step 5] Failed to send Slack notification:', { error: result.error });
    }
    
    logger?.info('🎉 [Workflow Complete] Weekly market research workflow finished successfully');
    
    return {
      success: true,
      reportGenerated: true,
      documentUrl: inputData.documentUrl,
    };
  },
});

export const weeklyMarketResearchWorkflow = createWorkflow({
  id: "weekly-market-research",
  
  // Empty input schema for time-based triggers
  inputSchema: workflowInputSchema,
  
  outputSchema: z.object({
    success: z.boolean(),
    reportGenerated: z.boolean(),
    documentUrl: z.string().optional(),
  }),
})
  .then(determineIntelligentTimespans as any) // Step 0: GPT-5 determines intelligent date ranges
  .then(gatherMarketData as any)
  .then(performWebSearches as any)
  .then(searchFundingMetrics as any)
  .then(searchRevenueMetrics as any)
  .then(searchCustomerMetrics as any)
  .then(searchPerCompetitorIntelligence as any) // Step 2.5.4a: Per-competitor Perplexity/SerpAPI searches
  .then(searchUserFeedback as any) // Step 2.5.4b: Search for user feedback with intelligent timespans
  .then(persistCompetitorMetrics as any)
  .then(calculateCompetitorTrends as any)
  .then(parseCompetitorIntelligence as any) // Step 2.6: Parse Perplexity/SerpAPI results with Claude Sonnet 4.5
  .then(analyzeAndCompileReport as any)
  .then(exportToGoogleDocs as any)
  .then(updateReportMetadata as any)
  .then(sendSlackNotification as any)
  .commit();
