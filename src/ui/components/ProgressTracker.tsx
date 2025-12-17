import React from 'react';
import '../styles/ProgressTracker.css';

interface WorkflowStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
}

interface ProgressTrackerProps {
  progress: {
    runId: string;
    currentStep: number;
    totalSteps: number;
    stepName: string;
    stepStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt: Date;
    estimatedTimeRemaining?: number;
    logs: Array<{ timestamp: Date; message: string; level: string }>;
  };
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress }) => {
  const percentage = Math.round((progress.currentStep / progress.totalSteps) * 100);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '⟳';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  const getStatusClass = (status: string) => {
    return `status-${status}`;
  };

  return (
    <div className="card progress-tracker">
      <h3 className="card-title">📊 Workflow Progress</h3>

      <div className="progress-header">
        <div className="progress-info">
          <span className="progress-step">
            Step {progress.currentStep} of {progress.totalSteps}
          </span>
          <span className="progress-percentage">{percentage}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>

      <div className="current-step">
        <span className={`step-status ${getStatusClass(progress.stepStatus)}`}>
          {getStatusIcon(progress.stepStatus)}
        </span>
        <span className="step-name">{progress.stepName}</span>
      </div>

      {progress.estimatedTimeRemaining && (
        <p className="time-remaining">
          Estimated time remaining: {Math.ceil(progress.estimatedTimeRemaining / 60)} min
        </p>
      )}

      <div className="logs-container">
        <h4 className="logs-title">Activity Log</h4>
        <div className="logs">
          {progress.logs.slice(-10).reverse().map((log, index) => (
            <div key={index} className={`log-entry log-${log.level}`}>
              <span className="log-time">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
