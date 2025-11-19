import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { dapMarketResearchAgent } from "../agents/dapMarketResearchAgent";
import { competitorNewsResearchTool } from "../tools/competitorNewsResearchTool";
import { industryReportsResearchTool } from "../tools/industryReportsResearchTool";
import { userReviewsResearchTool } from "../tools/userReviewsResearchTool";
import { webSearchTool } from "../tools/webSearchTool";
import { webFetchTool } from "../tools/webFetchTool";
import { googleDocsExportTool } from "../tools/googleDocsExportTool";
import { slackNotificationTool } from "../tools/slackNotificationTool";
import { db } from "../storage/db.js";
import { extractMetricsFromText, getAllCompetitorNames } from "../../utils/metricExtraction";

const workflowInputSchema = z.object({});

const gatherMarketData = createStep({
  id: "gather-market-data",
  description: "Gathers market data from competitor newsrooms, industry reports, and user reviews",
  
  inputSchema: workflowInputSchema,
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
  }),
  
  execute: async ({ mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 1] Starting market data gathering...');
    
    // Generate unique run ID for this workflow execution  
    const runId = `run-${Date.now()}`;
    logger?.info('📋 [Step 1] Run ID:', { runId });
    
    // Check if this is the first run by looking for previous reports
    const lastReport = await db.getLastReport();
    const isFirstRun = !lastReport;
    
    // Calculate date range: 90 days for first run, 7 days for subsequent runs
    const dateEnd = new Date();
    const dateStart = new Date();
    const daysToLookBack = isFirstRun ? 90 : 7;
    dateStart.setDate(dateStart.getDate() - daysToLookBack);
    
    const dateStartStr = dateStart.toISOString().split('T')[0];
    const dateEndStr = dateEnd.toISOString().split('T')[0];
    
    // Format week range label for document title (e.g., "Nov 6-13, 2025" or "Aug 15-Nov 13, 2025" for first run)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const weekRangeLabel = startMonth === endMonth && dateStart.getFullYear() === dateEnd.getFullYear()
      ? `${startMonth} ${dateStart.getDate()}-${dateEnd.getDate()}, ${dateEnd.getFullYear()}`
      : `${startMonth} ${dateStart.getDate()}, ${dateStart.getFullYear()}-${endMonth} ${dateEnd.getDate()}, ${dateEnd.getFullYear()}`;
    
    logger?.info('📅 [Step 1] Date range:', { 
      dateStart: dateStartStr, 
      dateEnd: dateEndStr, 
      daysLookback: daysToLookBack, 
      isFirstRun 
    });
    
    // Gather data from all sources
    logger?.info('🏢 [Step 1] Gathering competitor news...');
    const competitorData = await competitorNewsResearchTool.execute({
      context: { dateStart: dateStartStr, dateEnd: dateEndStr },
      runtimeContext,
      mastra,
    });
    
    logger?.info('📊 [Step 1] Gathering industry reports...');
    const industryData = await industryReportsResearchTool.execute({
      context: { dateStart: dateStartStr, dateEnd: dateEndStr },
      runtimeContext,
      mastra,
    });
    
    logger?.info('⭐ [Step 1] Gathering user reviews...');
    const reviewsData = await userReviewsResearchTool.execute({
      context: { dateStart: dateStartStr, dateEnd: dateEndStr },
      runtimeContext,
      mastra,
    });
    
    logger?.info('✅ [Step 1] Market data gathering complete');
    
    // Save curated data to database to avoid Inngest step output size limits
    logger?.info('💾 [Step 1] Saving curated data to database:',{
      competitorDataSize: JSON.stringify(competitorData).length,
      industryDataSize: JSON.stringify(industryData).length,
      reviewsDataSize: JSON.stringify(reviewsData).length,
    });
    
    await db.saveReportSources(runId, competitorData, industryData, reviewsData);
    logger?.info('✅ [Step 1] Curated data saved to database');
    
    // Return only lightweight metadata
    return {
      runId,
      dateStart: dateStartStr,
      dateEnd: dateEndStr,
      weekRangeLabel,
    };
  },
});

