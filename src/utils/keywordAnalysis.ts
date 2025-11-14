import { DatabaseService } from '../mastra/storage/db';
import { keywordOccurrences } from '../../shared/schema';
import { and, eq, sql, lt } from 'drizzle-orm';

export interface KeywordInsight {
  keyword: string;
  frequency: number;
  contextType: string;
  isNew: boolean; // True if this keyword never appeared before
  firstSeenAt: string; // ISO date when first seen
  previousFrequency: number | null; // Frequency in previous weeks (if any)
}

export interface KeywordAnalysisResult {
  newKeywords: KeywordInsight[]; // Keywords appearing for the first time
  risingKeywords: KeywordInsight[]; // Keywords with increased frequency
  allKeywords: KeywordInsight[];
  summary: string;
}

/**
 * Analyze keywords to identify emerging trends by comparing against historical data
 */
export async function analyzeKeywords(
  keywords: Array<{ keyword: string; frequency: number; contextType: string }>,
  reportingWeekStart: string, // ISO date string (YYYY-MM-DD)
  dbService: DatabaseService
): Promise<KeywordAnalysisResult> {
  const newKeywords: KeywordInsight[] = [];
  const risingKeywords: KeywordInsight[] = [];
  const allKeywords: KeywordInsight[] = [];
  
  const db = dbService.orm;
  
  // Convert ISO string to Date object for Drizzle queries
  const reportingWeekDate = new Date(reportingWeekStart);
  
  for (const kw of keywords) {
    const normalizedKeyword = kw.keyword.toLowerCase().trim();
    
    // Check if this keyword has been seen before (in any week)
    const historicalRecords = await db
      .select()
      .from(keywordOccurrences)
      .where(
        and(
          eq(keywordOccurrences.keyword, normalizedKeyword),
          eq(keywordOccurrences.contextType, kw.contextType)
        )
      )
      .orderBy(sql`${keywordOccurrences.reportingWeekStart} DESC`)
      .limit(5); // Get last 5 weeks of data
    
    const isNew = historicalRecords.length === 0;
    const firstSeenAt = isNew ? reportingWeekStart : (historicalRecords[historicalRecords.length - 1]?.firstSeenAt || reportingWeekStart);
    
    // Get previous week's frequency (if exists)
    // Compare dates using getTime() since Drizzle returns Date objects
    const previousWeekRecord = historicalRecords.find(
      record => {
        const recordDate = typeof record.reportingWeekStart === 'string' 
          ? new Date(record.reportingWeekStart)
          : record.reportingWeekStart;
        return recordDate.getTime() < reportingWeekDate.getTime();
      }
    );
    const previousFrequency = previousWeekRecord?.frequency ?? null;
    
    const insight: KeywordInsight = {
      keyword: normalizedKeyword,
      frequency: kw.frequency,
      contextType: kw.contextType,
      isNew,
      firstSeenAt,
      previousFrequency,
    };
    
    allKeywords.push(insight);
    
    if (isNew) {
      newKeywords.push(insight);
    } else if (previousFrequency !== null && kw.frequency > previousFrequency * 1.5) {
      // Rising keyword: 50% increase from previous week
      risingKeywords.push(insight);
    }
  }
  
  // Sort by frequency
  newKeywords.sort((a, b) => b.frequency - a.frequency);
  risingKeywords.sort((a, b) => b.frequency - a.frequency);
  
  return {
    newKeywords,
    risingKeywords,
    allKeywords,
    summary: `Found ${newKeywords.length} new keywords and ${risingKeywords.length} rising keywords out of ${allKeywords.length} total`,
  };
}

/**
 * Save keyword occurrences to the database
 */
