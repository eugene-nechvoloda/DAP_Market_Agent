import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { dapMarketResearchAgent } from "../agents/dapMarketResearchAgent";
import { getAllCompetitorTrends } from "../../utils/trendCalculation";
import { webSearchTool } from "../tools/webSearchTool";
import { webFetchTool } from "../tools/webFetchTool";
import { googleDocsExportTool } from "../tools/googleDocsExportTool";
import { slackNotificationTool } from "../tools/slackNotificationTool";
import { db } from "../storage/db.js";
import { extractMetricsFromText, getAllCompetitorNames } from "../../utils/metricExtraction";
import { COMPETITOR_SOURCES, INDUSTRY_SOURCES, CompetitorSource } from "../../../shared/constants";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";

const openaiClient = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const anthropicClient = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

const workflowInputSchema = z.object({});

const workflowContextSchema = z.object({
  runId: z.string(),
  generalNewsDateStart: z.string(),
  productUpdatesDateStart: z.string(),
  reviewsDateStart: z.string(),
  pressReleasesDateStart: z.string(),
  dateEnd: z.string(),
  currentMonth: z.string(),
  productUpdatesLookback: z.string(),
  reasoning: z.string(),
  weekRangeLabel: z.string().optional(),
  reportingWeekStart: z.string().optional(),
});

const timespanOutputSchema = z.object({
  runId: z.string(),
  generalNewsDateStart: z.string(),
  productUpdatesDateStart: z.string(),
  reviewsDateStart: z.string(),
  pressReleasesDateStart: z.string(),
  dateEnd: z.string(),
  currentMonth: z.string(),
  productUpdatesLookback: z.string(),
  reasoning: z.string(),
});

// ============================================================================
// STEP 1: DETERMINE INTELLIGENT TIMESPANS (GPT-5)
// ============================================================================
const determineIntelligentTimespans = createStep({
  id: "determine-intelligent-timespans",
  description: "Uses GPT-5 to intelligently determine date ranges for different content types based on current date context",
  
  inputSchema: workflowInputSchema,
  outputSchema: timespanOutputSchema,
  
  execute: async ({ mastra, runId }) => {
    const logger = mastra?.getLogger();
    logger?.info('🧠 [Step 1] Determining intelligent date ranges using GPT-5...');
    logger?.info('📋 [Step 1] Using workflow run ID from context:', { runId });
    
    const now = new Date();
    const dateEnd = now.toISOString().split('T')[0];
    
    const recentReport = await db.hasRecentReport(dateEnd, 5);
    if (recentReport.exists) {
      logger?.info('⏭️ [Step 1] Skipping: A report for this date was already generated recently', {
        existingReportId: recentReport.reportId,
        googleDocsUrl: recentReport.googleDocsUrl,
      });
      throw new Error(`SKIP_DUPLICATE: Report already exists (ID: ${recentReport.reportId}). Skipping duplicate workflow run.`);
    }
    
    const dayOfMonth = now.getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    
    const prevMonthDate = new Date(now);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const previousMonthName = monthNames[prevMonthDate.getMonth()];
    const previousMonthYear = prevMonthDate.getFullYear();
    
    logger?.info(`📅 [Step 1] Current date context: ${currentMonthName} ${dayOfMonth}, ${currentYear}`);
    
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
      
      logger?.info('✅ [Step 1] GPT-5 determined intelligent timespans:', timespans);
      
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
      logger?.error('❌ [Step 1] Failed to determine intelligent timespans, falling back to defaults:', error);
      
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

// ============================================================================
// STEP 2: GATHER COMPETITORS DATA (URL SCRAPING)
// Saves data directly to DB, passes only lightweight context forward
// ============================================================================
const gatherCompetitorsData = createStep({
  id: "gather-competitors-data",
  description: "Scrapes competitor newsrooms, case studies, changelogs, and product updates from curated URLs",
  
  inputSchema: timespanOutputSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🏢 [Step 2] Scraping competitor URLs (newsrooms, case studies, changelogs)...');
    
    const dateEnd = new Date(inputData.dateEnd);
    const dateStart = new Date(inputData.generalNewsDateStart);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const weekRangeLabel = startMonth === endMonth && dateStart.getFullYear() === dateEnd.getFullYear()
      ? `${startMonth} ${dateStart.getDate()}-${dateEnd.getDate()}, ${dateEnd.getFullYear()}`
      : `${startMonth} ${dateStart.getDate()}, ${dateStart.getFullYear()}-${endMonth} ${dateEnd.getDate()}, ${dateEnd.getFullYear()}`;
    
    const competitorScrapedData: any[] = [];
    
    const categoriesToScrape = ['news', 'case_studies', 'changelog', 'product_updates', 'analyst_reports'];
    
    for (const [slug, source] of Object.entries(COMPETITOR_SOURCES)) {
      logger?.info(`📰 [Step 2] Scraping ${source.name}...`);
      let itemsScraped = 0;
      
      for (const urlConfig of source.urls) {
        if (!categoriesToScrape.includes(urlConfig.category)) continue;
        
        let dateFilter: string;
        switch (urlConfig.timeFilter) {
          case '7days': dateFilter = inputData.generalNewsDateStart; break;
          case 'current_month': dateFilter = inputData.pressReleasesDateStart; break;
          case '1month': dateFilter = inputData.productUpdatesDateStart; break;
          case 'quarter': dateFilter = inputData.productUpdatesDateStart; break;
          default: dateFilter = inputData.generalNewsDateStart;
        }
        
        try {
          const fetchResult = await webFetchTool.execute({
            context: { url: urlConfig.url },
            runtimeContext,
            mastra,
          });
          
          if (fetchResult.success && fetchResult.content) {
            competitorScrapedData.push({
              competitorSlug: slug,
              competitorName: source.name,
              category: urlConfig.category,
              sourceName: urlConfig.sourceName,
              url: urlConfig.url,
              content: fetchResult.content.substring(0, 8000),
              dateFilter,
              timeFilter: urlConfig.timeFilter,
            });
            itemsScraped++;
            logger?.info(`✅ [Step 2] Scraped ${urlConfig.sourceName} for ${source.name}`);
          }
        } catch (error) {
          logger?.warn(`⚠️ [Step 2] Failed to scrape ${urlConfig.url}:`, error);
        }
      }
      
      logger?.info(`📊 [Step 2] ${source.name}: ${itemsScraped} sources scraped`);
    }
    
    logger?.info(`💾 [Step 2] Saving ${competitorScrapedData.length} competitor items to DB...`);
    await db.updateCompetitorSources(inputData.runId, competitorScrapedData);
    
    logger?.info('✅ [Step 2] Competitor URL scraping complete');
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel,
    };
  },
});

// ============================================================================
// STEP 3: INDUSTRY REPORTS/ARTICLES SCRAPING
// Saves data directly to DB, passes only lightweight context forward
// ============================================================================
const gatherIndustryData = createStep({
  id: "gather-industry-data",
  description: "Scrapes 6 industry source URLs (Gartner, G2, ProductLed, SaaStr, etc.)",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [Step 3] Scraping industry source URLs...');
    
    const industryScrapedData: any[] = [];
    
    for (const source of INDUSTRY_SOURCES) {
      logger?.info(`📰 [Step 3] Scraping ${source.name}...`);
      
      try {
        const fetchResult = await webFetchTool.execute({
          context: { url: source.url },
          runtimeContext,
          mastra,
        });
        
        if (fetchResult.success && fetchResult.content) {
          industryScrapedData.push({
            name: source.name,
            url: source.url,
            description: source.description,
            content: fetchResult.content.substring(0, 8000),
            dateFilter: inputData.generalNewsDateStart,
          });
          logger?.info(`✅ [Step 3] Scraped ${source.name}`);
        }
      } catch (error) {
        logger?.warn(`⚠️ [Step 3] Failed to scrape ${source.url}:`, error);
      }
    }
    
    logger?.info(`💾 [Step 3] Saving ${industryScrapedData.length} industry items to DB...`);
    await db.updateIndustrySources(inputData.runId, industryScrapedData);
    
    logger?.info(`✅ [Step 3] Industry scraping complete: ${industryScrapedData.length} sources`);
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel: inputData.weekRangeLabel,
    };
  },
});

