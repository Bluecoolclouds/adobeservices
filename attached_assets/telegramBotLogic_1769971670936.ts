import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as crypto from "crypto";

const SUBSCRIPTION_PRICES: Record<string, { price: number; description: string; period: string }> = {
  "stable_1m": { price: 1520, description: "Adobe Creative Cloud - Стабильная", period: "1 месяц" },
  "stable_2m": { price: 2500, description: "Adobe Creative Cloud - Стабильная", period: "2 месяца" },
  "stable_3m": { price: 3740, description: "Adobe Creative Cloud - Стабильная", period: "3 месяца" },
  "stable_6m": { price: 6630, description: "Adobe Creative Cloud - Стабильная", period: "6 месяцев" },
  "stable_1y": { price: 10455, description: "Adobe Creative Cloud - Стабильная", period: "1 год" },
};

function generateRobokassaLink(subscriptionType: string, userId: string, userName?: string): { paymentUrl: string; orderId: string; amount: number } {
  const subscription = SUBSCRIPTION_PRICES[subscriptionType];
  if (!subscription) {
    throw new Error(`Unknown subscription type: ${subscriptionType}`);
  }

  const orderId = `${userId}_${Date.now()}`;
  const amount = subscription.price;

  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN || "demo";
  const password1 = process.env.ROBOKASSA_PASSWORD1 || "demo";
  const isTest = process.env.ROBOKASSA_TEST_MODE === "true" ? 1 : 0;

  const signatureString = `${merchantLogin}:${amount}:${orderId}:${password1}`;
  const signature = crypto.createHash("md5").update(signatureString).digest("hex");

  const params = new URLSearchParams({
    MerchantLogin: merchantLogin,
    OutSum: amount.toString(),
    InvId: orderId,
    Description: subscription.description,
    SignatureValue: signature,
    IsTest: isTest.toString(),
    Culture: "ru",
  });

  if (userName) params.append("Shp_userName", userName);
  params.append("Shp_userId", userId);
  params.append("Shp_subscriptionType", subscriptionType);

  return {
    paymentUrl: `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`,
    orderId,
    amount,
  };
}

async function sendTelegramMessage(chatId: string, text: string, inlineKeyboard?: any): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (inlineKeyboard) {
    body.reply_markup = { inline_keyboard: inlineKeyboard };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    return result.ok;
  } catch {
    return false;
  }
}

async function notifyManager(eventType: string, userId: string, userName?: string, orderId?: string, subscriptionType?: string, amount?: number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const managerChatId = process.env.MANAGER_CHAT_ID;
  if (!botToken || !managerChatId) return;

  let message = "";
  if (eventType === "new_order") {
    const sub = subscriptionType ? SUBSCRIPTION_PRICES[subscriptionType] : null;
    message = `🆕 <b>Новый заказ!</b>\n\n` +
      `👤 Пользователь: ${userName ? `@${userName}` : userId}\n` +
      `📦 Подписка: ${sub ? `${sub.description} (${sub.period})` : subscriptionType}\n` +
      `💰 Сумма: ${amount || 0}₽\n` +
      `🔢 ID заказа: ${orderId || "Не указано"}`;
  }

  if (message) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: managerChatId, text: message, parse_mode: "HTML" }),
    });
  }
}

