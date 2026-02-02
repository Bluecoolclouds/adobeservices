import TelegramBot from "node-telegram-bot-api";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set");
}

export const bot = new TelegramBot(token, { polling: true });

const SUBSCRIPTION_PRICES: Record<string, { price: number; description: string; period: string; category: string }> = {
  "stable_1m": { price: 1, description: "Adobe Creative Cloud - Стабильная", period: "1 месяц", category: "adobe" },
  "stable_2m": { price: 2500, description: "Adobe Creative Cloud - Стабильная", period: "2 месяца", category: "adobe" },
  "stable_3m": { price: 3740, description: "Adobe Creative Cloud - Стабильная", period: "3 месяца", category: "adobe" },
  "stable_6m": { price: 6630, description: "Adobe Creative Cloud - Стабильная", period: "6 месяцев", category: "adobe" },
  "stable_1y": { price: 10455, description: "Adobe Creative Cloud - Стабильная", period: "1 год", category: "adobe" },
  "chatgpt_1m": { price: 990, description: "ChatGPT Plus", period: "1 месяц", category: "chatgpt" },
  "chatgpt_1y": { price: 8900, description: "ChatGPT Plus", period: "1 год", category: "chatgpt" },
  "google_pro_1m": { price: 1500, description: "Google AI Pro 2TB VEO 3", period: "1 месяц", category: "google" },
  "google_pro_1y": { price: 3000, description: "Google AI Pro 2TB VEO 3", period: "12 месяцев", category: "google" },
  "google_ultra_1m": { price: 4500, description: "Google AI Ultra", period: "1 месяц", category: "google" },
};

function generateRobokassaLink(subscriptionType: string, userId: string, userName?: string): { paymentUrl: string; orderId: number; amount: number } {
  const subscription = SUBSCRIPTION_PRICES[subscriptionType];
  if (!subscription) {
    throw new Error(`Unknown subscription type: ${subscriptionType}`);
  }

  const orderId = Math.floor(Date.now() / 1000);
  const amount = subscription.price;

  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN || "demo";
  const password1 = process.env.ROBOKASSA_PASSWORD1 || "demo";
  const isTest = process.env.ROBOKASSA_TEST_MODE === "true" ? 1 : 0;

  const shpParams = [
    `Shp_subscriptionType=${subscriptionType}`,
    `Shp_userId=${userId}`,
  ];
  if (userName) {
    shpParams.push(`Shp_userName=${userName}`);
  }
  shpParams.sort();

  const signatureString = `${merchantLogin}:${amount}:${orderId}:${password1}:${shpParams.join(":")}`;
  const signature = crypto.createHash("md5").update(signatureString).digest("hex");

  const params = new URLSearchParams({
    MerchantLogin: merchantLogin,
    OutSum: amount.toString(),
    InvId: orderId.toString(),
    Description: `${subscription.description} - ${subscription.period}`,
    SignatureValue: signature,
    IsTest: isTest.toString(),
    Culture: "ru",
  });

  params.append("Shp_subscriptionType", subscriptionType);
  params.append("Shp_userId", userId);
  if (userName) params.append("Shp_userName", userName);

  return {
    paymentUrl: `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`,
    orderId,
    amount,
  };
}

async function notifyManager(eventType: string, userId: string, userName?: string, orderId?: number, subscriptionType?: string, amount?: number): Promise<void> {
  const managerChatId = process.env.MANAGER_CHAT_ID;
  if (!managerChatId) return;

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
    try {
      await bot.sendMessage(managerChatId, message, { parse_mode: "HTML" });
      console.log("Manager notified successfully");
    } catch (error) {
      console.error("Failed to notify manager:", error);
    }
  }
}