// ============================================================================
// STEP 4: REAL USER REVIEWS (G2/GARTNER SCRAPING)
// Saves data directly to DB, passes only lightweight context forward
// ============================================================================
const gatherUserReviews = createStep({
  id: "gather-user-reviews",
  description: "Scrapes G2 and Gartner review URLs for all competitors",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('⭐ [Step 4] Scraping G2 and Gartner review URLs...');
    
    const reviewsScrapedData: any[] = [];
    const reviewCategories = ['g2_reviews', 'gartner_reviews', 'gartner_likes_dislikes'];
    
    for (const [slug, source] of Object.entries(COMPETITOR_SOURCES)) {
      logger?.info(`⭐ [Step 4] Scraping reviews for ${source.name}...`);
      let reviewsScraped = 0;
      
      for (const urlConfig of source.urls) {
        if (!reviewCategories.includes(urlConfig.category)) continue;
        
        try {
          const fetchResult = await webFetchTool.execute({
            context: { url: urlConfig.url },
            runtimeContext,
            mastra,
          });
          
          if (fetchResult.success && fetchResult.content) {
            reviewsScrapedData.push({
              competitorSlug: slug,
              competitorName: source.name,
              category: urlConfig.category,
              sourceName: urlConfig.sourceName,
              url: urlConfig.url,
              content: fetchResult.content.substring(0, 6000),
              dateFilter: inputData.reviewsDateStart,
            });
            reviewsScraped++;
            logger?.info(`✅ [Step 4] Scraped ${urlConfig.sourceName} for ${source.name}`);
          }
        } catch (error) {
          logger?.warn(`⚠️ [Step 4] Failed to scrape ${urlConfig.url}:`, error);
        }
      }
      
      logger?.info(`📊 [Step 4] ${source.name}: ${reviewsScraped} review sources scraped`);
    }
    
    logger?.info(`💾 [Step 4] Saving ${reviewsScrapedData.length} review items to DB...`);
    await db.updateReviewsSources(inputData.runId, reviewsScrapedData);
    
    logger?.info('✅ [Step 4] Review URL scraping complete');
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel: inputData.weekRangeLabel,
    };
  },
});