export const processTelegramMessageTool = createTool({
  id: "process-telegram-message",
  description: "Processes Telegram bot messages and sends appropriate responses with menus",

  inputSchema: z.object({
    message: z.string().describe("User message or callback data"),
    chatId: z.string().describe("Telegram chat ID"),
    userId: z.string().describe("Telegram user ID"),
    userName: z.string().optional().describe("Telegram username"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    action: z.string(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { message, chatId, userId, userName } = context;
    
    logger?.info("🔧 [processTelegramMessage] Processing:", { message, chatId, userId });

    const msg = message.toLowerCase().trim();

    if (msg === "/start" || msg === "start" || msg === "menu" || msg === "в меню") {
      const welcomeText = `🚀 <b>Добро пожаловать!</b>

Здесь ты можешь получить подписки от Adobe. Всё просто: выбираешь продукт и сразу после оплаты получаешь подписку.

🛡️ Даём гарантию и постоянным клиентам скидку

💳 Поддерживаются удобные способы оплаты.
❓ Есть вопросы? Пиши в поддержку @wpnetwork_sup
💡 Наш канал @weplanetnetwork

📜 /b33048669 - Оферта/пользовательское соглашение

🌎 /b34042679 - If you need English language`;

      await sendTelegramMessage(chatId, welcomeText, [
        [{ text: "🎨 Adobe Creative Cloud", callback_data: "adobe_cc" }],
        [{ text: "📞 Поддержка", url: "https://t.me/wpnetwork_sup" }],
      ]);
      
      logger?.info("✅ [processTelegramMessage] Sent welcome message");
      return { success: true, action: "welcome" };
    }

    if (msg === "adobe_cc" || msg === "adobe creative cloud" || msg.includes("adobe")) {
      const typeText = `📍 <b>Выбери тип подписки:</b>

✅ Эконом блокируется несколько раз в месяц
✅ Стабильный держится весь срок`;

      await sendTelegramMessage(chatId, typeText, [
        [{ text: "💎 Стабильный вариант", callback_data: "stable" }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ]);

      logger?.info("✅ [processTelegramMessage] Sent subscription type menu");
      return { success: true, action: "subscription_types" };
    }

    if (msg === "stable" || msg === "стабильный" || msg === "стабильный вариант") {
      const stableText = `🎉 <b>Это стабильные подписки</b>
Делаются на ваш аккаунт gmail/outlook 🎨
Никогда не слетают и нет проблем с продлением

✅ Доступ ко всем приложениям Adobe (Photoshop, Illustrator, Premiere Pro и др.)
🔥 Безлимит Adobe Stock (Images & Vectors)
💻 До 2х устройств
📈 Можно на вашу почту (сразу после покупки напишите нам об этом)
🔐 <b>Стабильная</b> круглый год - без блокировок

🔗 Идеально подходит для тех людей, которые ищут стабильное и неограниченное решение`;

      await sendTelegramMessage(chatId, stableText, [
        [{ text: "1 месяц | 1520 ₽", callback_data: "buy_stable_1m" }, { text: "2 месяца | 2500 ₽", callback_data: "buy_stable_2m" }],
        [{ text: "3 месяца | 3740 ₽", callback_data: "buy_stable_3m" }, { text: "6 месяцев | 6630 ₽", callback_data: "buy_stable_6m" }],
        [{ text: "1 год | 10455 ₽", callback_data: "buy_stable_1y" }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ]);

      logger?.info("✅ [processTelegramMessage] Sent stable subscription info");
      return { success: true, action: "stable_info" };
    }

    if (msg.startsWith("buy_stable_")) {
      const subscriptionType = msg.replace("buy_", "");
      const subscription = SUBSCRIPTION_PRICES[subscriptionType];
      
      if (subscription) {
        const { paymentUrl, orderId, amount } = generateRobokassaLink(subscriptionType, userId, userName);
        
        await notifyManager("new_order", userId, userName, orderId, subscriptionType, amount);

        const paymentText = `💳 <b>Оплата подписки</b>

📦 ${subscription.description}
⏱ Период: ${subscription.period}
💰 Сумма: ${subscription.price}₽

Нажмите кнопку ниже для оплаты:`;

        await sendTelegramMessage(chatId, paymentText, [
          [{ text: "💳 Оплатить", url: paymentUrl }],
          [{ text: "⬅️ Назад", callback_data: "stable" }],
          [{ text: "🏠 В меню", callback_data: "menu" }],
        ]);

        logger?.info("✅ [processTelegramMessage] Sent payment link", { orderId, amount });
        return { success: true, action: "payment_link" };
      }
    }

    const defaultText = `❓ Не понял команду. Используйте меню ниже:`;
    await sendTelegramMessage(chatId, defaultText, [
      [{ text: "🎨 Adobe Creative Cloud", callback_data: "adobe_cc" }],
      [{ text: "📞 Поддержка", url: "https://t.me/wpnetwork_sup" }],
    ]);

    logger?.info("✅ [processTelegramMessage] Sent default response");
    return { success: true, action: "default" };
  },
});
