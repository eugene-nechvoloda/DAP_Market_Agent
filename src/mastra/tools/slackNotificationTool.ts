import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { WebClient } from "@slack/web-api";

export const slackNotificationTool = createTool({
  id: "slack-notification-tool",
  description:
    "Sends a notification message to a Slack channel with the weekly market research report summary and Google Docs link.",
  
  inputSchema: z.object({
    channelId: z.string().describe("The Slack channel ID (e.g., C09SK3N27MH)"),
    message: z.string().describe("The message to send"),
    documentUrl: z.string().optional().describe("Optional Google Docs URL to include in the message"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageTs: z.string().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('💬 [slackNotificationTool] Sending Slack notification:', {
      channelId: context.channelId,
    });
    
    try {
      const slackToken = process.env.SLACK_BOT_TOKEN;
      
      if (!slackToken) {
        throw new Error('SLACK_BOT_TOKEN environment variable not found. Please set your Slack Bot Token.');
      }
      
      const client = new WebClient(slackToken);
      
      // Format the message with the document URL if provided
      let fullMessage = context.message;
      if (context.documentUrl) {
        fullMessage += `\n\n📄 *View Full Report:* ${context.documentUrl}`;
      }
      
      // Send message to channel
      const result = await client.chat.postMessage({
        channel: context.channelId,
        text: fullMessage,
        mrkdwn: true,
      });
      
      logger?.info('✅ [slackNotificationTool] Slack notification sent:', {
        channelId: context.channelId,
        messageTs: result.ts,
      });
      
      return {
        success: true,
        messageTs: result.ts,
      };
    } catch (error) {
      logger?.error('❌ [slackNotificationTool] Slack notification failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