// ============================================================================
// STEP 5: GENERAL WEB SEARCH (Market Intelligence)
// Saves search results to DB, passes only lightweight context forward
// ============================================================================
const performGeneralWebSearch = createStep({
  id: "perform-general-web-search",
  description: "Performs general market intelligence web search (strategic moves, M&A, partnerships)",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [Step 5] Performing general market intelligence web search...');
    
    const dateStart = new Date(inputData.generalNewsDateStart);
    const dateEnd = new Date(inputData.dateEnd);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const dateRange = `${startMonth} ${dateStart.getDate()}-${endMonth !== startMonth ? endMonth + ' ' : ''}${dateEnd.getDate()} ${dateEnd.getFullYear()}`;
    
    const executeSearch = async (query: string, label: string): Promise<any> => {
      logger?.info(`📝 [Step 5] ${label} query:`, query);
      try {
        const result = await webSearchTool.execute({
          context: { query, maxResults: 5 },
          runtimeContext,
          mastra,
        });
        logger?.info(`✅ [Step 5] ${label} completed:`, { success: result.success, citationsCount: result.citations?.length || 0 });
        return {
          success: result.success,
          query: result.query,
          answer: (result.answer || '').substring(0, 2000),
          citations: (result.citations || []).slice(0, 5).map(c => ({
            title: c.title?.substring(0, 150) || '',
            url: c.url || '',
          })),
          error: result.error,
        };
      } catch (error) {
        logger?.error(`❌ [Step 5] ${label} failed:`, error);
        return { success: false, query, answer: '', citations: [], error: String(error) };
      }
    };
    
    const broadPulseQuery = `Digital adoption platform news ${dateRange}: WalkMe Whatfix Pendo Appcues Apty strategic moves announcements industry trends`;
    const mnaQuery = `Digital adoption platform M&A acquisitions mergers ${dateRange}: WalkMe Whatfix Pendo Appcues Apty company acquired bought sold`;
    const partnershipsQuery = `Digital adoption platform partnerships integrations alliances ${dateRange}: WalkMe Whatfix Pendo Appcues Apty partner integration technology alliance`;
    const competitiveQuery = `Digital adoption platform comparison review analysis ${dateRange}: WalkMe vs Whatfix vs Pendo vs Appcues vs Apty competitive positioning`;
    const productThemesQuery = `Digital adoption platform product updates features launches ${dateRange}: AI-powered onboarding in-app guidance analytics machine learning automation`;
    
    logger?.info('🔍 [Step 5] Executing 5 thematic searches in parallel...');
    
    const [broadPulseSearch, mnaSearch, partnershipsSearch, competitiveSearch, productThemesSearch] = await Promise.all([
      executeSearch(broadPulseQuery, 'Broad Pulse'),
      executeSearch(mnaQuery, 'M&A'),
      executeSearch(partnershipsQuery, 'Partnerships'),
      executeSearch(competitiveQuery, 'Competitive'),
      executeSearch(productThemesQuery, 'Product Themes'),
    ]);
    
    const competitors = [
      { name: "WalkMe", slug: "walkme" },
      { name: "Whatfix", slug: "whatfix" },
      { name: "Pendo", slug: "pendo" },
      { name: "Appcues", slug: "appcues" },
      { name: "Apty", slug: "apty" },
    ];
    
    logger?.info('🔍 [Step 5] Executing 5 per-competitor searches in parallel...');
    
    const searchPromises = competitors.map(async (competitor) => {
      const query = `${competitor.name} digital adoption platform latest news ${dateRange}, product updates, launches, press releases, new features, partnerships, customer wins`;
      
      try {
        const searchResult = await webSearchTool.execute({
          context: { query, maxResults: 5 },
          runtimeContext,
          mastra,
        });
        
        logger?.info(`✅ [Step 5] Per-competitor search for ${competitor.name} completed`);
        
        return {
          slug: competitor.slug,
          result: {
            success: searchResult.success,
            query: searchResult.query,
            answer: (searchResult.answer || '').substring(0, 2000),
            citations: searchResult.citations?.slice(0, 5).map(c => ({
              title: c.title?.substring(0, 100) || '',
              url: c.url || '',
            })) || [],
            error: searchResult.error,
          },
        };
      } catch (error) {
        logger?.error(`❌ [Step 5] Failed to search for ${competitor.name}:`, error);
        return {
          slug: competitor.slug,
          result: { success: false, query, answer: '', citations: [], error: String(error) },
        };
      }
    });
    
    const searchResults = await Promise.all(searchPromises);
    const perCompetitorSearches: Record<string, any> = {};
    for (const { slug, result } of searchResults) {
      perCompetitorSearches[slug] = result;
    }
    
    logger?.info('✅ [Step 5] All web searches completed:', {
      thematicSearches: 5,
      perCompetitorSearches: Object.keys(perCompetitorSearches).length,
      successfulCompetitorSearches: Object.values(perCompetitorSearches).filter((s: any) => s.success).length,
    });
    
    const generalWebSearch = {
      broadPulse: broadPulseSearch,
      mna: mnaSearch,
      partnerships: partnershipsSearch,
      competitive: competitiveSearch,
      productThemes: productThemesSearch,
    };
    
    logger?.info('💾 [Step 5] Saving general web search results to DB...');
    await db.updateWebSearchData(inputData.runId, { generalWebSearch, perCompetitorSearches }, undefined);
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel: inputData.weekRangeLabel,
    };
  },
});

