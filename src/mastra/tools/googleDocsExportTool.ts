import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { marked } from "marked";

// Table metadata for second-phase processing
interface TableMetadata {
  placeholder: string;
  headers: string[];
  rows: string[][];
}

// Helper function to convert markdown to Google Docs API requests
function convertMarkdownToDocsRequests(markdown: string): {
  requests: any[];
  tables: TableMetadata[];
} {
  const tokens = marked.lexer(markdown);
  const requests: any[] = [];
  let currentIndex = 1; // Google Docs uses 1-based indexing
  const textInsertions: Array<{ text: string; index: number }> = [];
  const styleUpdates: any[] = [];
  const tables: TableMetadata[] = [];

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
      // Store table metadata for second-phase processing
      const headers = token.header.map((cell: any) => cell.text);
      const rows = token.rows.map((row: any) => row.map((cell: any) => cell.text));
      
      // Create unique placeholder that will be replaced with actual table
      const placeholder = `[TABLE_${tables.length}_PLACEHOLDER]\n`;
      
      tables.push({
        placeholder,
        headers,
        rows,
      });
      
      // Add placeholder text that will be found and replaced in phase 2
      addText(placeholder);
      addText('\n'); // Extra spacing after placeholder
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
  
  // Apply paragraph styles (headings) and text formatting
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
  
  return {
    requests: allRequests,
    tables,
  };
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
    reportId: z.number().optional().describe("The database ID of the report for web version link"),
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
      
      // Phase 1: Convert markdown to Google Docs formatting requests (with table placeholders)
      logger?.info('📝 [googleDocsExportTool] Converting markdown to Google Docs formatting...');
      const { requests: formattingRequests, tables } = convertMarkdownToDocsRequests(context.content);
      
      logger?.info('📝 [googleDocsExportTool] Generated formatting requests:', { 
        requestCount: formattingRequests.length,
        tableCount: tables.length,
      });
      
      // Apply formatting to the document (Phase 1)
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: formattingRequests,
        },
      });
      
      logger?.info('✅ [googleDocsExportTool] Content formatted and inserted into document');
      
      // Phase 2: Replace table placeholders with actual Google Docs tables
      if (tables.length > 0) {
        logger?.info('📊 [googleDocsExportTool] Processing tables (phase 2)...');
        
        // Fetch the current document structure to find placeholder locations
        const docResponse = await docs.documents.get({ documentId });
        const docContent = docResponse.data.body?.content || [];
        
        // Process each table in reverse order (to maintain index stability)
        for (let i = tables.length - 1; i >= 0; i--) {
          const table = tables[i];
          logger?.info(`📊 [googleDocsExportTool] Inserting table ${i + 1}/${tables.length}`);
          
          // Find the placeholder paragraph in the document structure
          let placeholderIndex: number | null = null;
          for (const element of docContent) {
            if (element.paragraph) {
              const paragraphText = element.paragraph.elements
                ?.map((e: any) => e.textRun?.content || '')
                .join('');
              
              if (paragraphText && paragraphText.includes(table.placeholder)) {
                placeholderIndex = element.startIndex!;
                break;
              }
            }
          }
          
          if (placeholderIndex === null) {
            logger?.warn(`⚠️ [googleDocsExportTool] Could not find placeholder for table ${i}`);
            continue;
          }
          
          // Build requests to replace placeholder with table
          const tableRequests: any[] = [];
          
          // Delete the placeholder paragraph
          const placeholderEnd = placeholderIndex + table.placeholder.length + 1; // +1 for newline
          tableRequests.push({
            deleteContentRange: {
              range: {
                startIndex: placeholderIndex,
                endIndex: placeholderEnd,
              },
            },
          });
          
          // Insert the table at the placeholder location
          const numRows = 1 + table.rows.length; // Header + data rows
          const numCols = table.headers.length;
          
          tableRequests.push({
            insertTable: {
              rows: numRows,
              columns: numCols,
              location: {
                index: placeholderIndex,
              },
            },
          });
          
          // Apply table requests
          await docs.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: tableRequests,
            },
          });
          
          // Fetch updated structure to get table cell locations
          const updatedDocResponse = await docs.documents.get({ documentId });
          const updatedContent = updatedDocResponse.data.body?.content || [];
          
          // Find the table we just inserted and populate cells
          for (const element of updatedContent) {
            if (element.table && element.startIndex === placeholderIndex) {
              const tableElement = element.table;
              const cellRequests: any[] = [];
              
              // Populate header row (row 0)
              for (let col = 0; col < table.headers.length; col++) {
                const cell = tableElement.tableRows?.[0]?.tableCells?.[col];
                if (cell && cell.content?.[0]?.startIndex != null) {
                  const cellIndex = cell.content[0].startIndex;
                  cellRequests.push({
                    insertText: {
                      text: table.headers[col],
                      location: {
                        index: cellIndex + 1, // +1 to skip the paragraph marker
                      },
                    },
                  });
                  
                  // Make header bold
                  cellRequests.push({
                    updateTextStyle: {
                      range: {
                        startIndex: cellIndex + 1,
                        endIndex: cellIndex + 1 + table.headers[col].length,
                      },
                      textStyle: {
                        bold: true,
                      },
                      fields: 'bold',
                    },
                  });
                }
              }
              
              // Populate data rows
              for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
                const row = table.rows[rowIdx];
                for (let col = 0; col < row.length; col++) {
                  const cell = tableElement.tableRows?.[rowIdx + 1]?.tableCells?.[col];
                  if (cell && cell.content?.[0]?.startIndex != null) {
                    const cellIndex = cell.content[0].startIndex;
                    // Handle empty cells - show "Data not available" instead of blank
                    const rawValue = row[col];
                    const textValue = typeof rawValue === 'string' ? rawValue.trim() : 
                                     rawValue != null ? String(rawValue) : '';
                    const cellValue = textValue !== '' ? textValue : 'Data not available';
                    cellRequests.push({
                      insertText: {
                        text: cellValue,
                        location: {
                          index: cellIndex + 1, // +1 to skip the paragraph marker
                        },
                      },
                    });
                  }
                }
              }
              
              // Apply cell population requests
              if (cellRequests.length > 0) {
                await docs.documents.batchUpdate({
                  documentId,
                  requestBody: {
                    requests: cellRequests,
                  },
                });
              }
              
              break;
            }
          }
        }
        
        logger?.info('✅ [googleDocsExportTool] All tables inserted and populated');
      }
      
      // Add footer with web version link if reportId is provided
      if (context.reportId) {
        logger?.info('📝 [googleDocsExportTool] Adding web version footer...');
        
        // Construct web version URL
        const webVersionUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/reports/${context.reportId}`;
        
        // Get current document length to append at the end
        const docResponse = await docs.documents.get({ documentId });
        const endIndex = docResponse.data.body?.content?.[docResponse.data.body.content.length - 1]?.endIndex || 1;
        
        const footerText = `\n\n---\n\n📊 View this report in your browser: ${webVersionUrl}`;
        
        // Insert footer text
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  text: footerText,
                  location: {
                    index: endIndex - 1, // Insert before the final newline
                  },
                },
              },
              // Make footer text italic and gray
              {
                updateTextStyle: {
                  range: {
                    startIndex: endIndex - 1,
                    endIndex: endIndex - 1 + footerText.length,
                  },
                  textStyle: {
                    italic: true,
                    foregroundColor: {
                      color: {
                        rgbColor: {
                          red: 0.5,
                          green: 0.5,
                          blue: 0.5,
                        },
                      },
                    },
                  },
                  fields: 'italic,foregroundColor',
                },
              },
            ],
          },
        });
        
        logger?.info('✅ [googleDocsExportTool] Web version footer added');
      }
      
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
