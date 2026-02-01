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

function generateRobokassaLink(subscriptionType: string, userId: string, userName?: string): { paymentUrl: string; orderId: number; amount: number } {
  const subscription = SUBSCRIPTION_PRICES[subscriptionType];
  if (!subscription) {
    throw new Error(`Unknown subscription type: ${subscriptionType}`);
  }

  const orderId = Math.floor(Date.now() / 1000);
  const amount = subscription.price;
  const outSum = amount.toString();

  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN || "";
  const password1 = process.env.ROBOKASSA_PASSWORD1 || "";

  const signatureBase = `${merchantLogin}:${outSum}:${orderId}:${password1}`;
  const signature = crypto.createHash("md5").update(signatureBase).digest("hex");

  const params = new URLSearchParams({
    MerchantLogin: merchantLogin,
    OutSum: outSum,
    InvId: orderId.toString(),
    Description: `${subscription.description} - ${subscription.period}`,
    SignatureValue: signature,
    Culture: "ru",
  });

  return {
    paymentUrl: `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`,
    orderId,
    amount,
  };
}

const InlineButtonSchema = z.object({
  text: z.string(),
  callback_data: z.string().optional(),
  url: z.string().optional(),
});

export const getMenuResponseTool = createTool({
  id: "get-menu-response",
  description: "Determines the appropriate response for Telegram bot based on user message. Returns text and keyboard for the response.",

  inputSchema: z.object({
    message: z.string().describe("User message or callback data"),
    userId: z.string().describe("Telegram user ID"),
    userName: z.string().optional().describe("Telegram username"),
  }),

  outputSchema: z.object({
    text: z.string(),
    inlineKeyboard: z.array(z.array(InlineButtonSchema)).optional(),
    action: z.string(),
    photoUrl: z.string().optional(),
    notifyManager: z.boolean().optional(),
    orderDetails: z.object({
      orderId: z.number(),
      amount: z.number(),
      subscriptionType: z.string(),
    }).optional(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { message, userId, userName } = context;
    
    logger?.info("🔧 [getMenuResponse] Processing:", { message, userId });

    const msg = message.toLowerCase().trim();

    if (msg === "/start" || msg === "start" || msg === "menu" || msg === "в меню") {
      logger?.info("✅ [getMenuResponse] Returning welcome message with photo");
      return {
        text: `🚀 <b>Добро пожаловать!</b>

Здесь ты можешь получить подписки от Adobe. Всё просто: выбираешь продукт и сразу после оплаты получаешь подписку.

🛡️ Даём гарантию и постоянным клиентам скидку

💳 Поддерживаются удобные способы оплаты.
❓ Есть вопросы? Пиши в поддержку @wpnetwork_sup
💡 Наш канал @weplanetnetwork

📜 /b33048669 - Оферта/пользовательское соглашение

🌎 /b34042679 - If you need English language`,
        inlineKeyboard: [
          [{ text: "🎨 Adobe Creative Cloud", callback_data: "adobe_cc" }],
          [{ text: "📞 Поддержка", url: "https://t.me/wpnetwork_sup" }],
        ],
        action: "welcome",
        photoUrl: "https://adobe-subscription-bot.replit.app/images/welcome.jpg",
      };
    }

    if (msg === "adobe_cc" || msg === "adobe creative cloud" || msg.includes("adobe")) {
      logger?.info("✅ [getMenuResponse] Returning subscription type menu");
      return {
        text: `📍 <b>Выбери тип подписки:</b>

✅ Эконом блокируется несколько раз в месяц
✅ Стабильный держится весь срок`,
        inlineKeyboard: [
          [{ text: "💎 Стабильный вариант", callback_data: "stable" }],
          [{ text: "🏠 В меню", callback_data: "menu" }],
        ],
        action: "subscription_types",
      };
    }

    if (msg === "stable" || msg === "стабильный" || msg === "стабильный вариант") {
      logger?.info("✅ [getMenuResponse] Returning stable subscription info");
      return {
        text: `🎉 <b>Это стабильные подписки</b>
Делаются на ваш аккаунт gmail/outlook 🎨
Никогда не слетают и нет проблем с продлением

✅ Доступ ко всем приложениям Adobe (Photoshop, Illustrator, Premiere Pro и др.)
🔥 Безлимит Adobe Stock (Images & Vectors)
💻 До 2х устройств
📈 Можно на вашу почту (сразу после покупки напишите нам об этом)
🔐 <b>Стабильная</b> круглый год - без блокировок

🔗 Идеально подходит для тех людей, которые ищут стабильное и неограниченное решение`,
        inlineKeyboard: [
          [{ text: "1 месяц | 1520 ₽", callback_data: "buy_stable_1m" }, { text: "2 месяца | 2500 ₽", callback_data: "buy_stable_2m" }],
          [{ text: "3 месяца | 3740 ₽", callback_data: "buy_stable_3m" }, { text: "6 месяцев | 6630 ₽", callback_data: "buy_stable_6m" }],
          [{ text: "1 год | 10455 ₽", callback_data: "buy_stable_1y" }],
          [{ text: "🏠 В меню", callback_data: "menu" }],
        ],
        action: "stable_info",
      };
    }

    if (msg.startsWith("buy_stable_")) {
      const subscriptionType = msg.replace("buy_", "");
      const subscription = SUBSCRIPTION_PRICES[subscriptionType];
      
      if (subscription) {
        const { paymentUrl, orderId, amount } = generateRobokassaLink(subscriptionType, userId, userName);
        
        logger?.info("✅ [getMenuResponse] Returning payment link", { orderId, amount });
        return {
          text: `💳 <b>Оплата подписки</b>

📦 ${subscription.description}
⏱ Период: ${subscription.period}
💰 Сумма: ${subscription.price}₽

Нажмите кнопку ниже для оплаты:`,
          inlineKeyboard: [
            [{ text: "💳 Оплатить", url: paymentUrl }],
            [{ text: "⬅️ Назад", callback_data: "stable" }],
            [{ text: "🏠 В меню", callback_data: "menu" }],
          ],
          action: "payment_link",
          notifyManager: true,
          orderDetails: {
            orderId,
            amount,
            subscriptionType,
          },
        };
      }
    }

    logger?.info("✅ [getMenuResponse] Returning default response");
    return {
      text: `❓ Не понял команду. Используйте меню ниже:`,
      inlineKeyboard: [
        [{ text: "🎨 Adobe Creative Cloud", callback_data: "adobe_cc" }],
        [{ text: "📞 Поддержка", url: "https://t.me/wpnetwork_sup" }],
      ],
      action: "default",
    };
  },
});
