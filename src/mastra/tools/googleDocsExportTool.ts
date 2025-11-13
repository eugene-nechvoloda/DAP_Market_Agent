import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";

// Helper function to get Google Docs client with Replit integration
async function getGoogleDocsClient() {
  let connectionSettings: any;

  async function getAccessToken() {
    if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
      return connectionSettings.settings.access_token;
    }
    
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken) {
      throw new Error('Replit authentication not found');
    }

    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-docs',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      throw new Error('Google Docs not connected. Please connect Google Docs in the Replit UI.');
    }
    return accessToken;
  }

  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return {
    docs: google.docs({ version: 'v1', auth: oauth2Client }),
    drive: google.drive({ version: 'v3', auth: oauth2Client }),
  };
}

export const googleDocsExportTool = createTool({
  id: "google-docs-export-tool",
  description:
    "Exports a markdown report to Google Docs. Creates a new document with the report content and returns the document URL.",
  
  inputSchema: z.object({
    title: z.string().describe("The title of the Google Doc"),
    content: z.string().describe("The markdown content to export (will be converted to formatted text)"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string().optional(),
    documentUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📄 [googleDocsExportTool] Starting Google Docs export:', { title: context.title });
    
    try {
      // Get authenticated Google Docs client via Replit integration
      const { docs, drive } = await getGoogleDocsClient();
      
      // Create a new document
      const createResponse = await docs.documents.create({
        requestBody: {
          title: context.title,
        },
      });
      
      const documentId = createResponse.data.documentId;
      
      if (!documentId) {
        throw new Error('Failed to create Google Doc - no document ID returned');
      }
      
      logger?.info('📝 [googleDocsExportTool] Document created:', { documentId });
      
      // Convert markdown to plain text for now (basic implementation)
      // In a production system, you'd want proper markdown to Google Docs formatting
      const plainText = context.content
        .replace(/^#{1,6}\s+/gm, '')  // Remove markdown headers
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markers
        .replace(/\*(.*?)\*/g, '$1')  // Remove italic markers
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // Remove link formatting
        .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
        .trim();
      
      // Insert content into the document
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: 1,
                },
                text: plainText,
              },
            },
          ],
        },
      });
      
      logger?.info('✅ [googleDocsExportTool] Content inserted into document');
      
      // Try to make the document accessible via link (optional - requires Drive scope)
      // If this fails due to missing Drive scope, the document will still be created
      // but will only be accessible to the authenticated user
      try {
        await drive.permissions.create({
          fileId: documentId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
        logger?.info('✅ [googleDocsExportTool] Document shared publicly');
      } catch (error) {
        logger?.warn('⚠️ [googleDocsExportTool] Could not share document publicly (missing Drive scope):', {
          error: error instanceof Error ? error.message : String(error),
        });
        logger?.info('📝 [googleDocsExportTool] Document created but only accessible to authenticated user');
      }
      
      const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
      
      logger?.info('✅ [googleDocsExportTool] Google Docs export complete:', { documentUrl });
      
      return {
        success: true,
        documentId,
        documentUrl,
      };
    } catch (error) {
      logger?.error('❌ [googleDocsExportTool] Export failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
