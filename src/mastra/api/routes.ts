import { registerApiRoute } from '../inngest/index.js';
import { db } from '../storage/db.js';
import { readFileSync } from 'fs';

export const apiRoutes = [
  registerApiRoute('/history-list', {
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

  registerApiRoute('/generate-report', {
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

  registerApiRoute('/settings-list', {
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

  registerApiRoute('/settings-update', {
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

  registerApiRoute('/dashboard', {
    method: 'GET',
    handler: async (c) => {
      const mastra = c.get('mastra');
      const logger = mastra?.getLogger();
      logger?.info('🎨 [API] Serving dashboard');
      
      try {
        const html = readFileSync('./src/mastra/api/ui/index.html', 'utf-8');
        return c.html(html);
      } catch (error: any) {
        logger?.error('❌ [API] Failed to serve dashboard:', error);
        return c.text('Dashboard not found', 404);
      }
    },
  }),

  registerApiRoute('/styles-css', {
    method: 'GET',
    handler: async (c) => {
      try {
        const css = readFileSync('./src/mastra/api/ui/styles.css', 'utf-8');
        return c.text(css, 200, { 'Content-Type': 'text/css' });
      } catch (error: any) {
        return c.text('File not found', 404);
      }
    },
  }),

  registerApiRoute('/app-js', {
    method: 'GET',
    handler: async (c) => {
      try {
        const js = readFileSync('./src/mastra/api/ui/app.js', 'utf-8');
        return c.text(js, 200, { 'Content-Type': 'application/javascript' });
      } catch (error: any) {
        return c.text('File not found', 404);
      }
    },
  }),
];
