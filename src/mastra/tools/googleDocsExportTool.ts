import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { marked } from "marked";

// Helper function to convert markdown to Google Docs API requests
function convertMarkdownToDocsRequests(markdown: string) {
  const tokens = marked.lexer(markdown);
  const requests: any[] = [];
  let currentIndex = 1; // Google Docs uses 1-based indexing
  const textInsertions: Array<{ text: string; index: number }> = [];
  const styleUpdates: any[] = [];

  // Helper to add text and track formatting
  function addText(text: string, formatting?: any) {
    const startIndex = currentIndex;
    textInsertions.push({ text, index: startIndex });
    
    if (formatting) {
      styleUpdates.push({
        startIndex,
        endIndex: currentIndex + text.length,
        ...formatting,
      });
    }
    
    currentIndex += text.length;
  }

  // Process tokens
  for (const token of tokens) {
    if (token.type === 'heading') {
      const headingText = token.text + '\n';
      const startIndex = currentIndex;
      addText(headingText);
      
      // Add heading style
      const headingLevel = Math.min(token.depth, 6);
      const headingStyle = headingLevel === 1 ? 'HEADING_1' : 
                           headingLevel === 2 ? 'HEADING_2' :
                           headingLevel === 3 ? 'HEADING_3' :
                           headingLevel === 4 ? 'HEADING_4' :
                           headingLevel === 5 ? 'HEADING_5' : 'HEADING_6';
      
      styleUpdates.push({
        type: 'paragraph',
        startIndex,
        endIndex: currentIndex,
        namedStyleType: headingStyle,
      });
    } else if (token.type === 'paragraph') {
      // Parse inline formatting (bold, italic, links)
      const paragraphText = parseInlineFormatting(token.text, currentIndex, styleUpdates);
      addText(paragraphText + '\n');
    } else if (token.type === 'list') {
      const listStartIndex = currentIndex;
      const listItems: Array<{ startIndex: number; endIndex: number }> = [];
      
      for (const item of token.items) {
        const itemStartIndex = currentIndex;
        const itemText = parseInlineFormatting(item.text, currentIndex, styleUpdates);
        addText(itemText + '\n');
        listItems.push({ startIndex: itemStartIndex, endIndex: currentIndex });
      }
      
      // Mark as bullet list
      for (const item of listItems) {
        styleUpdates.push({
          type: 'bullet',
          startIndex: item.startIndex,
          endIndex: item.endIndex,
        });
      }
    } else if (token.type === 'table') {
      // Convert markdown tables to formatted text (simpler than actual table insertion)
      const headers = token.header.map((cell: any) => cell.text);
      const rows = token.rows.map((row: any) => row.map((cell: any) => cell.text));
      
      // Add header row with bold formatting
      const headerStartIndex = currentIndex;
      const headerText = headers.join(' | ');
      addText(headerText + '\n');
      styleUpdates.push({
        type: 'bold',
        startIndex: headerStartIndex,
        endIndex: currentIndex - 1,
      });
      
      // Add separator line
      addText('─'.repeat(headerText.length) + '\n');
      
      // Add data rows
      for (const row of rows) {
        addText(row.join(' | ') + '\n');
      }
      
      addText('\n'); // Add spacing after table
    } else if (token.type === 'space') {
      addText('\n');
    }
  }

  // Build requests: first insert all text, then apply formatting
  const allRequests: any[] = [];
  
  // Insert all text in reverse order (Google Docs API requirement)
  for (let i = textInsertions.length - 1; i >= 0; i--) {
    const insertion = textInsertions[i];
    allRequests.push({
      insertText: {
        location: { index: 1 },
        text: insertion.text,
      },
    });
  }
  
  // Apply paragraph styles (headings), tables, and text formatting
  for (const style of styleUpdates) {
    if (style.type === 'paragraph') {
      allRequests.push({
        updateParagraphStyle: {
          range: {
            startIndex: style.startIndex,
            endIndex: style.endIndex,
          },
          paragraphStyle: {
            namedStyleType: style.namedStyleType,
          },
          fields: 'namedStyleType',
        },
      });
    } else if (style.type === 'bullet') {
      allRequests.push({
        createParagraphBullets: {
          range: {
            startIndex: style.startIndex,
            endIndex: style.endIndex,
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    } else if (style.type === 'bold' || style.type === 'italic') {
      allRequests.push({
        updateTextStyle: {
          range: {
            startIndex: style.startIndex,
            endIndex: style.endIndex,
          },
          textStyle: {
            bold: style.type === 'bold',
            italic: style.type === 'italic',
          },
          fields: style.type === 'bold' ? 'bold' : 'italic',
        },
      });
    }
  }
  
  // Apply Lato font globally
  allRequests.push({
    updateTextStyle: {
      range: {
        startIndex: 1,
        endIndex: currentIndex,
      },
      textStyle: {
        weightedFontFamily: {
          fontFamily: 'Lato',
        },
      },
      fields: 'weightedFontFamily',
    },
  });
  
  return allRequests;
}

// Helper to parse inline formatting (bold, italic, links)
function parseInlineFormatting(text: string, baseIndex: number, styleUpdates: any[]): string {
  let plainText = '';
  let currentPos = 0;
  
  // Match bold (**text**)
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;
  
  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before bold
    plainText += text.substring(currentPos, match.index);
    
    // Add bold text
    const boldStart = baseIndex + plainText.length;
    plainText += match[1];
    const boldEnd = baseIndex + plainText.length;
    
    styleUpdates.push({
      type: 'bold',
      startIndex: boldStart,
      endIndex: boldEnd,
    });
    
    currentPos = match.index + match[0].length;
  }
  
  // Add remaining text
  plainText += text.substring(currentPos);
  
  // Match italic (_text_ or *text*)
  const italicRegex = /(?:^|[^*])_([^_]+)_(?:[^*]|$)|(?:^|[^*])\*([^*]+)\*(?:[^*]|$)/g;
  let currentText = plainText;
  plainText = '';
  currentPos = 0;
  
  while ((match = italicRegex.exec(currentText)) !== null) {
    const italicText = match[1] || match[2];
    plainText += currentText.substring(currentPos, match.index);
    
    const italicStart = baseIndex + plainText.length;
    plainText += italicText;
    const italicEnd = baseIndex + plainText.length;
    
    styleUpdates.push({
      type: 'italic',
      startIndex: italicStart,
      endIndex: italicEnd,
    });
    
    currentPos = match.index + match[0].length;
  }
  
  plainText += currentText.substring(currentPos);
  
  // Remove markdown links [text](url) -> text
  plainText = plainText.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  
  return plainText;
}

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
      
      // Convert markdown to Google Docs formatting requests
      logger?.info('📝 [googleDocsExportTool] Converting markdown to Google Docs formatting...');
      const formattingRequests = convertMarkdownToDocsRequests(context.content);
      
      logger?.info('📝 [googleDocsExportTool] Generated formatting requests:', { 
        requestCount: formattingRequests.length 
      });
      
      // Apply formatting to the document
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: formattingRequests,
        },
      });
      
      logger?.info('✅ [googleDocsExportTool] Content formatted and inserted into document');
      
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