// ============================================================================
// STEP 6: FINANCIAL WEB SEARCH (Revenue, ARR, Valuation, Funding)
// Saves metrics to DB, passes only lightweight context forward
// ============================================================================
const performFinancialWebSearch = createStep({
  id: "perform-financial-web-search",
  description: "Performs financial metrics web search (revenue, ARR, valuation, funding)",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💰 [Step 6] Performing financial metrics web search...');
    
    const dateEnd = new Date(inputData.dateEnd);
    const dayOfWeek = dateEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const reportingWeekStart = new Date(dateEnd);
    reportingWeekStart.setDate(reportingWeekStart.getDate() - daysToMonday);
    reportingWeekStart.setHours(0, 0, 0, 0);
    
    const competitorNames = getAllCompetitorNames();
    
    const fundingQuery = `${competitorNames.join(' OR ')} digital adoption platform funding rounds Series investment valuation revenue ARR as of ${inputData.currentMonth}`;
    
    logger?.info('📝 [Step 6] Funding query:', fundingQuery);
    
    const fundingSearch = await webSearchTool.execute({
      context: { query: fundingQuery, maxResults: 5 },
      runtimeContext,
      mastra,
    });
    
    let fundingMetrics: any[] = [];
    
    if (fundingSearch.success && fundingSearch.answer) {
      logger?.info('📄 [Step 6] Fetching citation content for metric extraction...');
      const citationTexts: string[] = [fundingSearch.answer];
      
      for (const citation of (fundingSearch.citations || []).slice(0, 3)) {
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
            logger?.warn(`⚠️ [Step 6] Failed to fetch ${citation.url}`);
          }
        }
      }
      
      const fullText = citationTexts.join('\n\n');
      fundingMetrics = await extractMetricsFromText(fullText, competitorNames, logger);
    }
    
    const revenueQuery = `${competitorNames.join(' OR ')} digital adoption platform revenue ARR annual recurring employees headcount company size as of ${inputData.currentMonth}`;
    
    logger?.info('📝 [Step 6] Revenue query:', revenueQuery);
    
    const revenueSearch = await webSearchTool.execute({
      context: { query: revenueQuery, maxResults: 5 },
      runtimeContext,
      mastra,
    });
    
    let revenueMetrics: any[] = [];
    
    if (revenueSearch.success && revenueSearch.answer) {
      const citationTexts: string[] = [revenueSearch.answer];
      
      for (const citation of (revenueSearch.citations || []).slice(0, 3)) {
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
            logger?.warn(`⚠️ [Step 6] Failed to fetch ${citation.url}`);
          }
        }
      }
      
      const fullText = citationTexts.join('\n\n');
      revenueMetrics = await extractMetricsFromText(fullText, competitorNames, logger);
    }
    
    logger?.info(`✅ [Step 6] Financial search complete: ${fundingMetrics.length} funding, ${revenueMetrics.length} revenue metrics`);
    
    const financialWebSearch = {
      fundingSearch: {
        success: fundingSearch.success,
        query: fundingSearch.query,
        answer: (fundingSearch.answer || '').substring(0, 1500),
        citations: (fundingSearch.citations || []).slice(0, 5).map(c => ({ title: c.title?.substring(0, 100) || '', url: c.url || '' })),
      },
      revenueSearch: {
        success: revenueSearch.success,
        query: revenueSearch.query,
        answer: (revenueSearch.answer || '').substring(0, 1500),
        citations: (revenueSearch.citations || []).slice(0, 5).map(c => ({ title: c.title?.substring(0, 100) || '', url: c.url || '' })),
      },
    };
    
    logger?.info('💾 [Step 6] Saving financial web search results to DB...');
    await db.updateWebSearchData(inputData.runId, { financialWebSearch }, undefined);
    
    for (const metric of [...fundingMetrics, ...revenueMetrics]) {
      try {
        await db.saveCompetitorMetrics({
          competitorSlug: metric.competitorSlug,
          reportingWeekStart,
          revenueUsd: metric.revenueUsd,
          revenueRange: metric.revenueRange,
          valuationUsd: metric.valuationUsd,
          employeeCount: metric.employeeCount,
          owlerRawPayload: null,
          owlerSuccess: false,
          fundingTotalUsd: metric.fundingTotalUsd,
          lastRoundAmountUsd: metric.lastRoundAmountUsd,
          lastRoundType: metric.lastRoundType,
          lastRoundDate: metric.lastRoundDate ? new Date(metric.lastRoundDate) : null,
          investorCount: null,
          fundingRounds: null,
          crunchbaseRawPayload: null,
          crunchbaseSuccess: false,
          customerCount: metric.customerCount,
          userBase: metric.userBase,
          churnRate: metric.churnRate,
          retentionRate: metric.retentionRate,
          userGrowthRate: metric.userGrowthRate,
          organicTraffic: null,
          organicKeywords: null,
          semrushRank: null,
          semrushDatabase: null,
          semrushRawPayload: null,
          semrushSuccess: false,
          dataSourceVersion: 'public-web-search-v1',
          missingSources: [],
          error: null,
        });
      } catch (error) {
        logger?.warn(`⚠️ [Step 6] Failed to save metrics for ${metric.competitorSlug}:`, error);
      }
    }
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel: inputData.weekRangeLabel,
      reportingWeekStart: reportingWeekStart.toISOString().split('T')[0],
    };
  },
});

