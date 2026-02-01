import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const InlineKeyboardButtonSchema = z.object({
  text: z.string(),
  url: z.string().optional(),
  callback_data: z.string().optional(),
});

const InlineKeyboardSchema = z.object({
  inline_keyboard: z.array(z.array(InlineKeyboardButtonSchema)),
});

export const sendTelegramMessageTool = createTool({
  id: "send-telegram-message",
  description: "Sends a message to a Telegram chat with optional inline keyboard buttons. Use for sending responses, notifications, or menus to users.",

  inputSchema: z.object({
    chatId: z.string().describe("Telegram chat ID to send message to"),
    text: z.string().describe("Message text to send (supports Markdown)"),
    parseMode: z.enum(["Markdown", "HTML", "MarkdownV2"]).optional().default("Markdown")
      .describe("Text formatting mode"),
    inlineKeyboard: InlineKeyboardSchema.optional()
      .describe("Optional inline keyboard with buttons"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.number().optional(),
    error: z.string().optional(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [sendTelegramMessage] Sending message:", { 
      chatId: context.chatId, 
      textLength: context.text.length 
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger?.error("❌ [sendTelegramMessage] TELEGRAM_BOT_TOKEN not configured");
      return { success: false, error: "Bot token not configured" };
    }

    try {
      const body: any = {
        chat_id: context.chatId,
        text: context.text,
        parse_mode: context.parseMode || "Markdown",
      };

      if (context.inlineKeyboard) {
        body.reply_markup = context.inlineKeyboard;
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();

      if (!result.ok) {
        logger?.error("❌ [sendTelegramMessage] Telegram API error:", result);
        return { success: false, error: result.description || "Unknown error" };
      }

      logger?.info("✅ [sendTelegramMessage] Message sent successfully:", { 
        messageId: result.result.message_id 
      });

      return { success: true, messageId: result.result.message_id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger?.error("❌ [sendTelegramMessage] Error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});
