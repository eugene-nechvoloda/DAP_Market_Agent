import { registerApiRoute as registerApiRouteOriginal } from '@mastra/core/server';
import { db } from '../storage/db.js';

// Embedded UI assets - loaded at module initialization to avoid runtime file system access
// This approach ensures assets work regardless of bundling/deployment environment
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

let dashboardHTML: string;
let stylesCSS: string;
let appJS: string;

try {
  const uiDir = fileURLToPath(new URL('./ui', import.meta.url));
  dashboardHTML = readFileSync(`${uiDir}/index.html`, 'utf-8');
  stylesCSS = readFileSync(`${uiDir}/styles.css`, 'utf-8');
  appJS = readFileSync(`${uiDir}/app.js`, 'utf-8');
} catch (error) {
  // Fallback for bundled environment - files won't be available
  console.warn('[Dashboard] UI files not found, using embedded versions');
  dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>DAP Market Research Dashboard</title><link rel="stylesheet" href="/styles-css"></head>
<body><div class="container"><header><h1>📊 DAP Market Research Dashboard</h1><p>Automated competitive intelligence for Digital Adoption Platforms</p></header><div class="panels"><section class="panel"><h2>⚙️ Settings</h2><form id="settingsForm"><div class="form-group"><label for="slackChannel">Slack Channel ID:</label><input type="text" id="slackChannel" placeholder="C09SK3N27MH" required></div><div class="form-group"><label for="exportDest">Export Destination:</label><select id="exportDest" required><option value="google_docs">Google Docs</option></select></div><button type="submit" class="btn btn-primary">Save Settings</button></form><div id="settingsStatus" class="status"></div></section><section class="panel"><h2>🚀 Manual Report Generation</h2><p>Generate a market research report on-demand. The report will be saved to history and exported to Google Docs.</p><button id="generateBtn" class="btn btn-success">Generate Report Now</button><div id="triggerStatus" class="status"></div></section><section class="panel full-width"><h2>📝 Report History</h2><div id="historyStatus" class="status"></div><div class="table-container"><table id="historyTable"><thead><tr><th>Title</th><th>Date Range</th><th>Generated At</th><th>Trigger Type</th><th>Google Docs</th><th>Slack Sent</th></tr></thead><tbody id="historyBody"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody></table></div></section></div></div><script src="/app-js"></script></body></html>`;
  
  stylesCSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:20px}.container{max-width:1200px;margin:0 auto}header{background:white;padding:30px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.1)}header h1{color:#2d3748;margin-bottom:10px}header p{color:#718096}.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:20px}.panel{background:white;padding:25px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.panel.full-width{grid-column:1/-1}.panel h2{color:#2d3748;margin-bottom:20px;font-size:1.5em}.form-group{margin-bottom:15px}.form-group label{display:block;margin-bottom:5px;color:#4a5568;font-weight:500}.form-group input,.form-group select{width:100%;padding:10px;border:1px solid #cbd5e0;border-radius:6px;font-size:14px}.form-group input:focus,.form-group select:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}.btn{padding:12px 24px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s}.btn:disabled{opacity:0.5;cursor:not-allowed}.btn-primary{background:#667eea;color:white}.btn-primary:hover:not(:disabled){background:#5568d3}.btn-success{background:#48bb78;color:white;width:100%;margin-top:15px}.btn-success:hover:not(:disabled){background:#38a169}.status{margin-top:15px;padding:12px;border-radius:6px;display:none}.status.success{display:block;background:#c6f6d5;color:#22543d;border:1px solid #9ae6b4}.status.error{display:block;background:#fed7d7;color:#742a2a;border:1px solid #fc8181}.status.info{display:block;background:#bee3f8;color:#2c5282;border:1px solid #90cdf4}.table-container{overflow-x:auto}table{width:100%;border-collapse:collapse}th{background:#edf2f7;padding:12px;text-align:left;font-weight:600;color:#2d3748;border-bottom:2px solid #cbd5e0}td{padding:12px;border-bottom:1px solid #e2e8f0;color:#4a5568}tr:hover{background:#f7fafc}.loading{text-align:center;color:#a0aec0;font-style:italic}.empty-state{text-align:center;color:#a0aec0;padding:40px}.badge{display:inline-block;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600}.badge.scheduled{background:#bee3f8;color:#2c5282}.badge.manual{background:#fbd38d;color:#7c2d12}.badge.yes{background:#c6f6d5;color:#22543d}.badge.no{background:#fed7d7;color:#742a2a}a{color:#667eea;text-decoration:none}a:hover{text-decoration:underline}`;
  
  appJS = `async function loadSettings(){try{const e=await fetch("/settings-list"),t=await e.json();t.success&&(document.getElementById("slackChannel").value=t.settings.slack_channel_id||"",document.getElementById("exportDest").value=t.settings.export_destination||"google_docs")}catch(e){showStatus("settingsStatus","Failed to load settings","error")}}document.getElementById("settingsForm").addEventListener("submit",async e=>{e.preventDefault();const t=document.getElementById("slackChannel").value,s=document.getElementById("exportDest").value;try{const e=await fetch("/settings-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:"slack_channel_id",value:t})}),a=await fetch("/settings-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:"export_destination",value:s})});e.ok&&a.ok?showStatus("settingsStatus","Settings saved successfully!","success"):showStatus("settingsStatus","Failed to save settings","error")}catch(e){showStatus("settingsStatus","Error saving settings: "+e.message,"error")}});let isGenerating=!1,pollingInterval=null;async function loadHistory(){try{const e=await fetch("/history-list"),t=await e.json();t.success?renderHistory(t.reports):showStatus("historyStatus","Failed to load history","error")}catch(e){showStatus("historyStatus","Error loading history: "+e.message,"error")}}function renderHistory(e){const t=document.getElementById("historyBody");if(!e||0===e.length)return void(t.innerHTML='<tr><td colspan="6" class="empty-state">No reports generated yet. Click "Generate Report Now" to create your first report!</td></tr>');t.innerHTML=e.map(e=>\`<tr><td>\${escapeHtml(e.title)}</td><td>\${escapeHtml(e.date_start)} to \${escapeHtml(e.date_end)}</td><td>\${new Date(e.generated_at).toLocaleString()}</td><td><span class="badge \${e.trigger_type}">\${e.trigger_type}</span></td><td>\${e.google_docs_url?\`<a href="\${escapeHtml(e.google_docs_url)}" target="_blank">View Doc</a>\`:"N/A"}</td><td><span class="badge \${e.slack_notification_sent?"yes":"no"}">\${e.slack_notification_sent?"Yes":"No"}</span></td></tr>\`).join(""),isGenerating&&e.length>0&&(document.getElementById("generateBtn").disabled=!1,document.getElementById("generateBtn").textContent="Generate Report Now",isGenerating=!1,pollingInterval&&(clearInterval(pollingInterval),pollingInterval=null),showStatus("triggerStatus","Report generated successfully!","success"))}function showStatus(e,t,s){const a=document.getElementById(e);a.textContent=t,a.className=\`status \${s}\`}function escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}document.getElementById("generateBtn").addEventListener("click",async()=>{if(!isGenerating){const e=document.getElementById("generateBtn");e.disabled=!0,e.textContent="Generating...",isGenerating=!0;try{const t=await(await fetch("/generate-report",{method:"POST",headers:{"Content-Type":"application/json"}})).json();t.success?(showStatus("triggerStatus",\`Report generation started! Event ID: \${t.eventId}\`,"info"),pollingInterval=setInterval(async()=>{await loadHistory(),setTimeout(()=>{pollingInterval&&(clearInterval(pollingInterval),e.disabled=!1,e.textContent="Generate Report Now",isGenerating=!1)},3e5)},5e3)):(showStatus("triggerStatus","Failed to generate report: "+t.error,"error"),e.disabled=!1,e.textContent="Generate Report Now",isGenerating=!1)}catch(t){showStatus("triggerStatus","Error: "+t.message,"error"),e.disabled=!1,e.textContent="Generate Report Now",isGenerating=!1}}}),document.addEventListener("DOMContentLoaded",()=>{loadSettings(),loadHistory(),setInterval(loadHistory,3e4)});`;
}

