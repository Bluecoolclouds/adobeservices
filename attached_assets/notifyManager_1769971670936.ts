import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const notifyManagerTool = createTool({
  id: "notify-manager",
  description: "Sends notification to the manager about new orders or payments. Use when a payment is successful or important events occur.",

  inputSchema: z.object({
    eventType: z.enum(["new_order", "payment_success", "payment_failed"])
      .describe("Type of event to notify about"),
    userId: z.string().describe("Customer Telegram user ID"),
    userName: z.string().optional().describe("Customer Telegram username"),
    orderId: z.string().optional().describe("Order ID if applicable"),
    subscriptionType: z.string().optional().describe("Type of subscription purchased"),
    amount: z.number().optional().describe("Payment amount in RUB"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [notifyManager] Sending notification:", context);

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

    let message = "";
    
    switch (context.eventType) {
      case "new_order":
        message = `🆕 *Новый заказ!*\n\n` +
          `👤 Пользователь: ${context.userName ? `@${context.userName}` : context.userId}\n` +
          `📦 Подписка: ${context.subscriptionType || "Не указано"}\n` +
          `💰 Сумма: ${context.amount || 0}₽\n` +
          `🔢 ID заказа: ${context.orderId || "Не указано"}`;
        break;
        
      case "payment_success":
        message = `✅ *Успешная оплата!*\n\n` +
          `👤 Пользователь: ${context.userName ? `@${context.userName}` : context.userId}\n` +
          `📦 Подписка: ${context.subscriptionType || "Не указано"}\n` +
          `💰 Сумма: ${context.amount || 0}₽\n` +
          `🔢 ID заказа: ${context.orderId || "Не указано"}\n\n` +
          `📧 Свяжитесь с клиентом для выдачи подписки!`;
        break;
        
      case "payment_failed":
        message = `❌ *Ошибка оплаты*\n\n` +
          `👤 Пользователь: ${context.userName ? `@${context.userName}` : context.userId}\n` +
          `🔢 ID заказа: ${context.orderId || "Не указано"}`;
        break;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: managerChatId,
            text: message,
            parse_mode: "Markdown",
          }),
        }
      );

      const result = await response.json();

      if (!result.ok) {
        logger?.error("❌ [notifyManager] Telegram API error:", result);
        return { success: false, error: result.description || "Unknown error" };
      }

      logger?.info("✅ [notifyManager] Manager notified successfully");
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger?.error("❌ [notifyManager] Error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});
