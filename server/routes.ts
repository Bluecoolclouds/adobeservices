import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import * as crypto from "crypto";
import { bot } from "./bot";

const SUBSCRIPTION_LABELS: Record<string, string> = {
  "stable_1m": "Adobe CC Стабильная - 1 месяц",
  "stable_2m": "Adobe CC Стабильная - 2 месяца",
  "stable_3m": "Adobe CC Стабильная - 3 месяца",
  "stable_6m": "Adobe CC Стабильная - 6 месяцев",
  "stable_1y": "Adobe CC Стабильная - 1 год",
  "chatgpt_1m": "ChatGPT Plus - 1 месяц",
  "chatgpt_1y": "ChatGPT Plus - 1 год",
  "google_pro_1m": "Google AI Pro 2TB - 1 месяц",
  "google_pro_1y": "Google AI Pro 2TB - 12 месяцев",
  "google_ultra_1m": "Google AI Ultra - 1 месяц",
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.greetings.get.path, async (req, res) => {
    const greetings = await storage.getGreetings();
    res.json(greetings);
  });

  app.post("/api/robokassa/result", async (req, res) => {
    try {
      const { OutSum, InvId, SignatureValue, Shp_userId, Shp_userName, Shp_subscriptionType } = req.body;
      
      const password2 = process.env.ROBOKASSA_PASSWORD2 || process.env.ROBOKASSA_PASSWORD1 || "";
      
      const shpParams = [];
      if (Shp_subscriptionType) shpParams.push(`Shp_subscriptionType=${Shp_subscriptionType}`);
      if (Shp_userId) shpParams.push(`Shp_userId=${Shp_userId}`);
      if (Shp_userName) shpParams.push(`Shp_userName=${Shp_userName}`);
      shpParams.sort();
      
      const checkString = `${OutSum}:${InvId}:${password2}:${shpParams.join(":")}`;
      const expectedSignature = crypto.createHash("md5").update(checkString).digest("hex").toUpperCase();
      
      if (SignatureValue?.toUpperCase() === expectedSignature) {
        console.log(`Payment confirmed: InvId=${InvId}, OutSum=${OutSum}, User=${Shp_userId}`);
        
        const managerChatId = process.env.MANAGER_CHAT_ID;
        if (managerChatId) {
          const message = `✅ <b>Оплата подтверждена!</b>\n\n` +
            `👤 Пользователь: ${Shp_userName ? `@${Shp_userName}` : Shp_userId}\n` +
            `📦 Подписка: ${SUBSCRIPTION_LABELS[Shp_subscriptionType] || Shp_subscriptionType}\n` +
            `💰 Сумма: ${OutSum}₽\n` +
            `🔢 ID заказа: ${InvId}\n\n` +
            `📧 Свяжитесь с клиентом для выдачи подписки!`;
          
          await bot.sendMessage(managerChatId, message, { parse_mode: "HTML" });
        }
        
        res.send(`OK${InvId}`);
      } else {
        console.error(`Invalid signature: expected ${expectedSignature}, got ${SignatureValue}`);
        res.status(400).send("Invalid signature");
      }
    } catch (error) {
      console.error("Robokassa result error:", error);
      res.status(500).send("Error");
    }
  });

  app.get("/api/robokassa/success", async (req, res) => {
    const { Shp_userId, Shp_subscriptionType } = req.query;
    
    if (Shp_userId) {
      try {
        const subscriptionLabel = SUBSCRIPTION_LABELS[Shp_subscriptionType as string] || Shp_subscriptionType;
        const successMessage = `✅ <b>Оплата прошла успешно!</b>\n\n` +
          `📦 Подписка: ${subscriptionLabel}\n\n` +
          `Спасибо за покупку! Менеджер свяжется с вами в ближайшее время для выдачи подписки.\n\n` +
          `📞 Поддержка: @wpnetwork_sup`;
        
        await bot.sendMessage(Shp_userId as string, successMessage, { parse_mode: "HTML" });
      } catch (error) {
        console.error("Failed to send success message to user:", error);
      }
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Оплата успешна</title>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="2;url=https://t.me/weplanetnetwork_bot">
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>Оплата прошла успешно!</h1>
        <p>Переход в бота через 2 секунды...</p>
        <p><a href="https://t.me/weplanetnetwork_bot">Перейти в бота</a></p>
      </body>
      </html>
    `);
  });

  app.get("/api/robokassa/fail", async (req, res) => {
    const { Shp_userId, Shp_subscriptionType } = req.query;
    
    if (Shp_userId) {
      try {
        const subscriptionLabel = SUBSCRIPTION_LABELS[Shp_subscriptionType as string] || Shp_subscriptionType;
        const failMessage = `❌ <b>Оплата не прошла</b>\n\n` +
          `📦 Подписка: ${subscriptionLabel}\n\n` +
          `К сожалению, оплата не была завершена. Попробуйте ещё раз или свяжитесь с поддержкой.\n\n` +
          `📞 Поддержка: @wpnetwork_sup`;
        
        await bot.sendMessage(Shp_userId as string, failMessage, { parse_mode: "HTML" });
      } catch (error) {
        console.error("Failed to send fail message to user:", error);
      }
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ошибка оплаты</title>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="2;url=https://t.me/weplanetnetwork_bot">
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>Оплата не прошла</h1>
        <p>Переход в бота через 2 секунды...</p>
        <p><a href="https://t.me/weplanetnetwork_bot">Перейти в бота</a></p>
      </body>
      </html>
    `);
  });

  const existing = await storage.getGreetings();
  if (existing.length === 0) {
    await storage.createGreeting({ message: "Привет, мир!" });
  }

  return httpServer;
}