export const apiRoutes = [
  registerApiRouteOriginal('/history-list', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('📋 [API] Fetching report history');
      
      try {
        const reports = await db.getAllReports();
        return c.json({ success: true, reports });
      } catch (error: any) {
        logger?.error('❌ [API] Failed to fetch report history:', error);
        return c.json({ success: false, error: error.message }, 500);
      }
    },
  }),

  registerApiRouteOriginal('/generate-report', {
    method: 'POST',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('🚀 [API] Manual report generation requested');
      
      try {
        const inngest = (mastra as any).inngestClient;
        if (!inngest) {
          throw new Error('Inngest client not initialized');
        }

        const result = await inngest.send({
          name: 'workflow.weekly-market-research',
          data: {
            initialState: {},
            inputData: {},
            runId: `manual-${Date.now()}`,
            triggerType: 'manual',
          },
        });

        logger?.info('✅ [API] Manual report generation triggered:', result);
        return c.json({ 
          success: true, 
          message: 'Report generation started',
          eventId: result.ids[0],
        });
      } catch (error: any) {
        logger?.error('❌ [API] Failed to trigger manual report generation:', error);
        return c.json({ success: false, error: error.message }, 500);
      }
    },
  }),

  registerApiRouteOriginal('/settings-list', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('⚙️ [API] Fetching settings');
      
      try {
        const settings = await db.getAllSettings();
        return c.json({ success: true, settings });
      } catch (error: any) {
        logger?.error('❌ [API] Failed to fetch settings:', error);
        return c.json({ success: false, error: error.message }, 500);
      }
    },
  }),

  registerApiRouteOriginal('/settings-update', {
    method: 'POST',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('⚙️ [API] Updating settings');
      
      try {
        const body = await c.req.json();
        const { key, value } = body;

        if (!key || !value) {
          return c.json({ success: false, error: 'Missing key or value' }, 400);
        }

        await db.setSetting(key, value);
        logger?.info('✅ [API] Setting updated:', { key, value });
        
        return c.json({ success: true, message: 'Setting updated' });
      } catch (error: any) {
        logger?.error('❌ [API] Failed to update setting:', error);
        return c.json({ success: false, error: error.message }, 500);
      }
    },
  }),

  registerApiRouteOriginal('/dashboard', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('🎨 [API] Serving dashboard');
      return c.html(dashboardHTML);
    },
  }),

  registerApiRouteOriginal('/styles-css', {
    method: 'GET',
    handler: async (c) => {
      return c.text(stylesCSS, 200, { 'Content-Type': 'text/css' });
    },
  }),

  registerApiRouteOriginal('/app-js', {
    method: 'GET',
    handler: async (c) => {
      return c.text(appJS, 200, { 'Content-Type': 'application/javascript' });
    },
  }),
];
