// Settings Module
async function loadSettings() {
  try {
    const response = await fetch('/settings-list');
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('slackChannel').value = data.settings.slack_channel_id || '';
      document.getElementById('exportDest').value = data.settings.export_destination || 'google_docs';
    }
  } catch (error) {
    showStatus('settingsStatus', 'Failed to load settings', 'error');
  }
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const slackChannel = document.getElementById('slackChannel').value;
  const exportDest = document.getElementById('exportDest').value;
  
  try {
    // Update slack_channel_id
    const slackResponse = await fetch('/settings-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'slack_channel_id', value: slackChannel }),
    });
    
    // Update export_destination
    const exportResponse = await fetch('/settings-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'export_destination', value: exportDest }),
    });
    
    if (slackResponse.ok && exportResponse.ok) {
      showStatus('settingsStatus', 'Settings saved successfully!', 'success');
    } else {
      showStatus('settingsStatus', 'Failed to save settings', 'error');
    }
  } catch (error) {
    showStatus('settingsStatus', 'Error saving settings: ' + error.message, 'error');
  }
});

// Manual Trigger Module
let isGenerating = false;
let pollingInterval = null;

document.getElementById('generateBtn').addEventListener('click', async () => {
  if (isGenerating) return;
  
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  isGenerating = true;
  
  try {
    const response = await fetch('/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    
    if (data.success) {
      showStatus('triggerStatus', `Report generation started! Event ID: ${data.eventId}`, 'info');
      
      // Start polling for completion
      pollingInterval = setInterval(async () => {
        await loadHistory();
        // Stop polling after 5 minutes
        setTimeout(() => {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            btn.disabled = false;
            btn.textContent = 'Generate Report Now';
            isGenerating = false;
          }
        }, 5 * 60 * 1000);
      }, 5000); // Poll every 5 seconds
    } else {
      showStatus('triggerStatus', 'Failed to generate report: ' + data.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Generate Report Now';
      isGenerating = false;
    }
  } catch (error) {
    showStatus('triggerStatus', 'Error: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Generate Report Now';
    isGenerating = false;
  }
});

// Report History Module
async function loadHistory() {
  try {
    const response = await fetch('/history-list');
    const data = await response.json();
    
    if (data.success) {
      renderHistory(data.reports);
    } else {
      showStatus('historyStatus', 'Failed to load history', 'error');
    }
  } catch (error) {
    showStatus('historyStatus', 'Error loading history: ' + error.message, 'error');
  }
}

function renderHistory(reports) {
  const tbody = document.getElementById('historyBody');
  
  if (!reports || reports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No reports generated yet. Click "Generate Report Now" to create your first report!</td></tr>';
    return;
  }
  
  tbody.innerHTML = reports.map(report => `
    <tr>
      <td>${escapeHtml(report.title)}</td>
      <td>${escapeHtml(report.date_start)} to ${escapeHtml(report.date_end)}</td>
      <td>${new Date(report.generated_at).toLocaleString()}</td>
      <td><span class="badge ${report.trigger_type}">${report.trigger_type}</span></td>
      <td>${report.google_docs_url ? `<a href="${escapeHtml(report.google_docs_url)}" target="_blank">View Doc</a>` : 'N/A'}</td>
      <td><span class="badge ${report.slack_notification_sent ? 'yes' : 'no'}">${report.slack_notification_sent ? 'Yes' : 'No'}</span></td>
    </tr>
  `).join('');
  
  // If we were generating and now we have a new report, stop polling
  if (isGenerating && reports.length > 0) {
    const btn = document.getElementById('generateBtn');
    btn.disabled = false;
    btn.textContent = 'Generate Report Now';
    isGenerating = false;
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    showStatus('triggerStatus', 'Report generated successfully!', 'success');
  }
}

// Utility Functions
function showStatus(elementId, message, type) {
  const statusEl = document.getElementById(elementId);
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadHistory();
  
  // Auto-refresh history every 30 seconds
  setInterval(loadHistory, 30000);
});
