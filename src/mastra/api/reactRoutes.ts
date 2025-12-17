import { registerApiRoute } from '@mastra/core/server';
import { db } from '../storage/db.js';
import fs from 'fs';
import path from 'path';

/**
 * React UI Routes
 *
 * Serves the new React-based dashboard UI on /react-dashboard
 * Provides API endpoints for the React app under /api/react/*
 */

// ======================================================================
// API Routes for React Dashboard
// ======================================================================

export const reactRoutes = [
  /**
   * GET /react/history-list
   * Get all reports (same as existing but with quality scores)
   */
  registerApiRoute('/react/history-list', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('📊 [React API] Fetching report history');

      try {
        const reports = await db.getAllReports();

        return c.json({
          success: true,
          reports: reports.map(report => ({
            ...report,
            overallQualityScore: report.overallQualityScore || null,
          })),
        });
      } catch (error: any) {
        logger?.error('❌ [React API] Failed to fetch reports:', error);
        return c.json({
          success: false,
          error: error.message,
        }, 500);
      }
    },
  }),

  /**
   * POST /react/generate-report
   * Trigger manual report generation
   */
  registerApiRoute('/react/generate-report', {
    method: 'POST',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('🚀 [React API] Manual report generation requested');

      try {
        const workflow = mastra?.getWorkflow('weeklyMarketResearch');
        if (!workflow) {
          throw new Error('Workflow weeklyMarketResearch not found');
        }

        const runId = `manual-${Date.now()}`;
        logger?.info('📋 [React API] Starting workflow with runId:', { runId });

        const run = await workflow.createRunAsync({ runId });

        run.start({ inputData: {} }).catch((error: any) => {
          logger?.error('❌ [React API] Workflow execution failed:', error);
        });

        logger?.info('✅ [React API] Manual report generation started:', { runId });
        return c.json({
          success: true,
          eventId: runId,
          runId,
        });
      } catch (error: any) {
        logger?.error('❌ [React API] Failed to trigger report generation:', error);
        return c.json({
          success: false,
          error: error.message,
        }, 500);
      }
    },
  }),

  /**
   * GET /react/settings-list
   * Get current settings
   */
  registerApiRoute('/react/settings-list', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('⚙️ [React API] Fetching settings');

      try {
        const settings = await db.getAllSettings();

        return c.json({
          success: true,
          settings: {
            slack_channel_id: settings.slack_channel_id || '',
            export_destination: settings.export_destination || 'google_docs',
          },
        });
      } catch (error: any) {
        logger?.error('❌ [React API] Failed to fetch settings:', error);
        return c.json({
          success: false,
          error: error.message,
        }, 500);
      }
    },
  }),

  /**
   * POST /react/settings-update
   * Update a setting
   */
  registerApiRoute('/react/settings-update', {
    method: 'POST',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('⚙️ [React API] Updating settings');

      try {
        const body = await c.req.json();
        const { key, value } = body;

        if (!key || value === undefined) {
          return c.json({ success: false, error: 'Missing key or value' }, 400);
        }

        await db.setSetting(key, value);
        logger?.info('✅ [React API] Setting updated:', { key, value });

        return c.json({
          success: true,
        });
      } catch (error: any) {
        logger?.error('❌ [React API] Failed to update setting:', error);
        return c.json({
          success: false,
          error: error.message,
        }, 500);
      }
    },
  }),

  /**
   * GET /react/data-quality-metrics
   * Get data quality metrics from last workflow run
   */
  registerApiRoute('/react/data-quality-metrics', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('📈 [React API] Fetching data quality metrics');

      try {
        // Get the latest report
        const reports = await db.getAllReports();
        if (reports.length === 0) {
          return c.json({
            success: true,
            metrics: null,
          });
        }

        const latestReport = reports[0];

        // TODO: Store these metrics during workflow execution
        // For now, return mock data
        const metrics = {
          averageContentQuality: latestReport.overallQualityScore || 75,
          sourcesScraped: 28,
          sourcesFailed: 3,
          citationValidationRate: 92,
          lastUpdated: latestReport.generatedAt,
        };

        return c.json({
          success: true,
          metrics,
        });
      } catch (error: any) {
        logger?.error('❌ [React API] Failed to fetch quality metrics:', error);
        return c.json({
          success: false,
          error: error.message,
        }, 500);
      }
    },
  }),

  /**
   * GET /react/workflow-progress/:runId
   * Server-Sent Events endpoint for real-time workflow progress
   * TODO: Implement real-time progress tracking from database
   */
  registerApiRoute('/react/workflow-progress/:runId', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      const runId = c.req.param('runId');

      logger?.info('📡 [React API] SSE connection opened for runId:', { runId });

      // Set SSE headers
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      // TODO: Implement real-time progress tracking
      // For now, send a simple message
      const message = JSON.stringify({
        runId,
        status: 'started',
        message: 'Workflow progress tracking coming soon',
      });

      return c.text(`data: ${message}\n\n`);
    },
  }),

  /**
   * GET /react-dashboard
   * Serve React app
   */
  registerApiRoute('/react-dashboard', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('🎨 [React UI] Serving React dashboard');

      const distPath = path.join(process.cwd(), 'dist/ui/index.html');

      // Check if built UI exists
      if (!fs.existsSync(distPath)) {
        logger?.warn('⚠️ [React UI] Built UI not found, serving setup instructions');

        return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>React Dashboard - Not Built</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 80px auto;
      padding: 2rem;
      line-height: 1.6;
      color: #1f2937;
    }
    h1 { color: #ef4444; margin-bottom: 1rem; font-size: 2rem; }
    h2 { color: #1f2937; margin: 2rem 0 1rem; font-size: 1.5rem; }
    h3 { color: #374151; margin: 1.5rem 0 0.75rem; font-size: 1.125rem; }
    p { margin-bottom: 1rem; color: #4b5563; }
    code {
      background: #f3f4f6;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-family: 'Courier New', monospace;
      color: #1f2937;
    }
    .instructions {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 0.5rem;
      border-left: 4px solid #3b82f6;
      margin: 1.5rem 0;
    }
    ol { margin-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.5rem; color: #4b5563; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .back-link {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>⚠️ React Dashboard Not Built</h1>
  <p>The React UI has not been built yet. Please follow these steps to set it up:</p>

  <div class="instructions">
    <h2>Quick Setup</h2>
    <h3>1. Install Dependencies</h3>
    <ol>
      <li>Run: <code>npm install</code></li>
    </ol>

    <h3>2. Build the React UI</h3>
    <ol>
      <li>Run: <code>npm run build:ui</code></li>
      <li>Wait for the build to complete</li>
      <li>Refresh this page</li>
    </ol>

    <h3>3. Development Mode (Alternative)</h3>
    <p>For development with hot reload:</p>
    <ol>
      <li>Run: <code>npm run dev:ui</code></li>
      <li>Visit: <a href="http://localhost:3001">http://localhost:3001</a></li>
      <li>Make sure backend is running: <code>npm run dev</code></li>
    </ol>
  </div>

  <p>
    <strong>Note:</strong> The React UI is a completely separate interface from the classic dashboard.
    Both can coexist side-by-side.
  </p>

  <p>
    For detailed setup instructions, see: <code>REACT_UI_SETUP.md</code>
  </p>

  <div class="back-link">
    <a href="/api/dashboard">← Back to Classic Dashboard</a>
  </div>
</body>
</html>
        `);
      }

      // Serve the built React app
      const html = fs.readFileSync(distPath, 'utf-8');
      return c.html(html);
    },
  }),

  /**
   * GET /react-dashboard/assets/*
   * Serve static assets (JS, CSS, images)
   */
  registerApiRoute('/react-dashboard/assets/*', {
    method: 'GET',
    handler: async (c) => {
      const requestPath = c.req.path;
      const assetPath = requestPath.replace('/react-dashboard/assets/', '');
      const filePath = path.join(process.cwd(), 'dist/ui/assets', assetPath);

      if (!fs.existsSync(filePath)) {
        return c.text('Not Found', 404);
      }

      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath);

      const contentTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';

      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // 1 year
        },
      });
    },
  }),
];

export default reactRoutes;