async function sendWelcome(chatId: number) {
  const welcomeText = `🚀 <b>Добро пожаловать!</b>

Здесь ты можешь получить подписки от Adobe. Всё просто: выбираешь продукт и сразу после оплаты получаешь подписку.

🛡️ Даём гарантию и постоянным клиентам скидку

💳 Поддерживаются удобные способы оплаты.
❓ Есть вопросы? Пиши в поддержку @wpnetwork_sup
💡 Наш канал @weplanetnetwork`;

  const photoPath = path.join(process.cwd(), "client", "public", "welcome.jpg");
  
  await bot.sendPhoto(chatId, photoPath, {
    caption: welcomeText,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎨 Adobe Creative Cloud", callback_data: "adobe_cc" }],
        [{ text: "🤖 Аккаунт ChatGPT", callback_data: "chatgpt" }],
        [{ text: "🔷 Google AI Pro / Ultra", callback_data: "google_ai" }],
        [{ text: "📞 Поддержка", url: "https://t.me/wpnetwork_sup" }],
      ],
    },
  });
}

async function sendSubscriptionTypes(chatId: number) {
  const typeText = `📍 <b>Выбери тип подписки:</b>

✅ Эконом блокируется несколько раз в месяц
✅ Стабильный держится весь срок`;

  await bot.sendMessage(chatId, typeText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💎 Стабильный вариант", callback_data: "stable" }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ],
    },
  });
}

async function sendStableInfo(chatId: number) {
  const stableText = `🎉 <b>Это стабильные подписки</b>
Делаются на ваш аккаунт gmail/outlook 🎨
Никогда не слетают и нет проблем с продлением

✅ Доступ ко всем приложениям Adobe (Photoshop, Illustrator, Premiere Pro и др.)
🔥 Безлимит Adobe Stock (Images & Vectors)
💻 До 2х устройств
📈 Можно на вашу почту (сразу после покупки напишите нам об этом)
🔐 <b>Стабильная</b> круглый год - без блокировок

🔗 Идеально подходит для тех людей, которые ищут стабильное и неограниченное решение`;

  await bot.sendMessage(chatId, stableText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "1 месяц | 1 ₽ (тест)", callback_data: "buy_stable_1m" }, { text: "2 месяца | 2500 ₽", callback_data: "buy_stable_2m" }],
        [{ text: "3 месяца | 3740 ₽", callback_data: "buy_stable_3m" }, { text: "6 месяцев | 6630 ₽", callback_data: "buy_stable_6m" }],
        [{ text: "1 год | 10455 ₽", callback_data: "buy_stable_1y" }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ],
    },
  });
}

async function sendChatGPTInfo(chatId: number) {
  const chatgptText = `🤖 <b>ChatGPT Plus</b>

<b>Включено:</b>
✔ Официальный статус ChatGPT Plus
✔ Полный доступ ко всем премиум-функциям
✔ История чатов и настройки сохраняются
✔ Быстрая активация после оплаты

🔐 <b>Безопасность и полный контроль</b>

✔ Аккаунт полностью принадлежит вам
✔ Можно менять почту, пароль и настройки в любое время
✔ Используем только официальные способы активации

Мы остаёмся с вами до полного подтверждения корректной работы подписки.

❓ <b>Коротко о главном</b>

Безопасно? — Да, только официальная активация
Чаты пропадут? — Нет, всё сохраняется
Можно сменить почту позже? — Да, в любой момент`;

  await bot.sendMessage(chatId, chatgptText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "1 месяц | 990 ₽", callback_data: "buy_chatgpt_1m" }],
        [{ text: "1 год | 8900 ₽", callback_data: "buy_chatgpt_1y" }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ],
    },
  });
}