const performWebSearches = createStep({
  id: "perform-web-searches",
  description: "Performs two web searches for comprehensive market intelligence",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
  }),
  
  outputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔍 [Step 2] Performing web searches for market intelligence...');
    
    // Calculate date range for search queries
    const dateStart = new Date(inputData.dateStart);
    const dateEnd = new Date(inputData.dateEnd);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const dateRange = `${startMonth} ${dateStart.getDate()}-${endMonth !== startMonth ? endMonth + ' ' : ''}${dateEnd.getDate()} ${dateEnd.getFullYear()}`;
    
    // Search 1: Broad weekly market pulse
    logger?.info('🔍 [Step 2.1] Executing broad weekly market pulse search...');
    const broadPulseQuery = `Carbon accounting software news ${dateRange}: Watershed Persefoni Greenly carbmee osapiens Sweep Normative funding acquisitions product launches partnerships industry trends market analysis`;
    
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
    
    // Search 2: Targeted follow-up (market data focus)
    logger?.info('🔍 [Step 2.2] Executing targeted follow-up search...');
    const targetedQuery = `Carbon accounting software market size growth rate ${dateEnd.getFullYear()} investment trends CAGR analyst reports Forrester Gartner climate tech sustainability ESG market forecast`;
    
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
    
    // Trim web search results to reduce payload size for Inngest step output limits
    // Keep only essential data: truncated answers + trimmed citations
    const trimCitations = (citations: any[]) => 
      citations.slice(0, 3).map(c => ({
        title: c.title?.substring(0, 100) || '', // Trim title to 100 chars
        url: c.url || '',
        // Remove snippet to save space
      }));
    
    const trimmedBroadPulse = {
      success: broadPulseSearch.success,
      query: broadPulseSearch.query,
      answer: broadPulseSearch.answer?.substring(0, 500) || '', // Trim to 500 chars
      citations: trimCitations(broadPulseSearch.citations || []),
      error: broadPulseSearch.error,
    };
    
    const trimmedTargetedSearch = {
      success: targetedFollowUpSearch.success,
      query: targetedFollowUpSearch.query,
      answer: targetedFollowUpSearch.answer?.substring(0, 500) || '', // Trim to 500 chars
      citations: trimCitations(targetedFollowUpSearch.citations || []),
      error: targetedFollowUpSearch.error,
    };
    
    logger?.info('📦 [Step 2] Trimmed web search payloads for Inngest:', {
      broadPulseAnswerLength: trimmedBroadPulse.answer.length,
      targetedAnswerLength: trimmedTargetedSearch.answer.length,
      totalCitations: (trimmedBroadPulse.citations?.length || 0) + (trimmedTargetedSearch.citations?.length || 0),
    });
    
    return {
      runId: inputData.runId,
      dateStart: inputData.dateStart,
      dateEnd: inputData.dateEnd,
      weekRangeLabel: inputData.weekRangeLabel,
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
  description: "Search for competitor funding and valuation data",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
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
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    fundingMetrics: z.array(z.any()),
    reportingWeekStart: z.string(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💸 [Step 2.5.1] Searching for funding and financial data...');
    
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
    
    const competitorNames = getAllCompetitorNames();
    const fundingQuery = `${competitorNames.join(' ')} carbon accounting funding rounds Series A B C valuation revenue 2024 2025 TechCrunch Crunchbase investment`;
    
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
  description: "Search for competitor revenue and employee data",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
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
    logger?.info('📊 [Step 2.5.2] Searching for revenue and employee data...');
    
    const competitorNames = getAllCompetitorNames();
    const revenueQuery = `${competitorNames.join(' ')} carbon accounting software revenue ARR employees headcount company size 2024 2025`;
    
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
  description: "Search for competitor customer count, churn, and retention data",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
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
    logger?.info('👥 [Step 2.5.3] Searching for customer base and churn data...');
    
    const competitorNames = getAllCompetitorNames();
    const customerQuery = `${competitorNames.join(' ')} carbon accounting customers client count user base churn rate retention 2024 2025`;
    
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

// Step 2.5.4: Persist all metrics to database
const persistCompetitorMetrics = createStep({
  id: "persist-competitor-metrics",
  description: "Merge and persist all competitor metrics to database",
  
  inputSchema: z.object({
    runId: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
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
    webSearchResults: z.object({
      broadPulseSearch: z.any(),
      targetedFollowUpSearch: z.any(),
    }),
    metricsGathered: z.boolean(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('💾 [Step 2.5.4] Merging and persisting competitor metrics...');
    
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
    
    logger?.info(`📊 [Step 2.5.4] Merged metrics for ${allMetrics.length} competitors`);
    
    // Store metrics in database
    const reportingWeekStart = new Date(inputData.reportingWeekStart);
    let storedCount = 0;
    
    for (const metrics of allMetrics) {
      try {
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
          dataSourceVersion: 'public-web-search-v1',
          missingSources: [],
          error: null,
        });
        storedCount++;
      } catch (error) {
        logger?.error(`❌ [Step 2.5.4] Failed to store metrics for ${metrics.competitorSlug}:`, error);
      }
    }
    
    logger?.info(`✅ [Step 2.5.4] Stored metrics for ${storedCount}/${allMetrics.length} competitors`);
    
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
    
    // Format metrics for prompt
    const metricsText = allMetrics.length > 0 
      ? allMetrics.map(m => `${m.competitorSlug}: ${m.revenueUsd ? `$${(Number(m.revenueUsd) / 1000000).toFixed(1)}M revenue, ` : ''}${m.fundingTotalUsd ? `$${(Number(m.fundingTotalUsd) / 1000000).toFixed(1)}M funding, ` : ''}${m.lastRoundAmountUsd ? `last round $${(Number(m.lastRoundAmountUsd) / 1000000).toFixed(1)}M (${m.lastRoundType}), ` : ''}${m.employeeCount ? `${m.employeeCount} employees, ` : ''}${m.customerCount ? `${m.customerCount} customers, ` : ''}${m.churnRate ? `${Number(m.churnRate)}% churn, ` : ''}${m.retentionRate ? `${Number(m.retentionRate)}% retention` : ''}`).join('\n')
      : 'No competitor metrics available (will be populated after first run)';
    
    // Trim curated data to avoid prompt size limits (prioritize web search results)
    const trimData = (data: any, maxLength: number = 2000) => {
      const str = JSON.stringify(data, null, 2);
      return str.length > maxLength ? str.substring(0, maxLength) + '...[truncated]' : str;
    };
    
    const prompt = `
You are conducting the weekly Carbon Accounting Software market research for the period: ${inputData.dateStart} to ${inputData.dateEnd}.

You have been provided with comprehensive market intelligence from BOTH curated sources AND web searches.

## WEB SEARCH RESULTS (Primary Intelligence):

### Broad Market Pulse Search:
**Query**: Carbon accounting software news this week
**Answer**: ${inputData.webSearchResults.broadPulseSearch.answer || 'No answer available'}
**Citations**: ${JSON.stringify(inputData.webSearchResults.broadPulseSearch.citations || [], null, 2)}

### Targeted Market Data Search:
**Query**: Carbon accounting software market size, growth, investment trends
**Answer**: ${inputData.webSearchResults.targetedFollowUpSearch.answer || 'No answer available'}
**Citations**: ${JSON.stringify(inputData.webSearchResults.targetedFollowUpSearch.citations || [], null, 2)}

## CURATED SOURCE DATA (Supplementary Intelligence - Trimmed):

### Competitor News Data:
${trimData(sources.competitorData, 3000)}

### Industry Reports Data:
${trimData(sources.industryData, 2000)}

### User Reviews Data:
${trimData(sources.reviewsData, 2000)}

## COMPETITOR METRICS (From Database):

${metricsText}

**YOUR TASK:**
1. **Prioritize web search results** - they provide the most comprehensive, recent market intelligence
2. Use curated sources to supplement and validate findings from web searches
3. Extract and categorize recent developments (from THIS WEEK ONLY: ${inputData.dateStart} to ${inputData.dateEnd})
4. Filter out outdated information from 2020-2024 or earlier
5. Identify temporal clues and focus on "recent", "latest", "new" content
6. Generate a comprehensive market research report following the exact structure in your instructions
7. Create a brief 2-3 sentence executive summary highlighting the most important findings

**CRITICAL**: 
- The web search results are COMPREHENSIVE - you have sufficient data to generate the full report
- Additional tool calls are OPTIONAL and only needed for specific gaps (e.g., missing user sentiment)
- You have a budget of up to 3 tool calls if needed, but the provided data should be sufficient
- Include ALL citations from web searches in your Sources & Citations section
- Be intelligent about temporal relevance - exclude outdated content
- Focus on actionable insights for Climatiq.io's product strategy

Generate the complete markdown report now using the web search results as your primary source.
`;
    
    const response = await dapMarketResearchAgent.generateLegacy(
      [{ role: "user", content: prompt }],
      {
        resourceId: "weekly-research",
        threadId: `weekly-research-${inputData.dateEnd}`,
        maxSteps: 3, // Limited to 3 steps to respect Perplexity API rate limits (3 requests/min)
      }
    );
    
    logger?.info('✅ [Step 3] Agent analysis and report compilation complete');
    
    // Extract a summary from the report (first paragraph or executive summary)
    const reportText = response.text;
    const summaryMatch = reportText.match(/##\s*Executive Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    const summary = summaryMatch 
      ? summaryMatch[1].trim().substring(0, 500) 
      : reportText.substring(0, 500);
    
    // Save report to database immediately to avoid Inngest step output size limit
    logger?.info('💾 [Step 3] Saving report to database...');
    const title = `Carbon Accounting Market Research Report - Week of ${inputData.weekRangeLabel}`;
    
    const savedReport = await db.saveReport({
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
    
    const message = `
🔔 *Weekly Carbon Accounting Market Research Report*

${inputData.summary}

📊 View the full report in your browser or Google Docs (links below)
`;
    
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
  .then(gatherMarketData as any)
  .then(performWebSearches as any)
  .then(searchFundingMetrics as any)
  .then(searchRevenueMetrics as any)
  .then(searchCustomerMetrics as any)
  .then(persistCompetitorMetrics as any)
  .then(analyzeAndCompileReport as any)
  .then(exportToGoogleDocs as any)
  .then(updateReportMetadata as any)
  .then(sendSlackNotification as any)
  .commit();
