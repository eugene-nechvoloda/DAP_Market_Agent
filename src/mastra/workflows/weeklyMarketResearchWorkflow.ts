import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { dapMarketResearchAgent } from "../agents/dapMarketResearchAgent";
import { competitorNewsResearchTool } from "../tools/competitorNewsResearchTool";
import { industryReportsResearchTool } from "../tools/industryReportsResearchTool";
import { userReviewsResearchTool } from "../tools/userReviewsResearchTool";
import { googleDocsExportTool } from "../tools/googleDocsExportTool";
import { slackNotificationTool } from "../tools/slackNotificationTool";

const gatherMarketData = createStep({
  id: "gather-market-data",
  description: "Gathers market data from competitor newsrooms, industry reports, and user reviews",
  
  inputSchema: z.object({}),
  
  outputSchema: z.object({
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    competitorData: z.any(),
    industryData: z.any(),
    reviewsData: z.any(),
  }),
  
  execute: async ({ mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 1] Starting market data gathering...');
    
    // Calculate date range: last 7 days
    const dateEnd = new Date();
    const dateStart = new Date();
    dateStart.setDate(dateStart.getDate() - 7);
    
    const dateStartStr = dateStart.toISOString().split('T')[0];
    const dateEndStr = dateEnd.toISOString().split('T')[0];
    
    // Format week range label for document title (e.g., "Nov 6-13, 2025")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startMonth = monthNames[dateStart.getMonth()];
    const endMonth = monthNames[dateEnd.getMonth()];
    const weekRangeLabel = startMonth === endMonth 
      ? `${startMonth} ${dateStart.getDate()}-${dateEnd.getDate()}, ${dateEnd.getFullYear()}`
      : `${startMonth} ${dateStart.getDate()}-${endMonth} ${dateEnd.getDate()}, ${dateEnd.getFullYear()}`;
    
    logger?.info('📅 [Step 1] Date range:', { dateStart: dateStartStr, dateEnd: dateEndStr });
    
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
    
    return {
      dateStart: dateStartStr,
      dateEnd: dateEndStr,
      weekRangeLabel,
      competitorData,
      industryData,
      reviewsData,
    };
  },
});

const analyzeAndCompileReport = createStep({
  id: "analyze-and-compile-report",
  description: "Agent analyzes gathered data and compiles comprehensive weekly market research report",
  
  inputSchema: z.object({
    dateStart: z.string(),
    dateEnd: z.string(),
    weekRangeLabel: z.string(),
    competitorData: z.any(),
    industryData: z.any(),
    reviewsData: z.any(),
  }),
  
  outputSchema: z.object({
    report: z.string(),
    summary: z.string(),
    weekRangeLabel: z.string(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🤖 [Step 2] Agent analyzing market data and compiling report...');
    
    const prompt = `
You are conducting the weekly DAP market research for the period: ${inputData.dateStart} to ${inputData.dateEnd}.

Here is the raw market data gathered from various sources:

## Competitor News Data:
${JSON.stringify(inputData.competitorData, null, 2)}

## Industry Reports Data:
${JSON.stringify(inputData.industryData, null, 2)}

## User Reviews Data:
${JSON.stringify(inputData.reviewsData, null, 2)}

**YOUR TASK:**
1. Analyze all the raw content provided above
2. Extract and categorize recent developments (from THIS WEEK ONLY: ${inputData.dateStart} to ${inputData.dateEnd})
3. Filter out outdated information from 2020-2024 or earlier
4. Identify temporal clues and focus on "recent", "latest", "new" content
5. Generate a comprehensive market research report following the exact structure in your instructions
6. Create a brief 2-3 sentence executive summary highlighting the most important findings

**CRITICAL**: 
- Use the tools available to you if you need additional information
- Be intelligent about temporal relevance - exclude outdated content
- Include proper citations with source URLs
- Focus on actionable insights for Userlane's product strategy

Generate the complete markdown report now.
`;
    
    const response = await dapMarketResearchAgent.generateLegacy(
      [{ role: "user", content: prompt }],
      {
        resourceId: "weekly-research",
        threadId: `weekly-research-${inputData.dateEnd}`,
        maxSteps: 10, // Allow multiple tool calls for additional research
      }
    );
    
    logger?.info('✅ [Step 2] Agent analysis and report compilation complete');
    
    // Extract a summary from the report (first paragraph or executive summary)
    const reportText = response.text;
    const summaryMatch = reportText.match(/##\s*Executive Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    const summary = summaryMatch 
      ? summaryMatch[1].trim().substring(0, 500) 
      : reportText.substring(0, 500);
    
    return {
      report: reportText,
      summary,
      weekRangeLabel: inputData.weekRangeLabel,
    };
  },
});

const exportToGoogleDocs = createStep({
  id: "export-to-google-docs",
  description: "Exports the market research report to Google Docs",
  
  inputSchema: z.object({
    report: z.string(),
    summary: z.string(),
    weekRangeLabel: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
  }),
  
  outputSchema: z.object({
    report: z.string(),
    summary: z.string(),
    documentUrl: z.string().optional(),
    exportSuccess: z.boolean(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('📄 [Step 3] Exporting report to Google Docs...');
    
    const title = `DAP Market Research Report - Week of ${inputData.weekRangeLabel}`;
    
    const result = await googleDocsExportTool.execute({
      context: {
        title,
        content: inputData.report,
      },
      runtimeContext,
      mastra,
    });
    
    if (result.success) {
      logger?.info('✅ [Step 3] Report exported to Google Docs:', { url: result.documentUrl });
    } else {
      logger?.warn('⚠️ [Step 3] Failed to export to Google Docs:', { error: result.error });
    }
    
    return {
      report: inputData.report,
      summary: inputData.summary,
      documentUrl: result.documentUrl,
      exportSuccess: result.success,
    };
  },
});

const sendSlackNotification = createStep({
  id: "send-slack-notification",
  description: "Sends notification to Slack channel with report summary and Google Docs link",
  
  inputSchema: z.object({
    report: z.string(),
    summary: z.string(),
    documentUrl: z.string().optional(),
    exportSuccess: z.boolean(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    reportGenerated: z.boolean(),
    documentUrl: z.string().optional(),
  }),
  
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('💬 [Step 4] Sending Slack notification...');
    
    const channelId = "C09SK3N27MH"; // User's Slack channel
    
    const message = `
🔔 *Weekly DAP Market Research Report*

${inputData.summary}

${inputData.exportSuccess ? '📄 Full report available in Google Docs (link below)' : '⚠️ Note: Google Docs export failed, but report is available in app'}
`;
    
    const result = await slackNotificationTool.execute({
      context: {
        channelId,
        message,
        documentUrl: inputData.documentUrl,
      },
      runtimeContext,
      mastra,
    });
    
    if (result.success) {
      logger?.info('✅ [Step 4] Slack notification sent successfully');
    } else {
      logger?.warn('⚠️ [Step 4] Failed to send Slack notification:', { error: result.error });
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
  inputSchema: z.object({}) as any,
  
  outputSchema: z.object({
    success: z.boolean(),
    reportGenerated: z.boolean(),
    documentUrl: z.string().optional(),
  }),
})
  .then(gatherMarketData as any)
  .then(analyzeAndCompileReport as any)
  .then(exportToGoogleDocs as any)
  .then(sendSlackNotification as any)
  .commit();
