import React from 'react';
import '../styles/Card.css';

interface ReportGenerationCardProps {
  isGenerating: boolean;
  onGenerate: () => void;
}

export const ReportGenerationCard: React.FC<ReportGenerationCardProps> = ({
  isGenerating,
  onGenerate,
}) => {
  return (
    <div className="card report-generation-card">
      <h3 className="card-title">🚀 Generate Market Research Report</h3>
      <p className="card-description">
        Trigger an on-demand market research report. The system will:
      </p>
      <ul className="feature-list">
        <li>Scrape competitor sources and industry reports</li>
        <li>Execute targeted web searches</li>
        <li>Extract and validate metrics</li>
        <li>Generate AI-powered analysis</li>
        <li>Export to Google Docs and notify Slack</li>
      </ul>

      <button
        className={`btn btn-primary ${isGenerating ? 'btn-loading' : ''}`}
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <span className="spinner"></span>
            Generating Report...
          </>
        ) : (
          'Generate Report Now'
        )}
      </button>

      {isGenerating && (
        <p className="info-text">
          This may take 5-10 minutes. Progress will be shown below.
        </p>
      )}
    </div>
  );
};
