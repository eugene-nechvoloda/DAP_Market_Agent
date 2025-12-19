import { registerApiRoute } from '@mastra/core/server';

/**
 * TEMPORARY: Export environment variables for Railway setup
 * DELETE THIS FILE after copying to Railway!
 */
export const exportSecretsRoute = registerApiRoute('/export-secrets', {
  method: 'GET',
  handler: async (c) => {
    const secrets = {
      AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
      AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
      AI_INTEGRATIONS_ANTHROPIC_API_KEY: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || '',
      AI_INTEGRATIONS_ANTHROPIC_BASE_URL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
      SERPAPI_API_KEY: process.env.SERPAPI_API_KEY || '',
      GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL || '',
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY || '',
      GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || '',
      SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || '',
      INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY || '',
      INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY || '',
      DATABASE_URL: process.env.DATABASE_URL || '',
    };

    // Format for Railway RAW Editor
    const railwayFormat = Object.entries(secrets)
      .filter(([_, value]) => value !== '')
      .map(([key, value]) => {
        // Handle multiline GOOGLE_PRIVATE_KEY
        if (key === 'GOOGLE_PRIVATE_KEY' && value.includes('\n')) {
          return `${key}="${value}"`;
        }
        return `${key}=${value}`;
      })
      .join('\n');

    return c.text(railwayFormat);
  },
});