// ============================================================================
// STEP 7: STRATEGIC WEB SEARCH (Customer Base, Churn, Engagement)
// Saves metrics to DB, passes only lightweight context forward
// ============================================================================
const performStrategicWebSearch = createStep({
  id: "perform-strategic-web-search",
  description: "Performs strategic metrics web search (customer base, churn, user engagement)",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🎯 [Step 7] Performing strategic metrics web search...');
    
    const competitorNames = getAllCompetitorNames();
    
    const customerQuery = `${competitorNames.join(' OR ')} digital adoption platform customers client count user base active users churn rate retention user growth as of ${inputData.currentMonth}`;
    
    logger?.info('📝 [Step 7] Customer metrics query:', customerQuery);
    
    const customerSearch = await webSearchTool.execute({
      context: { query: customerQuery, maxResults: 5 },
      runtimeContext,
      mastra,
    });
    
    let customerMetrics: any[] = [];
    
    if (customerSearch.success && customerSearch.answer) {
      const citationTexts: string[] = [customerSearch.answer];
      
      for (const citation of (customerSearch.citations || []).slice(0, 3)) {
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
            logger?.warn(`⚠️ [Step 7] Failed to fetch ${citation.url}`);
          }
        }
      }
      
      const fullText = citationTexts.join('\n\n');
      customerMetrics = await extractMetricsFromText(fullText, competitorNames, logger);
    }
    
    const marketDataQuery = `Digital adoption platform market size growth rate CAGR as of ${inputData.currentMonth}, analyst reports Forrester Gartner, industry forecast, user onboarding market`;
    
    logger?.info('📝 [Step 7] Market data query:', marketDataQuery);
    
    const marketDataSearch = await webSearchTool.execute({
      context: { query: marketDataQuery, maxResults: 5 },
      runtimeContext,
      mastra,
    });
    
    logger?.info(`✅ [Step 7] Strategic search complete: ${customerMetrics.length} customer metrics`);
    
    const strategicWebSearch = {
      customerSearch: {
        success: customerSearch.success,
        query: customerSearch.query,
        answer: (customerSearch.answer || '').substring(0, 1500),
        citations: (customerSearch.citations || []).slice(0, 5).map(c => ({ title: c.title?.substring(0, 100) || '', url: c.url || '' })),
      },
      marketDataSearch: {
        success: marketDataSearch.success,
        query: marketDataSearch.query,
        answer: (marketDataSearch.answer || '').substring(0, 1500),
        citations: (marketDataSearch.citations || []).slice(0, 5).map(c => ({ title: c.title?.substring(0, 100) || '', url: c.url || '' })),
      },
    };
    
    logger?.info('💾 [Step 7] Saving strategic web search results to DB...');
    await db.updateWebSearchData(inputData.runId, { strategicWebSearch }, undefined);
    
    const dateEnd = new Date(inputData.dateEnd);
    const dayOfWeek = dateEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const reportingWeekStart = new Date(dateEnd);
    reportingWeekStart.setDate(reportingWeekStart.getDate() - daysToMonday);
    reportingWeekStart.setHours(0, 0, 0, 0);
    
    for (const metric of customerMetrics) {
      try {
        await db.saveCompetitorMetrics({
          competitorSlug: metric.competitorSlug,
          reportingWeekStart,
          revenueUsd: null,
          revenueRange: null,
          valuationUsd: null,
          employeeCount: null,
          owlerRawPayload: null,
          owlerSuccess: false,
          fundingTotalUsd: null,
          lastRoundAmountUsd: null,
          lastRoundType: null,
          lastRoundDate: null,
          investorCount: null,
          fundingRounds: null,
          crunchbaseRawPayload: null,
          crunchbaseSuccess: false,
          customerCount: metric.customerCount,
          userBase: metric.userBase,
          churnRate: metric.churnRate,
          retentionRate: metric.retentionRate,
          userGrowthRate: metric.userGrowthRate,
          organicTraffic: null,
          organicKeywords: null,
          semrushRank: null,
          semrushDatabase: null,
          semrushRawPayload: null,
          semrushSuccess: false,
          dataSourceVersion: 'public-web-search-v1',
          missingSources: [],
          error: null,
        });
      } catch (error) {
        logger?.warn(`⚠️ [Step 7] Failed to save customer metrics for ${metric.competitorSlug}:`, error);
      }
    }
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel: inputData.weekRangeLabel,
      reportingWeekStart: reportingWeekStart.toISOString().split('T')[0],
    };
  },
});

// ============================================================================
// STEP 8: VERIFY DATA (No longer merges - data already saved by previous steps)
// ============================================================================
const verifyDataSaved = createStep({
  id: "verify-data-saved",
  description: "Verifies all data has been saved to database by previous steps",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📦 [Step 8] Verifying all data has been saved to database...');
    
    const sources = await db.getReportSources(inputData.runId);
    
    logger?.info('📊 [Step 8] Data verification:', {
      hasCompetitorData: sources?.competitorData?.length > 0,
      hasIndustryData: sources?.industryData?.length > 0,
      hasReviewsData: sources?.reviewsData?.length > 0,
      hasWebSearchData: !!sources?.webSearchResults,
    });
    
    logger?.info('✅ [Step 8] Data verification complete');
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      productUpdatesDateStart: inputData.productUpdatesDateStart,
      reviewsDateStart: inputData.reviewsDateStart,
      pressReleasesDateStart: inputData.pressReleasesDateStart,
      reasoning: inputData.reasoning,
      weekRangeLabel: inputData.weekRangeLabel,
      reportingWeekStart: inputData.reportingWeekStart,
    };
  },
});

