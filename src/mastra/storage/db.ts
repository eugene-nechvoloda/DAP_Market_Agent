import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { competitorMetrics, marketMetrics, competitorSources, industrySources } from '../../../shared/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';

const { Pool } = pg;

export interface ReportHistoryRecord {
  id: number;
  runId: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  googleDocsUrl: string | null;
  slackNotificationSent: boolean;
  generatedAt: Date;
  triggerType: 'scheduled' | 'manual';
  reportContent: string | null;
  reportContentHtml: string | null;
}

export interface SettingRecord {
  id: number;
  key: string;
  value: string;
  updatedAt: Date;
}

export interface ReportSourcesRecord {
  id: number;
  runId: string;
  competitorData: any;
  industryData: any;
  reviewsData: any;
  webSearchResults?: any;
  perCompetitorData?: any;
  createdAt: Date;
}

export interface CompetitorMetricsInput {
  competitorSlug: string;
  reportingWeekStart: Date;
  
  // Owler metrics
  revenueUsd?: number | null;
  valuationUsd?: number | null;
  employeeCount?: number | null;
  revenueRange?: string | null;
  owlerRawPayload?: any;
  owlerSuccess: boolean;
  
  // Crunchbase metrics
  fundingTotalUsd?: number | null;
  lastRoundAmountUsd?: number | null;
  lastRoundType?: string | null;
  lastRoundDate?: Date | null;
  investorCount?: number | null;
  fundingRounds?: any;
  crunchbaseRawPayload?: any;
  crunchbaseSuccess: boolean;
  
  // Semrush metrics
  organicTraffic?: number | null;
  organicKeywords?: number | null;
  semrushRank?: number | null;
  semrushDatabase?: string | null;
  semrushRawPayload?: any;
  semrushSuccess: boolean;
  
  // Customer health metrics
  customerCount?: number | null;
  churnRate?: number | null;
  retentionRate?: number | null;
  userBase?: number | null;
  userGrowthRate?: number | null;
  
  // Metadata
  dataSourceVersion?: string | null;
  missingSources?: string[];
  error?: string | null;
}

export interface MarketMetricsInput {
  reportingWeekStart: Date;
  marketSizeUsd?: number | null;
  yoyGrowthPct?: number | null;
  totalSearchVolume?: number | null;
  aggregateFundingUsd?: number | null;
  dataSources?: string[];
  rawPayload?: any;
  success: boolean;
  error?: string | null;
}

