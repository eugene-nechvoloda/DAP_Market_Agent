import React, { useEffect, useState } from 'react';
import '../styles/DataQualityView.css';

interface QualityMetrics {
  averageContentQuality: number;
  sourcesScraped: number;
  sourcesFailed: number;
  citationValidationRate: number;
  lastUpdated: string;
}

export const DataQualityView: React.FC = () => {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/data-quality-metrics');
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to load quality metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="data-quality-view">
        <h2>Data Quality Dashboard</h2>
        <p className="loading-text">Loading metrics...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="data-quality-view">
        <h2>Data Quality Dashboard</h2>
        <p className="empty-state">No quality metrics available yet. Generate a report first.</p>
      </div>
    );
  }

  return (
    <div className="data-quality-view">
      <h2>Data Quality Dashboard</h2>
      <p className="subtitle">Monitor data collection and validation quality</p>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Average Content Quality</h3>
            <div className="metric-value">{metrics.averageContentQuality}/100</div>
            <div className={`metric-status ${metrics.averageContentQuality >= 70 ? 'good' : 'warning'}`}>
              {metrics.averageContentQuality >= 70 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🌐</div>
          <div className="metric-content">
            <h3>Sources Scraped</h3>
            <div className="metric-value">{metrics.sourcesScraped}</div>
            <div className="metric-detail">
              {metrics.sourcesFailed} failed ({Math.round((metrics.sourcesFailed / (metrics.sourcesScraped + metrics.sourcesFailed)) * 100)}%)
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">✓</div>
          <div className="metric-content">
            <h3>Citation Validation Rate</h3>
            <div className="metric-value">{metrics.citationValidationRate}%</div>
            <div className={`metric-status ${metrics.citationValidationRate >= 90 ? 'good' : 'warning'}`}>
              {metrics.citationValidationRate >= 90 ? 'Excellent' : 'Needs Review'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🕐</div>
          <div className="metric-content">
            <h3>Last Updated</h3>
            <div className="metric-value-small">
              {new Date(metrics.lastUpdated).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="quality-insights">
        <h3>Quality Insights</h3>
        <div className="insights-list">
          {metrics.averageContentQuality < 70 && (
            <div className="insight warning">
              ⚠️ Average content quality is below threshold. Consider reviewing source selection.
            </div>
          )}
          {metrics.sourcesFailed > 5 && (
            <div className="insight warning">
              ⚠️ Multiple sources failed to scrape. Check URL accessibility.
            </div>
          )}
          {metrics.citationValidationRate < 90 && (
            <div className="insight warning">
              ⚠️ Citation validation rate is below 90%. Review broken links.
            </div>
          )}
          {metrics.averageContentQuality >= 70 && metrics.citationValidationRate >= 90 && metrics.sourcesFailed <= 5 && (
            <div className="insight success">
              ✓ All quality metrics are within acceptable ranges.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
