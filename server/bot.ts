import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set");
}

export const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Привет, мир! Добро пожаловать в бота!");
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Доступные команды:\n/start - Начать\n/help - Помощь\n/hello - Получить приветствие"
  );
});

bot.onText(/\/hello/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Привет, мир!");
});

bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Вы написали: ${msg.text}`);
  }
});

console.log("Telegram bot started!");
