import React, { useEffect, useState } from 'react';
import '../styles/Card.css';

interface Report {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  generatedAt: string;
  triggerType: string;
  googleDocsUrl?: string;
  overallQualityScore?: number;
}

export const RecentReportsGrid: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
    const interval = setInterval(loadReports, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/history-list');
      const data = await response.json();
      if (data.success) {
        setReports(data.reports.slice(0, 3)); // Show last 3 reports
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h3 className="card-title">📝 Recent Reports</h3>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">📝 Recent Reports</h3>
        <p className="empty-state">No reports generated yet</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">📝 Recent Reports</h3>
      <div className="reports-grid">
        {reports.map((report) => (
          <div key={report.id} className="report-card">
            <div className="report-header">
              <h4 className="report-title">{report.title}</h4>
              <span className={`badge badge-${report.triggerType}`}>
                {report.triggerType}
              </span>
            </div>
            <p className="report-date">
              {new Date(report.generatedAt).toLocaleDateString()}
            </p>
            {report.overallQualityScore && (
              <div className="quality-score">
                Quality: {report.overallQualityScore}/100
              </div>
            )}
            <div className="report-actions">
              <a href={`/api/reports/${report.id}`} target="_blank" rel="noopener noreferrer">
                View Report
              </a>
              {report.googleDocsUrl && (
                <a href={report.googleDocsUrl} target="_blank" rel="noopener noreferrer">
                  Google Docs
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
