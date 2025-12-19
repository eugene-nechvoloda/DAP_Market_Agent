import React, { useEffect, useState } from 'react';
import '../styles/SettingsView.css';

interface Settings {
  slack_channel_id: string;
  export_destination: string;
}

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    slack_channel_id: '',
    export_destination: 'google_docs',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings-list');
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Update slack channel
      await fetch('/api/settings-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'slack_channel_id', value: settings.slack_channel_id }),
      });

      // Update export destination
      await fetch('/api/settings-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'export_destination', value: settings.export_destination }),
      });

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-view">
        <h2>Settings</h2>
        <p className="loading-text">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <h2>Settings</h2>
      <p className="subtitle">Configure integrations and preferences</p>

      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-section">
          <h3>Slack Integration</h3>
          <div className="form-group">
            <label htmlFor="slackChannel">Slack Channel ID</label>
            <input
              type="text"
              id="slackChannel"
              value={settings.slack_channel_id}
              onChange={(e) => setSettings({ ...settings, slack_channel_id: e.target.value })}
              placeholder="C09SK3N27MH"
              className="form-input"
            />
            <p className="form-help">
              Enter the Slack channel ID where reports will be sent. Find it in Slack channel details.
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Export Destination</h3>
          <div className="form-group">
            <label htmlFor="exportDest">Export Format</label>
            <select
              id="exportDest"
              value={settings.export_destination}
              onChange={(e) => setSettings({ ...settings, export_destination: e.target.value })}
              className="form-select"
            >
              <option value="google_docs">Google Docs</option>
              <option value="pdf">PDF (Coming Soon)</option>
              <option value="markdown">Markdown (Coming Soon)</option>
            </select>
            <p className="form-help">
              Choose where to export generated reports. Currently supports Google Docs.
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Workflow Schedule</h3>
          <div className="form-group">
            <label>Cron Schedule</label>
            <input
              type="text"
              value="0 7 * * 1 (Every Monday at 7:00 UTC)"
              disabled
              className="form-input disabled"
            />
            <p className="form-help">
              The workflow runs automatically every Monday at 7:00 UTC (8:00 AM CET). Schedule customization coming soon.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
};