export async function saveKeywordOccurrences(
  keywords: Array<{ keyword: string; frequency: number; contextType: string }>,
  reportingWeekStart: string,
  dbService: DatabaseService,
  sourceUrls: string[] = []
): Promise<void> {
  const db = dbService.orm;
  
  for (const kw of keywords) {
    const normalizedKeyword = kw.keyword.toLowerCase().trim();
    
    // Check if this keyword has ever been seen before (across all weeks)
    const historicalRecords = await db
      .select()
      .from(keywordOccurrences)
      .where(
        and(
          eq(keywordOccurrences.keyword, normalizedKeyword),
          eq(keywordOccurrences.contextType, kw.contextType)
        )
      )
      .orderBy(sql`${keywordOccurrences.reportingWeekStart} ASC`)
      .limit(1);
    
    // Determine first seen date (use existing if found, otherwise this week)
    const firstSeenAtStr = historicalRecords.length > 0 
      ? (typeof historicalRecords[0].firstSeenAt === 'string' 
          ? historicalRecords[0].firstSeenAt 
          : historicalRecords[0].firstSeenAt.toISOString().split('T')[0])
      : reportingWeekStart;
    
    // Upsert keyword occurrence (use SQL casting to ensure proper date storage)
    await db
      .insert(keywordOccurrences)
      .values({
        keyword: normalizedKeyword,
        reportingWeekStart: sql`${reportingWeekStart}::date`,
        frequency: kw.frequency,
        contextType: kw.contextType,
        firstSeenAt: sql`${firstSeenAtStr}::date`,
        sourceUrls,
        rawContext: { 
          keyword: normalizedKeyword, // Store normalized keyword
          frequency: kw.frequency,
          contextType: kw.contextType,
        },
      })
      .onConflictDoUpdate({
        target: [
          keywordOccurrences.keyword,
          keywordOccurrences.contextType,
          keywordOccurrences.reportingWeekStart,
        ],
        set: {
          frequency: kw.frequency,
          sourceUrls,
          rawContext: {
            keyword: normalizedKeyword, // Store normalized keyword
            frequency: kw.frequency,
            contextType: kw.contextType,
          },
        },
      });
  }
}

/**
 * Get emerging market insights for the agent
 */
export async function getEmergingMarketInsights(
  reportingWeekStart: string,
  dbService: DatabaseService
): Promise<string> {
  const db = dbService.orm;
  
  // Get all keywords from this week
  const thisWeekKeywords = await db
    .select()
    .from(keywordOccurrences)
    .where(eq(keywordOccurrences.reportingWeekStart, reportingWeekStart))
    .orderBy(sql`${keywordOccurrences.frequency} DESC`)
    .limit(50);
  
  // Filter for new keywords (first seen this week) - normalize dates for comparison
  const newKeywords = thisWeekKeywords.filter(kw => {
    const firstSeenStr = typeof kw.firstSeenAt === 'string' 
      ? kw.firstSeenAt 
      : kw.firstSeenAt.toISOString().split('T')[0];
    return firstSeenStr === reportingWeekStart;
  });
  
  // Filter for rising keywords (appeared before but with lower frequency)
  const risingKeywords: typeof thisWeekKeywords = [];
  for (const kw of thisWeekKeywords) {
    // Skip new keywords
    const firstSeenStr = typeof kw.firstSeenAt === 'string' 
      ? kw.firstSeenAt 
      : kw.firstSeenAt.toISOString().split('T')[0];
    if (firstSeenStr === reportingWeekStart) continue;
    
    // Get previous week's data using SQL for date comparison
    const previousWeeks = await db
      .select()
      .from(keywordOccurrences)
      .where(
        and(
          eq(keywordOccurrences.keyword, kw.keyword),
          eq(keywordOccurrences.contextType, kw.contextType),
          sql`${keywordOccurrences.reportingWeekStart} < ${reportingWeekStart}::date`
        )
      )
      .orderBy(sql`${keywordOccurrences.reportingWeekStart} DESC`)
      .limit(1);
    
    if (previousWeeks.length > 0) {
      const prevFreq = previousWeeks[0].frequency;
      if (kw.frequency > prevFreq * 1.5) {
        risingKeywords.push(kw);
      }
    }
  }
  
  // Generate insights text
  let insights = `**Keyword Trend Analysis (${reportingWeekStart})**\n\n`;
  
  if (newKeywords.length > 0) {
    insights += `**New Keywords This Week (${newKeywords.length}):**\n`;
    insights += newKeywords
      .slice(0, 10)
      .map(kw => `- **${kw.keyword}** (${kw.frequency} mentions, ${kw.contextType})`)
      .join('\n');
    insights += '\n\n';
  }
  
  if (risingKeywords.length > 0) {
    insights += `**Rising Keywords (${risingKeywords.length}):**\n`;
    insights += risingKeywords
      .slice(0, 10)
      .map(kw => `- **${kw.keyword}** (${kw.frequency} mentions, ${kw.contextType})`)
      .join('\n');
    insights += '\n\n';
  }
  
  if (newKeywords.length === 0 && risingKeywords.length === 0) {
    insights += '_No significant new or rising keywords detected this week._\n';
  }
  
  return insights;
}