// ============================================================================
// STEP 9: PARSE COMPETITOR INTELLIGENCE (Claude + Guardrails)
// ============================================================================
const parseCompetitorIntelligence = createStep({
  id: "parse-competitor-intelligence",
  description: "Uses Claude Sonnet 4.5 to parse search results into structured per-competitor information",
  
  inputSchema: workflowContextSchema,
  
  outputSchema: workflowContextSchema,
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📋 [Step 9] Parsing per-competitor search results with Claude Sonnet 4.5...');
    
    const sources = await db.getReportSources(inputData.runId);
    
    if (!sources || !sources.webSearchResults) {
      logger?.warn('⚠️ [Step 9] No web search results found in database');
      return { ...inputData, intelligenceParsed: false };
    }
    
    const perCompetitorSearches = sources.webSearchResults.perCompetitorSearches || {};
    
    const competitors = [
      { name: "WalkMe", slug: "walkme" },
      { name: "Whatfix", slug: "whatfix" },
      { name: "Pendo", slug: "pendo" },
      { name: "Appcues", slug: "appcues" },
      { name: "Apty", slug: "apty" },
    ];
    
    let competitorDataText = '';
    let citationCounter = 1;
    
    for (const competitor of competitors) {
      const searchData = perCompetitorSearches[competitor.slug];
      if (searchData && searchData.success) {
        competitorDataText += `\n## ${competitor.name}\n`;
        competitorDataText += `**Search Result:**\n${searchData.answer}\n\n`;
        
        if (searchData.citations && searchData.citations.length > 0) {
          competitorDataText += `**Sources:**\n`;
          for (const citation of searchData.citations) {
            competitorDataText += `[${citationCounter}] ${citation.title} - ${citation.url}\n`;
            citationCounter++;
          }
          competitorDataText += '\n';
        }
      } else {
        competitorDataText += `\n## ${competitor.name}\n`;
        competitorDataText += `No recent search data available.\n\n`;
      }
    }
    
    const parsingPrompt = `You are extracting structured competitor intelligence from per-competitor search results about the Digital Adoption Platform market (${inputData.currentMonth}).

**PER-COMPETITOR SEARCH RESULTS:**
${competitorDataText}

**YOUR TASK:**
Extract information for each of these 5 competitors: WalkMe, Whatfix, Pendo, Appcues, Apty

For each competitor, extract:
- **strategicMoves**: Funding rounds, acquisitions, major announcements (include citation [1], [2], etc.)
- **productUpdates**: New features, product launches, platform updates (include citation)
- **partnerships**: New partnerships, integrations, collaborations (include citation)
- **userFeedback**: User sentiment, reviews, feedback mentioned (include citation)

**OUTPUT FORMAT:**
Return ONLY valid JSON (no markdown, no explanations):
{
  "walkme": {
    "strategicMoves": ["WalkMe secured $40M Series F funding [4]", "..."],
    "productUpdates": ["Q3 2025 updates with AI-powered guidance [1]", "..."],
    "partnerships": ["Partnership with Salesforce [2]", "..."],
    "userFeedback": ["Users praise comprehensive onboarding workflows [5]", "..."]
  },
  "whatfix": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "pendo": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "appcues": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] },
  "apty": { "strategicMoves": [], "productUpdates": [], "partnerships": [], "userFeedback": [] }
}

**RULES:**
- Use empty array [] if no info found for a category
- Include citation numbers [1], [2] in each item
- Include dates when mentioned
- Be specific but concise`;

    try {
      const response = await anthropicClient.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        temperature: 0.1,
        messages: [{ role: "user", content: parsingPrompt }],
      });
      
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
      
      let parsedDataStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        parsedDataStr = jsonMatch[1];
      }
      
      const perCompetitorData = JSON.parse(parsedDataStr);
      
      logger?.info('✅ [Step 9] Successfully parsed per-competitor data:', {
        competitorsCovered: Object.keys(perCompetitorData).length,
      });
      
      await db.updateWebSearchData(inputData.runId, sources.webSearchResults, perCompetitorData);
      
      return { ...inputData, intelligenceParsed: true };
    } catch (error) {
      logger?.error('❌ [Step 9] Failed to parse search results:', error);
      return { ...inputData, intelligenceParsed: false };
    }
  },
});