async function sendGoogleAIInfo(chatId: number) {
  const googleText = `🔷 <b>GEMINI 3.0 PRO: Превосходство над GPT-5.1</b>

🏆 <b>Объективные цифры (Тест HLE):</b>
Gemini 3 Pro: 38.3% (Лидер рынка)
GPT-5: 25.3%
Результат: Gemini решает сложные задачи в 1.5 раза эффективнее.

⚡ <b>Ключевые преимущества:</b>
💎 1 Млн токенов: Помнит контекст книг, видео и кода. Не теряет нить диалога.
🕵️‍♂️ Deep Research: ИИ сам ищет информацию в сети, читает файлы и готовит отчеты.

🎁 <b>Что входит в подписку:</b>
🚀 Gemini 3.0 Pro — Основная модель
🍌 Nano Banana Pro — Эксклюзивный доступ
🎬 Veo 3.1 — Генерация реалистичных видео (8 сек) со звуком
📚 NotebookLM Pro — Лимиты увеличены в 5 раз
☁️ Google One 2 TB — Хранилище для Drive, Photos, Gmail
📝 Workspace — ИИ-ассистент в Docs, Sheets и Gmail`;

  await bot.sendMessage(chatId, googleText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Pro 2TB 1 мес (гар. 1 мес) | 1500 ₽", callback_data: "buy_google_pro_1m" }],
        [{ text: "Pro 2TB 12 мес (гар. 3 мес) | 3000 ₽", callback_data: "buy_google_pro_1y" }],
        [{ text: "Ultra 45000 кредитов 1 мес | 4500 ₽", callback_data: "buy_google_ultra_1m" }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ],
    },
  });
}

async function sendPaymentLink(chatId: number, userId: string, userName: string | undefined, subscriptionType: string) {
  const subscription = SUBSCRIPTION_PRICES[subscriptionType];
  if (!subscription) return;

  const { paymentUrl, orderId, amount } = generateRobokassaLink(subscriptionType, userId, userName);

  const paymentText = `💳 <b>Оплата подписки</b>

📦 ${subscription.description}
⏱ Период: ${subscription.period}
💰 Сумма: ${subscription.price}₽

Нажмите кнопку ниже для оплаты:`;

  const backCallbacks: Record<string, string> = {
    "chatgpt": "chatgpt",
    "google": "google_ai",
    "adobe": "stable"
  };
  const backCallback = backCallbacks[subscription.category] || "menu";

  await bot.sendMessage(chatId, paymentText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Оплатить", url: paymentUrl }],
        [{ text: "⬅️ Назад", callback_data: backCallback }],
        [{ text: "🏠 В меню", callback_data: "menu" }],
      ],
    },
  });

  console.log(`Payment link generated: orderId=${orderId}, amount=${amount}`);
}

async function sendDefault(chatId: number) {
  const defaultText = `❓ Не понял команду. Используйте меню ниже:`;

  await bot.sendMessage(chatId, defaultText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎨 Adobe Creative Cloud", callback_data: "adobe_cc" }],
        [{ text: "🤖 Аккаунт ChatGPT", callback_data: "chatgpt" }],
        [{ text: "🔷 Google AI Pro / Ultra", callback_data: "google_ai" }],
        [{ text: "📞 Поддержка", url: "https://t.me/wpnetwork_sup" }],
      ],
    },
  });
}

bot.onText(/\/start/, async (msg) => {
  await sendWelcome(msg.chat.id);
});

bot.on("callback_query", async (query) => {
  if (!query.message || !query.data) return;

  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const userName = query.from.username;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    if (data === "menu") {
      await sendWelcome(chatId);
    } else if (data === "adobe_cc") {
      await sendSubscriptionTypes(chatId);
    } else if (data === "stable") {
      await sendStableInfo(chatId);
    } else if (data === "chatgpt") {
      await sendChatGPTInfo(chatId);
    } else if (data === "google_ai") {
      await sendGoogleAIInfo(chatId);
    } else if (data.startsWith("buy_")) {
      const subscriptionType = data.replace("buy_", "");
      await sendPaymentLink(chatId, userId, userName, subscriptionType);
    }
  } catch (error) {
    console.error("Callback query error:", error);
  }
});

bot.on("message", async (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    const text = msg.text.toLowerCase().trim();
    
    if (text === "menu" || text === "меню" || text === "в меню") {
      await sendWelcome(msg.chat.id);
    } else if (text.includes("adobe")) {
      await sendSubscriptionTypes(msg.chat.id);
    } else {
      await sendDefault(msg.chat.id);
    }
  }
});

console.log("Telegram bot started!");
