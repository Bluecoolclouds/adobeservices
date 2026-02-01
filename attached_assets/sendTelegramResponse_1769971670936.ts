import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const InlineButtonSchema = z.object({
  text: z.string(),
  callback_data: z.string().optional(),
  url: z.string().optional(),
});

export const sendTelegramResponseTool = createTool({
  id: "send-telegram-response",
  description: "Sends a message to Telegram chat with optional inline keyboard. Use this to send bot responses to users.",

  inputSchema: z.object({
    chatId: z.string().describe("Telegram chat ID"),
    text: z.string().describe("Message text (HTML format)"),
    inlineKeyboard: z.array(z.array(InlineButtonSchema)).optional()
      .describe("Optional inline keyboard buttons"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.number().optional(),
    error: z.string().optional(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { chatId, text, inlineKeyboard } = context;
    
    logger?.info("🔧 [sendTelegramResponse] Sending message to chat:", { chatId, textLength: text.length });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger?.error("❌ [sendTelegramResponse] TELEGRAM_BOT_TOKEN not configured");
      return { success: false, error: "Bot token not configured" };
    }

    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      };

      if (inlineKeyboard && inlineKeyboard.length > 0) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.ok) {
        logger?.error("❌ [sendTelegramResponse] Telegram API error:", { 
          error: result.description,
          error_code: result.error_code 
        });
        return { success: false, error: result.description || "Unknown Telegram error" };
      }

      logger?.info("✅ [sendTelegramResponse] Message sent successfully:", { 
        messageId: result.result.message_id 
      });
      return { success: true, messageId: result.result.message_id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger?.error("❌ [sendTelegramResponse] Error:", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },
});

export const notifyManagerTool = createTool({
  id: "notify-manager",
  description: "Sends notification to the manager about new orders. Use when a new order is placed.",

  inputSchema: z.object({
    userId: z.string().describe("Customer Telegram user ID"),
    userName: z.string().optional().describe("Customer Telegram username"),
    orderId: z.string().describe("Order ID"),
    subscriptionType: z.string().describe("Type of subscription"),
    amount: z.number().describe("Payment amount in RUB"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { userId, userName, orderId, subscriptionType, amount } = context;
    
    logger?.info("🔧 [notifyManager] Sending notification:", { userId, orderId });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const managerChatId = process.env.MANAGER_CHAT_ID;

    if (!botToken) {
      logger?.error("❌ [notifyManager] TELEGRAM_BOT_TOKEN not configured");
      return { success: false, error: "Bot token not configured" };
    }

    if (!managerChatId) {
      logger?.warn("⚠️ [notifyManager] MANAGER_CHAT_ID not configured, skipping notification");
      return { success: true };
    }

    const subscriptionLabels: Record<string, string> = {
      "stable_1m": "Стабильная - 1 месяц",
      "stable_2m": "Стабильная - 2 месяца",
      "stable_3m": "Стабильная - 3 месяца",
      "stable_6m": "Стабильная - 6 месяцев",
      "stable_1y": "Стабильная - 1 год",
    };

    const message = `🆕 <b>Новый заказ!</b>

👤 Пользователь: ${userName ? `@${userName}` : userId}
📦 Подписка: ${subscriptionLabels[subscriptionType] || subscriptionType}
💰 Сумма: ${amount}₽
🔢 ID заказа: ${orderId}`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: managerChatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        logger?.error("❌ [notifyManager] Telegram API error:", { error: result.description });
        return { success: false, error: result.description };
      }

      logger?.info("✅ [notifyManager] Manager notified successfully");
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger?.error("❌ [notifyManager] Error:", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },
});