// ============================================================================
// STEP 10: CALCULATE COMPETITOR TRENDS
// ============================================================================
const calculateCompetitorTrends = createStep({
  id: "calculate-competitor-trends",
  description: "Calculate trends by comparing current week's metrics vs previous week",
  
  inputSchema: z.object({
    runId: z.string(),
    dateEnd: z.string(),
    currentMonth: z.string(),
    productUpdatesLookback: z.string(),
    generalNewsDateStart: z.string(),
    weekRangeLabel: z.string(),
    reportingWeekStart: z.string(),
    intelligenceParsed: z.boolean(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateEnd: z.string(),
    currentMonth: z.string(),
    productUpdatesLookback: z.string(),
    generalNewsDateStart: z.string(),
    weekRangeLabel: z.string(),
    trendsCalculated: z.boolean(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 [Step 10] Calculating competitor trends vs previous week...');
    
    const reportingWeekStart = new Date(inputData.reportingWeekStart);
    const competitorTrends = await getAllCompetitorTrends(reportingWeekStart);
    
    logger?.info(`✅ [Step 10] Calculated trends for ${Object.keys(competitorTrends).length} competitors`);
    
    return {
      runId: inputData.runId,
      dateEnd: inputData.dateEnd,
      currentMonth: inputData.currentMonth,
      productUpdatesLookback: inputData.productUpdatesLookback,
      generalNewsDateStart: inputData.generalNewsDateStart,
      weekRangeLabel: inputData.weekRangeLabel,
      trendsCalculated: true,
    };
  },
});

// ============================================================================
// STEP 11: ANALYZE AND COMPILE REPORT (GPT-5)
// ============================================================================
const analyzeAndCompileReport = createStep({
  id: "analyze-and-compile-report",
  description: "Agent analyzes gathered data and compiles comprehensive weekly market research report",
  
  inputSchema: z.object({
    runId: z.string(),
    dateEnd: z.string(),
    currentMonth: z.string(),
    productUpdatesLookback: z.string(),
    generalNewsDateStart: z.string(),
    weekRangeLabel: z.string(),
    trendsCalculated: z.boolean(),
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
    logger?.info('🤖 [Step 11] Agent analyzing market data and compiling report...');
    
    const sources = await db.getReportSources(inputData.runId);
    
    if (!sources) {
      logger?.error('❌ [Step 11] No curated data found for runId:', { runId: inputData.runId });
      throw new Error(`Curated data not found for runId: ${inputData.runId}`);
    }
    
    const webSearchResults = sources.webSearchResults || {};
    const perCompetitorData = sources.perCompetitorData || {};
    
    const dateEnd = new Date(inputData.dateEnd);
    const dayOfWeek = dateEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const reportingWeekStart = new Date(dateEnd);
    reportingWeekStart.setDate(reportingWeekStart.getDate() - daysToMonday);
    reportingWeekStart.setHours(0, 0, 0, 0);
    
    const allMetrics = await db.getAllLatestCompetitorMetrics(reportingWeekStart);
    const competitorTrends = await getAllCompetitorTrends(reportingWeekStart);
    
    const competitorCount = sources.competitorData?.length || 0;
    const industryCount = sources.industryData?.length || 0;
    const reviewsCount = sources.reviewsData?.length || 0;
    
    const createBoundedSummary = (data: any[], maxLength: number) => {
      if (!data || data.length === 0) return "No data available";
      const text = JSON.stringify(data, null, 2);
      return text.length > maxLength ? text.substring(0, maxLength) + '...[truncated]' : text;
    };
    
    const formatTrend = (value: number | string | null | undefined, format: string = '') => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'number') {
        if (format === '%') return `${value.toFixed(1)}%`;
        if (format === '$') return `$${(value / 1000000).toFixed(1)}M`;
        return value.toLocaleString();
      }
      return String(value);
    };
    
    const metricsText = allMetrics.map(m => {
      const trends = competitorTrends?.[m.competitorSlug]?.trends || {} as any;
      const churnTrend = trends.churnRate?.formattedChange || '';
      const growthTrend = trends.userGrowthRate?.formattedChange || '';
      return `**${m.competitorSlug}**: Revenue: ${formatTrend(m.revenueUsd, '$')}, Valuation: ${formatTrend(m.valuationUsd, '$')}, Funding: ${formatTrend(m.fundingTotalUsd, '$')}, Employees: ${formatTrend(m.employeeCount)}, Customers: ${formatTrend(m.customerCount)}${churnTrend ? `, Churn: ${churnTrend}` : ''}${growthTrend ? `, User Growth: ${growthTrend}` : ''}`;
    }).join('\n');
    
    const prompt = `You are an expert market research analyst generating a comprehensive weekly market research report for the Digital Adoption Platform (DAP) industry.

**REPORT DATE RANGE:** ${inputData.generalNewsDateStart} to ${inputData.dateEnd}
**CURRENT MONTH:** ${inputData.currentMonth}

## WEB SEARCH RESULTS (PRIMARY DATA SOURCE):

### General Market Intelligence:
**Query**: ${webSearchResults.generalWebSearch?.query || 'Not performed'}
**Answer**: ${webSearchResults.generalWebSearch?.answer || 'No data'}
**Citations**: ${JSON.stringify(webSearchResults.generalWebSearch?.citations || [])}

### Per-Competitor Intelligence (Claude-Parsed):
${JSON.stringify(perCompetitorData, null, 2)}

### Financial Search Results:
${JSON.stringify(webSearchResults.financialWebSearch || {}, null, 2)}

### Strategic Search Results:
${JSON.stringify(webSearchResults.strategicWebSearch || {}, null, 2)}

## CURATED SOURCE DATA:

### Competitor Data (${competitorCount} items):
${createBoundedSummary(sources.competitorData, 12000)}

### Industry Data (${industryCount} items):
${createBoundedSummary(sources.industryData, 8000)}

### User Reviews Data (${reviewsCount} items):
${createBoundedSummary(sources.reviewsData, 8000)}

## COMPETITOR METRICS:
${metricsText || 'No metrics available'}

**YOUR TASK:**
Generate a comprehensive market research report with the following structure:

1. **Executive Summary** (2-3 sentences highlighting key findings)
2. **Recent Digital Adoption Platform Market News**
3. **Competitor Spotlights** (for ALL 5 competitors: WalkMe, Whatfix, Pendo, Appcues, Apty)
4. **User Sentiment & Reviews** (analyze all ${reviewsCount} review items)
5. **Industry Trends & Emerging Themes**
6. **Market Opportunities**
7. **Potential Threats & Risks**
8. **Sources & Citations** (include ALL citations from web searches)

**RULES:**
- Include inline citations [1], [2] for claims
- For each competitor, include: strategic moves, product updates, partnerships, user feedback
- Say "_No updates found for ${inputData.currentMonth}_" (NOT "this week") if no data for a section
- Filter out outdated information from 2024 or earlier
- Be factual and cite sources

Generate the complete markdown report now.`;
    
    const response = await dapMarketResearchAgent.generateLegacy(
      [{ role: "user", content: prompt }],
      {
        resourceId: "weekly-research",
        threadId: `weekly-research-${inputData.runId}`,
        maxSteps: 1,
      }
    );
    
    logger?.info('✅ [Step 11] Agent analysis and report compilation complete');
    
    const reportText = response.text || '';
    
    if (!reportText || reportText.trim().length === 0) {
      logger?.error('❌ [Step 11] Agent returned empty report text!');
      throw new Error('Agent returned empty report text');
    }
    
    const summaryMatch = reportText.match(/##\s*Executive Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim().substring(0, 500) : reportText.substring(0, 500);
    
    const title = `Digital Adoption Platform Market Research Report - Week of ${inputData.weekRangeLabel}`;
    
    const savedReport = await db.saveReport({
      runId: inputData.runId,
      title,
      reportContent: reportText,
      reportContentHtml: null,
      dateStart: inputData.generalNewsDateStart,
      dateEnd: inputData.dateEnd,
      googleDocsUrl: null,
      slackNotificationSent: false,
      triggerType: 'manual',
    });
    
    logger?.info('✅ [Step 11] Report saved to database:', { reportId: savedReport.id });
    
    return {
      reportId: savedReport.id,
      runId: inputData.runId,
      summary,
      weekRangeLabel: inputData.weekRangeLabel,
      dateStart: inputData.generalNewsDateStart,
      dateEnd: inputData.dateEnd,
    };
  },
});

// ============================================================================
// STEP 12: EXPORT TO GOOGLE DOCS
// ============================================================================
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
    logger?.info('📄 [Step 12] Exporting report to Google Docs...');
    
    const reportRecord = await db.getReportById(inputData.reportId);
    
    if (!reportRecord || !reportRecord.reportContent) {
      logger?.error('❌ [Step 12] Report not found in database');
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
    
    const title = `Digital Adoption Platform Market Research Report - Week of ${inputData.weekRangeLabel}`;
    
    const result = await googleDocsExportTool.execute({
      context: { title, content: reportRecord.reportContent, reportId: inputData.reportId },
      runtimeContext,
      mastra,
    });
    
    if (result.success) {
      logger?.info('✅ [Step 12] Report exported to Google Docs:', { url: result.documentUrl });
    } else {
      logger?.warn('⚠️ [Step 12] Failed to export to Google Docs:', { error: result.error });
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

// ============================================================================
// STEP 12B: UPDATE REPORT METADATA
// ============================================================================
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
    logger?.info('💾 [Step 12b] Updating report metadata...');
    
    await db.updateReport(inputData.reportId, {
      googleDocsUrl: inputData.documentUrl || null,
      triggerType: (runtimeContext as any).triggerType || 'scheduled',
    });
    
    logger?.info('✅ [Step 12b] Report metadata updated:', { reportId: inputData.reportId });
    
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

// ============================================================================
// STEP 13: SEND SLACK NOTIFICATION
// ============================================================================
const sendSlackNotification = createStep({
  id: "send-slack-notification",
  description: "Sends notification to Slack channel with report summary and links",
  
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
    logger?.info('💬 [Step 13] Sending Slack notification...');
    
    const channelId = await db.getSetting('slack_channel_id') || "C09SK3N27MH";
    
    const webVersionUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/reports/${inputData.reportId}`;
    
    const message = `🔔 *Weekly Digital Adoption Platform Market Research Report*

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
      logger?.info('✅ [Step 13] Slack notification sent successfully');
      await db.updateReport(inputData.reportId, { slackNotificationSent: true });
    } else {
      logger?.warn('⚠️ [Step 13] Failed to send Slack notification:', { error: result.error });
    }
    
    logger?.info('🎉 [Workflow Complete] Weekly market research workflow finished successfully');
    
    return {
      success: true,
      reportGenerated: true,
      documentUrl: inputData.documentUrl,
    };
  },
});

// ============================================================================
// WORKFLOW DEFINITION - 13 STEPS
// ============================================================================
export const weeklyMarketResearchWorkflow = createWorkflow({
  id: "weekly-market-research",
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    reportGenerated: z.boolean(),
    documentUrl: z.string().optional(),
  }),
})
  .then(determineIntelligentTimespans as any)   // Step 1: GPT-5 determines intelligent date ranges
  .then(gatherCompetitorsData as any)           // Step 2: Scrape competitor URLs (newsrooms, case studies, changelogs)
  .then(gatherIndustryData as any)              // Step 3: Scrape industry source URLs
  .then(gatherUserReviews as any)               // Step 4: Scrape G2/Gartner review URLs
  .then(performGeneralWebSearch as any)         // Step 5: General market intelligence web search
  .then(performFinancialWebSearch as any)       // Step 6: Financial metrics web search
  .then(performStrategicWebSearch as any)       // Step 7: Strategic metrics web search
  .then(verifyDataSaved as any)                  // Step 8: Verify all data saved to database
  .then(parseCompetitorIntelligence as any)     // Step 9: Parse with Claude Sonnet 4.5
  .then(calculateCompetitorTrends as any)       // Step 10: Calculate competitor trends
  .then(analyzeAndCompileReport as any)         // Step 11: Generate report with GPT-5
  .then(exportToGoogleDocs as any)              // Step 12: Export to Google Docs
  .then(updateReportMetadata as any)            // Step 12b: Update report metadata
  .then(sendSlackNotification as any)           // Step 13: Send Slack notification
  .commit();
