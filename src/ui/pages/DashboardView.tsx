import React, { useState } from 'react';
import { ReportGenerationCard } from '../components/ReportGenerationCard';
import { ProgressTracker } from '../components/ProgressTracker';
import { RecentReportsGrid } from '../components/RecentReportsGrid';
import '../styles/DashboardView.css';

export const DashboardView: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<any>(null);

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        // Start listening to progress events
        const eventSource = new EventSource(`/api/workflow-progress/${data.runId}`);

        eventSource.onmessage = (event) => {
          const progress = JSON.parse(event.data);
          setWorkflowProgress(progress);

          if (progress.status === 'completed' || progress.status === 'failed') {
            eventSource.close();
            setIsGenerating(false);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setIsGenerating(false);
        };
      } else {
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      setIsGenerating(false);
    }
  };

  return (
    <div className="dashboard-view">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Monitor and generate market research reports</p>
      </div>

      <div className="dashboard-grid">
        <ReportGenerationCard
          isGenerating={isGenerating}
          onGenerate={handleGenerateReport}
        />

        {isGenerating && workflowProgress && (
          <ProgressTracker progress={workflowProgress} />
        )}

        <RecentReportsGrid />
      </div>
    </div>
  );
};
