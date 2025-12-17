import React, { useEffect, useState } from 'react';
import '../styles/ReportHistoryView.css';

interface Report {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  generatedAt: string;
  triggerType: string;
  googleDocsUrl?: string;
  slackNotificationSent: boolean;
  overallQualityScore?: number;
}

export const ReportHistoryView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/history-list');
      const data = await response.json();
      if (data.success) {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (filter === 'all') return true;
    return report.triggerType === filter;
  });

  if (loading) {
    return (
      <div className="report-history-view">
        <h2>Report History</h2>
        <p className="loading-text">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="report-history-view">
      <div className="history-header">
        <h2>Report History</h2>
        <div className="filter-bar">
          <label htmlFor="filter">Filter by trigger:</label>
          <select
            id="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Reports</option>
            <option value="cron">Scheduled (Cron)</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="reports-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date Range</th>
              <th>Generated At</th>
              <th>Trigger</th>
              <th>Quality Score</th>
              <th>Web Version</th>
              <th>Google Docs</th>
              <th>Slack Sent</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No reports found
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>{report.title}</td>
                  <td>
                    {report.dateStart} to {report.dateEnd}
                  </td>
                  <td>{new Date(report.generatedAt).toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${report.triggerType}`}>
                      {report.triggerType}
                    </span>
                  </td>
                  <td>
                    {report.overallQualityScore ? (
                      <span className="quality-score">
                        {report.overallQualityScore}/100
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    <a
                      href={`/api/reports/${report.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                    >
                      🌐 View
                    </a>
                  </td>
                  <td>
                    {report.googleDocsUrl ? (
                      <a
                        href={report.googleDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link"
                      >
                        📄 View
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    <span className={`badge ${report.slackNotificationSent ? 'badge-yes' : 'badge-no'}`}>
                      {report.slackNotificationSent ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
