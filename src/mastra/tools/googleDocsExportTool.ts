import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";

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
      // Get the Google Docs credentials from environment
      const credentials = process.env.GOOGLE_DOCS_CREDENTIALS;
      
      if (!credentials) {
        throw new Error('GOOGLE_DOCS_CREDENTIALS environment variable not found');
      }
      
      // Parse credentials
      const creds = JSON.parse(credentials);
      
      // Create OAuth2 client
      const auth = new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret,
        creds.redirect_uris?.[0]
      );
      
      // Set credentials
      auth.setCredentials({
        access_token: creds.access_token,
        refresh_token: creds.refresh_token,
      });
      
      const docs = google.docs({ version: 'v1', auth });
      const drive = google.drive({ version: 'v3', auth });
      
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
      
      // Make the document accessible via link
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
      
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
