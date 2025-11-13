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
}

export const db = new DatabaseService();
