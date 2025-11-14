import pg from 'pg';

const { Pool } = pg;

export interface ReportHistoryRecord {
  id: number;
  title: string;
  dateStart: string;
  dateEnd: string;
  googleDocsUrl: string | null;
  slackNotificationSent: boolean;
  generatedAt: Date;
  triggerType: 'scheduled' | 'manual';
  reportContent: string | null;
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
  createdAt: Date;
}

export class DatabaseService {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mastra',
    });
  }

  async getLastReport(): Promise<ReportHistoryRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM report_history ORDER BY generated_at DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  async saveReport(report: Omit<ReportHistoryRecord, 'id' | 'generatedAt'>): Promise<ReportHistoryRecord> {
    const result = await this.pool.query(
      `INSERT INTO report_history 
       (title, date_start, date_end, google_docs_url, slack_notification_sent, trigger_type, report_content) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        report.title,
        report.dateStart,
        report.dateEnd,
        report.googleDocsUrl,
        report.slackNotificationSent,
        report.triggerType,
        report.reportContent,
      ]
    );
    return result.rows[0];
  }

  async getAllReports(): Promise<ReportHistoryRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM report_history ORDER BY generated_at DESC'
    );
    return result.rows;
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
      title: row.title,
      dateStart: row.date_start,
      dateEnd: row.date_end,
      googleDocsUrl: row.google_docs_url,
      slackNotificationSent: row.slack_notification_sent,
      generatedAt: row.generated_at,
      triggerType: row.trigger_type,
      reportContent: row.report_content,
    };
  }

  async saveReportSources(runId: string, competitorData: any, industryData: any, reviewsData: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO report_sources (run_id, competitor_data, industry_data, reviews_data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (run_id) DO UPDATE SET
         competitor_data = EXCLUDED.competitor_data,
         industry_data = EXCLUDED.industry_data,
         reviews_data = EXCLUDED.reviews_data`,
      [runId, JSON.stringify(competitorData), JSON.stringify(industryData), JSON.stringify(reviewsData)]
    );
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

    if (setClauses.length > 0) {
      values.push(id);
      await this.pool.query(
        `UPDATE report_history SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  }
}

export const db = new DatabaseService();
