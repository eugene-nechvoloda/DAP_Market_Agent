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
      
      logger?.info('🔍 [slackNotificationTool] Validating Slack token...', {
        tokenExists: !!slackToken,
        tokenPrefix: slackToken ? slackToken.substring(0, 8) + '...' : 'N/A',
      });
      
      if (!slackToken) {
        const errorMsg = 'SLACK_BOT_TOKEN environment variable not found. Please set your Slack Bot Token with chat:write scope.';
        logger?.error('❌ [slackNotificationTool] Missing token:', { error: errorMsg });
        throw new Error(errorMsg);
      }
      
      const client = new WebClient(slackToken);
      
      // Test auth to validate token
      logger?.info('🔐 [slackNotificationTool] Testing authentication...');
      try {
        const authResult = await client.auth.test();
        logger?.info('✅ [slackNotificationTool] Auth successful:', {
          botId: authResult.bot_id,
          team: authResult.team,
          user: authResult.user,
        });
      } catch (authError) {
        logger?.error('❌ [slackNotificationTool] Auth test failed:', {
          error: authError instanceof Error ? authError.message : String(authError),
          fullError: JSON.stringify(authError, null, 2),
        });
        throw new Error(`Slack authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`);
      }
      
      // Format the message with the document URL if provided
      let fullMessage = context.message;
      if (context.documentUrl) {
        fullMessage += `\n\n📄 *View Full Report:* ${context.documentUrl}`;
      }
      
      logger?.info('📤 [slackNotificationTool] Sending message to channel:', {
        channelId: context.channelId,
        messageLength: fullMessage.length,
      });
      
      // Send message to channel
      const result = await client.chat.postMessage({
        channel: context.channelId,
        text: fullMessage,
        mrkdwn: true,
      });
      
      logger?.info('✅ [slackNotificationTool] Slack notification sent successfully:', {
        channelId: context.channelId,
        messageTs: result.ts,
        ok: result.ok,
      });
      
      return {
        success: true,
        messageTs: result.ts,
      };
    } catch (error: any) {
      // Enhanced error logging with full details
      logger?.error('❌ [slackNotificationTool] Slack notification failed with detailed error:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error.code,
        errorData: error.data,
        fullError: JSON.stringify(error, null, 2),
      });
      
      // Provide helpful error messages based on common failures
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('invalid_auth') || errorMessage.includes('not_authed')) {
        errorMessage = 'Slack token is invalid. Please check SLACK_BOT_TOKEN and ensure it has chat:write scope.';
      } else if (errorMessage.includes('channel_not_found')) {
        errorMessage = `Channel ${context.channelId} not found. Please verify the channel ID is correct.`;
      } else if (errorMessage.includes('not_in_channel')) {
        errorMessage = `Bot is not a member of channel ${context.channelId}. Please invite the bot to the channel first.`;
      } else if (errorMessage.includes('missing_scope')) {
        errorMessage = 'Slack bot token is missing required scope. Please add chat:write scope to your Slack app.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