export class DatabaseService {
  private pool: pg.Pool;
  private orm: ReturnType<typeof drizzle>;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mastra',
    });
    // Initialize Drizzle ORM for metrics queries
    this.orm = drizzle(this.pool);
  }

  async getLastReport(): Promise<ReportHistoryRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM report_history ORDER BY generated_at DESC LIMIT 1'
    );
    const row = result.rows[0];
    if (!row) return null;
    
    // Map snake_case column names to camelCase
    return {
      id: row.id,
      runId: row.run_id,
      title: row.title,
      dateStart: row.date_start,
      dateEnd: row.date_end,
      googleDocsUrl: row.google_docs_url,
      slackNotificationSent: row.slack_notification_sent,
      generatedAt: row.generated_at,
      triggerType: row.trigger_type,
      reportContent: row.report_content,
      reportContentHtml: row.report_content_html,
    };
  }

  async saveReport(report: Omit<ReportHistoryRecord, 'id' | 'generatedAt'>): Promise<ReportHistoryRecord> {
    const result = await this.pool.query(
      `INSERT INTO report_history 
       (run_id, title, date_start, date_end, google_docs_url, slack_notification_sent, trigger_type, report_content, report_content_html) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       ON CONFLICT (run_id) DO UPDATE SET
         title = EXCLUDED.title,
         date_start = EXCLUDED.date_start,
         date_end = EXCLUDED.date_end,
         google_docs_url = EXCLUDED.google_docs_url,
         slack_notification_sent = EXCLUDED.slack_notification_sent,
         trigger_type = EXCLUDED.trigger_type,
         report_content = EXCLUDED.report_content,
         report_content_html = EXCLUDED.report_content_html
       RETURNING *`,
      [
        report.runId,
        report.title,
        report.dateStart,
        report.dateEnd,
        report.googleDocsUrl,
        report.slackNotificationSent,
        report.triggerType,
        report.reportContent,
        report.reportContentHtml,
      ]
    );
    const row = result.rows[0];
    // Map snake_case column names to camelCase
    return {
      id: row.id,
      runId: row.run_id,
      title: row.title,
      dateStart: row.date_start,
      dateEnd: row.date_end,
      googleDocsUrl: row.google_docs_url,
      slackNotificationSent: row.slack_notification_sent,
      generatedAt: row.generated_at,
      triggerType: row.trigger_type,
      reportContent: row.report_content,
      reportContentHtml: row.report_content_html,
    };
  }

  async getAllReports(): Promise<ReportHistoryRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM report_history ORDER BY generated_at DESC'
    );
    // Map each row from snake_case to camelCase
    return result.rows.map((row: any) => ({
      id: row.id,
      runId: row.run_id,
      title: row.title,
      dateStart: row.date_start,
      dateEnd: row.date_end,
      googleDocsUrl: row.google_docs_url,
      slackNotificationSent: row.slack_notification_sent,
      generatedAt: row.generated_at,
      triggerType: row.trigger_type,
      reportContent: row.report_content,
      reportContentHtml: row.report_content_html,
    }));
  }

  async getSetting(key: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    );
    return result.rows[0]?.value || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const result = await this.pool.query('SELECT key, value FROM settings');
    return result.rows.reduce((acc: Record<string, string>, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async getReportById(id: number): Promise<ReportHistoryRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM report_history WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    
    // Map snake_case column names to camelCase
    return {
      id: row.id,
      runId: row.run_id,
      title: row.title,
      dateStart: row.date_start,
      dateEnd: row.date_end,
      googleDocsUrl: row.google_docs_url,
      slackNotificationSent: row.slack_notification_sent,
      generatedAt: row.generated_at,
      triggerType: row.trigger_type,
      reportContent: row.report_content,
      reportContentHtml: row.report_content_html,
    };
  }

  async saveReportSources(runId: string, competitorData: any, industryData: any, reviewsData: any, webSearchResults?: any, perCompetitorData?: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO report_sources (run_id, competitor_data, industry_data, reviews_data, web_search_results, per_competitor_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id) DO UPDATE SET
         competitor_data = EXCLUDED.competitor_data,
         industry_data = EXCLUDED.industry_data,
         reviews_data = EXCLUDED.reviews_data,
         web_search_results = COALESCE(EXCLUDED.web_search_results, report_sources.web_search_results),
         per_competitor_data = COALESCE(EXCLUDED.per_competitor_data, report_sources.per_competitor_data)`,
      [
        runId, 
        JSON.stringify(competitorData), 
        JSON.stringify(industryData), 
        JSON.stringify(reviewsData),
        webSearchResults ? JSON.stringify(webSearchResults) : null,
        perCompetitorData ? JSON.stringify(perCompetitorData) : null
      ]
    );
  }

  async updateCompetitorSources(runId: string, competitorData: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO report_sources (run_id, competitor_data, industry_data, reviews_data)
       VALUES ($1, $2, '[]', '[]')
       ON CONFLICT (run_id) DO UPDATE SET
         competitor_data = EXCLUDED.competitor_data`,
      [runId, JSON.stringify(competitorData)]
    );
  }

  async updateIndustrySources(runId: string, industryData: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO report_sources (run_id, competitor_data, industry_data, reviews_data)
       VALUES ($1, '[]', $2, '[]')
       ON CONFLICT (run_id) DO UPDATE SET
         industry_data = EXCLUDED.industry_data`,
      [runId, JSON.stringify(industryData)]
    );
  }

  async updateReviewsSources(runId: string, reviewsData: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO report_sources (run_id, competitor_data, industry_data, reviews_data)
       VALUES ($1, '[]', '[]', $2)
       ON CONFLICT (run_id) DO UPDATE SET
         reviews_data = EXCLUDED.reviews_data`,
      [runId, JSON.stringify(reviewsData)]
    );
  }
  
  /**
   * Update web search data with merge behavior to preserve accumulated research data
   * @param runId - The workflow run ID
   * @param webSearchResults - New web search results to merge (pass undefined to keep existing)
   * @param perCompetitorData - New per-competitor data to merge (pass undefined to keep existing)
   * @param overwrite - If true, completely replaces existing data instead of merging (default: false)
   */
  async updateWebSearchData(
    runId: string, 
    webSearchResults?: any, 
    perCompetitorData?: any,
    overwrite: boolean = false
  ): Promise<void> {
    // Use a transaction with row locking to prevent concurrent lost updates
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Fetch existing record with row lock
      const result = await client.query(
        'SELECT web_search_results, per_competitor_data FROM report_sources WHERE run_id = $1 FOR UPDATE',
        [runId]
      );
      
      const existingRow = result.rows[0];
      let existing: any = null;
      
      if (existingRow) {
        existing = {
          webSearchResults: existingRow.web_search_results ? 
            (typeof existingRow.web_search_results === 'string' ? 
              JSON.parse(existingRow.web_search_results) : 
              existingRow.web_search_results) : 
            null,
          perCompetitorData: existingRow.per_competitor_data ?
            (typeof existingRow.per_competitor_data === 'string' ?
              JSON.parse(existingRow.per_competitor_data) :
              existingRow.per_competitor_data) :
            null,
        };
      }
      
      let finalWebSearchResults: any;
      let finalPerCompetitorData: any;
      
      if (overwrite || !existing) {
        // First call or explicit overwrite - use new data as-is
        finalWebSearchResults = webSearchResults ?? null;
        finalPerCompetitorData = perCompetitorData ?? null;
      } else {
        // Merge with existing data (shallow merge preserves all keys)
        // Only merge if new data is provided (not undefined), otherwise keep existing
        finalWebSearchResults = webSearchResults !== undefined ? {
          ...(existing.webSearchResults || {}),
          ...(webSearchResults || {}),
        } : existing.webSearchResults;
        
        finalPerCompetitorData = perCompetitorData !== undefined ? {
          ...(existing.perCompetitorData || {}),
          ...(perCompetitorData || {}),
        } : existing.perCompetitorData;
      }
      
      // Build dynamic UPDATE to only modify provided fields
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (webSearchResults !== undefined) {
        updates.push(`web_search_results = $${paramIndex++}`);
        values.push(finalWebSearchResults ? JSON.stringify(finalWebSearchResults) : null);
      }
      
      if (perCompetitorData !== undefined) {
        updates.push(`per_competitor_data = $${paramIndex++}`);
        values.push(finalPerCompetitorData ? JSON.stringify(finalPerCompetitorData) : null);
      }
      
      if (updates.length > 0) {
        values.push(runId);
        const updateQuery = `UPDATE report_sources SET ${updates.join(', ')} WHERE run_id = $${paramIndex}`;
        await client.query(updateQuery, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getReportSources(runId: string): Promise<ReportSourcesRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM report_sources WHERE run_id = $1',
      [runId]
    );
    const row = result.rows[0];
    if (!row) return null;
    
    return {
      id: row.id,
      runId: row.run_id,
      competitorData: typeof row.competitor_data === 'string' ? JSON.parse(row.competitor_data) : row.competitor_data,
      industryData: typeof row.industry_data === 'string' ? JSON.parse(row.industry_data) : row.industry_data,
      reviewsData: typeof row.reviews_data === 'string' ? JSON.parse(row.reviews_data) : row.reviews_data,
      webSearchResults: row.web_search_results ? (typeof row.web_search_results === 'string' ? JSON.parse(row.web_search_results) : row.web_search_results) : null,
      perCompetitorData: row.per_competitor_data ? (typeof row.per_competitor_data === 'string' ? JSON.parse(row.per_competitor_data) : row.per_competitor_data) : null,
      createdAt: row.created_at,
    };
  }

  async deleteReportSources(runId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM report_sources WHERE run_id = $1',
      [runId]
    );
  }

  async updateReport(id: number, updates: Partial<Omit<ReportHistoryRecord, 'id' | 'generatedAt'>>): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.dateStart !== undefined) {
      setClauses.push(`date_start = $${paramIndex++}`);
      values.push(updates.dateStart);
    }
    if (updates.dateEnd !== undefined) {
      setClauses.push(`date_end = $${paramIndex++}`);
      values.push(updates.dateEnd);
    }
    if (updates.googleDocsUrl !== undefined) {
      setClauses.push(`google_docs_url = $${paramIndex++}`);
      values.push(updates.googleDocsUrl);
    }
    if (updates.triggerType !== undefined) {
      setClauses.push(`trigger_type = $${paramIndex++}`);
      values.push(updates.triggerType);
    }
    if (updates.slackNotificationSent !== undefined) {
      setClauses.push(`slack_notification_sent = $${paramIndex++}`);
      values.push(updates.slackNotificationSent);
    }
    if (updates.reportContent !== undefined) {
      setClauses.push(`report_content = $${paramIndex++}`);
      values.push(updates.reportContent);
    }
    if (updates.reportContentHtml !== undefined) {
      setClauses.push(`report_content_html = $${paramIndex++}`);
      values.push(updates.reportContentHtml);
    }

    if (setClauses.length > 0) {
      values.push(id);
      await this.pool.query(
        `UPDATE report_history SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  }

  /**
   * Save or update competitor metrics for a given week
   * Uses upsert to handle the unique constraint on (competitor_slug, reporting_week_start)
   */
  async saveCompetitorMetrics(data: CompetitorMetricsInput): Promise<void> {
    console.log(`📊 [DatabaseService] Upserting competitor metrics for ${data.competitorSlug}, week ${data.reportingWeekStart.toISOString().split('T')[0]}`);
    
    try {
      await this.orm
        .insert(competitorMetrics)
        .values({
          competitorSlug: data.competitorSlug,
          reportingWeekStart: data.reportingWeekStart,
          revenueUsd: data.revenueUsd ?? null,
          valuationUsd: data.valuationUsd ?? null,
          employeeCount: data.employeeCount ?? null,
          revenueRange: data.revenueRange ?? null,
          owlerRawPayload: data.owlerRawPayload ?? null,
          owlerSuccess: data.owlerSuccess,
          fundingTotalUsd: data.fundingTotalUsd ?? null,
          lastRoundAmountUsd: data.lastRoundAmountUsd ?? null,
          lastRoundType: data.lastRoundType ?? null,
          lastRoundDate: data.lastRoundDate ?? null,
          investorCount: data.investorCount ?? null,
          fundingRounds: data.fundingRounds ?? null,
          crunchbaseRawPayload: data.crunchbaseRawPayload ?? null,
          crunchbaseSuccess: data.crunchbaseSuccess,
          organicTraffic: data.organicTraffic ?? null,
          organicKeywords: data.organicKeywords ?? null,
          semrushRank: data.semrushRank ?? null,
          semrushDatabase: data.semrushDatabase ?? null,
          semrushRawPayload: data.semrushRawPayload ?? null,
          semrushSuccess: data.semrushSuccess,
          customerCount: data.customerCount ?? null,
          churnRate: data.churnRate ?? null,
          retentionRate: data.retentionRate ?? null,
          userBase: data.userBase ?? null,
          userGrowthRate: data.userGrowthRate ?? null,
          dataSourceVersion: data.dataSourceVersion ?? null,
          missingSources: data.missingSources ?? [],
          error: data.error ?? null,
        })
        .onConflictDoUpdate({
          target: [competitorMetrics.competitorSlug, competitorMetrics.reportingWeekStart],
          set: {
            revenueUsd: data.revenueUsd ?? null,
            valuationUsd: data.valuationUsd ?? null,
            employeeCount: data.employeeCount ?? null,
            revenueRange: data.revenueRange ?? null,
            owlerRawPayload: data.owlerRawPayload ?? null,
            owlerSuccess: data.owlerSuccess,
            fundingTotalUsd: data.fundingTotalUsd ?? null,
            lastRoundAmountUsd: data.lastRoundAmountUsd ?? null,
            lastRoundType: data.lastRoundType ?? null,
            lastRoundDate: data.lastRoundDate ?? null,
            investorCount: data.investorCount ?? null,
            fundingRounds: data.fundingRounds ?? null,
            crunchbaseRawPayload: data.crunchbaseRawPayload ?? null,
            crunchbaseSuccess: data.crunchbaseSuccess,
            organicTraffic: data.organicTraffic ?? null,
            organicKeywords: data.organicKeywords ?? null,
            semrushRank: data.semrushRank ?? null,
            semrushDatabase: data.semrushDatabase ?? null,
            semrushRawPayload: data.semrushRawPayload ?? null,
            semrushSuccess: data.semrushSuccess,
            customerCount: data.customerCount ?? null,
            churnRate: data.churnRate ?? null,
            retentionRate: data.retentionRate ?? null,
            userBase: data.userBase ?? null,
            userGrowthRate: data.userGrowthRate ?? null,
            dataSourceVersion: data.dataSourceVersion ?? null,
            missingSources: data.missingSources ?? [],
            error: data.error ?? null,
            recordedAt: new Date(),
          },
        });
      
      console.log(`✅ [DatabaseService] Successfully saved competitor metrics for ${data.competitorSlug}`);
    } catch (error) {
      console.error(`❌ [DatabaseService] Error saving competitor metrics:`, error);
      throw error;
    }
  }

  /**
   * Get competitor metrics for a specific week
   */
  async getCompetitorMetrics(
    competitorSlug: string,
    reportingWeekStart: Date
  ): Promise<typeof competitorMetrics.$inferSelect | null> {
    console.log(`🔍 [DatabaseService] Fetching competitor metrics for ${competitorSlug}, week ${reportingWeekStart.toISOString().split('T')[0]}`);
    
    try {
      const result = await this.orm
        .select()
        .from(competitorMetrics)
        .where(
          and(
            eq(competitorMetrics.competitorSlug, competitorSlug),
            eq(competitorMetrics.reportingWeekStart, reportingWeekStart)
          )
        )
        .limit(1);
      
      const metrics = result[0] || null;
      console.log(`${metrics ? '✅' : '⚠️'} [DatabaseService] ${metrics ? 'Found' : 'No'} metrics for ${competitorSlug}`);
      return metrics;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching competitor metrics:`, error);
      throw error;
    }
  }

  /**
   * Save or update market-level metrics for a given week
   */
  async saveMarketMetrics(data: MarketMetricsInput): Promise<void> {
    console.log(`📊 [DatabaseService] Upserting market metrics for week ${data.reportingWeekStart.toISOString().split('T')[0]}`);
    
    try {
      await this.orm
        .insert(marketMetrics)
        .values({
          reportingWeekStart: data.reportingWeekStart,
          marketSizeUsd: data.marketSizeUsd ?? null,
          yoyGrowthPct: data.yoyGrowthPct ?? null,
          totalSearchVolume: data.totalSearchVolume ?? null,
          aggregateFundingUsd: data.aggregateFundingUsd ?? null,
          dataSources: data.dataSources ?? [],
          rawPayload: data.rawPayload ?? null,
          success: data.success,
          error: data.error ?? null,
        })
        .onConflictDoUpdate({
          target: [marketMetrics.reportingWeekStart],
          set: {
            marketSizeUsd: data.marketSizeUsd ?? null,
            yoyGrowthPct: data.yoyGrowthPct ?? null,
            totalSearchVolume: data.totalSearchVolume ?? null,
            aggregateFundingUsd: data.aggregateFundingUsd ?? null,
            dataSources: data.dataSources ?? [],
            rawPayload: data.rawPayload ?? null,
            success: data.success,
            error: data.error ?? null,
            recordedAt: new Date(),
          },
        });
      
      console.log(`✅ [DatabaseService] Successfully saved market metrics`);
    } catch (error) {
      console.error(`❌ [DatabaseService] Error saving market metrics:`, error);
      throw error;
    }
  }

  /**
   * Get market metrics for a specific week
   */
  async getMarketMetrics(
    reportingWeekStart: Date
  ): Promise<typeof marketMetrics.$inferSelect | null> {
    console.log(`🔍 [DatabaseService] Fetching market metrics for week ${reportingWeekStart.toISOString().split('T')[0]}`);
    
    try {
      const result = await this.orm
        .select()
        .from(marketMetrics)
        .where(eq(marketMetrics.reportingWeekStart, reportingWeekStart))
        .limit(1);
      
      const metrics = result[0] || null;
      console.log(`${metrics ? '✅' : '⚠️'} [DatabaseService] ${metrics ? 'Found' : 'No'} market metrics`);
      return metrics;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching market metrics:`, error);
      throw error;
    }
  }

  /**
   * Get the Drizzle ORM instance for advanced queries
   * (e.g., used by trendCalculation utility)
   */
  getOrm() {
    return this.orm;
  }

  /**
   * Get latest metrics for a competitor with previous week's data for trend calculation
   */
  async getCompetitorMetricsWithTrend(
    competitorSlug: string,
    currentWeekStart: Date
  ): Promise<{
    current: typeof competitorMetrics.$inferSelect | null;
    previous: typeof competitorMetrics.$inferSelect | null;
  }> {
    const current = await this.getCompetitorMetrics(competitorSlug, currentWeekStart);
    
    // Get previous week (7 days earlier)
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    
    const previous = await this.getCompetitorMetrics(competitorSlug, previousWeekStart);
    
    return { current, previous };
  }

  /**
   * Get all latest competitor metrics for current week
   */
  async getAllLatestCompetitorMetrics(
    reportingWeekStart: Date
  ): Promise<Array<typeof competitorMetrics.$inferSelect>> {
    console.log(`🔍 [DatabaseService] Fetching all competitor metrics for week ${reportingWeekStart.toISOString().split('T')[0]}`);
    
    try {
      const result = await this.orm
        .select()
        .from(competitorMetrics)
        .where(eq(competitorMetrics.reportingWeekStart, reportingWeekStart));
      
      console.log(`✅ [DatabaseService] Found ${result.length} competitor metrics records`);
      return result;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching all competitor metrics:`, error);
      throw error;
    }
  }

  /**
   * Get all active competitor sources
   */
  async getAllCompetitorSources(): Promise<Array<typeof competitorSources.$inferSelect>> {
    try {
      const result = await this.orm
        .select()
        .from(competitorSources)
        .where(eq(competitorSources.isActive, true));
      
      console.log(`✅ [DatabaseService] Found ${result.length} active competitor sources`);
      return result;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching competitor sources:`, error);
      throw error;
    }
  }

  /**
   * Get competitor sources by category
   */
  async getCompetitorSourcesByCategory(category: string): Promise<Array<typeof competitorSources.$inferSelect>> {
    try {
      const result = await this.orm
        .select()
        .from(competitorSources)
        .where(
          and(
            eq(competitorSources.isActive, true),
            eq(competitorSources.category, category)
          )
        );
      
      console.log(`✅ [DatabaseService] Found ${result.length} sources for category ${category}`);
      return result;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching competitor sources by category:`, error);
      throw error;
    }
  }

  /**
   * Get all active industry research sources
   */
  async getAllIndustrySources(): Promise<Array<typeof industrySources.$inferSelect>> {
    try {
      const result = await this.orm
        .select()
        .from(industrySources)
        .where(eq(industrySources.isActive, true));
      
      console.log(`✅ [DatabaseService] Found ${result.length} active industry sources`);
      return result;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching industry sources:`, error);
      throw error;
    }
  }

  /**
   * Get industry sources by category
   */
  async getIndustrySourcesByCategory(category: string): Promise<Array<typeof industrySources.$inferSelect>> {
    try {
      const result = await this.orm
        .select()
        .from(industrySources)
        .where(
          and(
            eq(industrySources.isActive, true),
            eq(industrySources.category, category)
          )
        );
      
      console.log(`✅ [DatabaseService] Found ${result.length} industry sources for category ${category}`);
      return result;
    } catch (error) {
      console.error(`❌ [DatabaseService] Error fetching industry sources by category:`, error);
      throw error;
    }
  }
}

export const db = new DatabaseService();
