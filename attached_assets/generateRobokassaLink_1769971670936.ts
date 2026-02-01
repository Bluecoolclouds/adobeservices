import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as crypto from "crypto";

const SUBSCRIPTION_PRICES: Record<string, { price: number; description: string }> = {
  "stable_1m": { price: 1520, description: "Adobe Creative Cloud - 1 месяц" },
  "stable_2m": { price: 2500, description: "Adobe Creative Cloud - 2 месяца" },
  "stable_3m": { price: 3740, description: "Adobe Creative Cloud - 3 месяца" },
  "stable_6m": { price: 6630, description: "Adobe Creative Cloud - 6 месяцев" },
  "stable_1y": { price: 10455, description: "Adobe Creative Cloud - 1 год" },
};

export const generateRobokassaLinkTool = createTool({
  id: "generate-robokassa-link",
  description: "Generates a payment link for Robokassa based on selected subscription plan. Use when user selects a subscription duration.",
  
  inputSchema: z.object({
    subscriptionType: z.enum(["stable_1m", "stable_2m", "stable_3m", "stable_6m", "stable_1y"])
      .describe("Subscription type and duration"),
    userId: z.string().describe("Telegram user ID for order tracking"),
    userName: z.string().optional().describe("Telegram username"),
  }),

  outputSchema: z.object({
    paymentUrl: z.string(),
    orderId: z.string(),
    amount: z.number(),
    description: z.string(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [generateRobokassaLink] Generating payment link:", context);

    const { subscriptionType, userId, userName } = context;
    const subscription = SUBSCRIPTION_PRICES[subscriptionType];
    
    if (!subscription) {
      throw new Error(`Unknown subscription type: ${subscriptionType}`);
    }

    const orderId = `${userId}_${Date.now()}`;
    const amount = subscription.price;
    const description = subscription.description;

    const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN || "demo";
    const password1 = process.env.ROBOKASSA_PASSWORD1 || "demo";
    const isTest = process.env.ROBOKASSA_TEST_MODE === "true" ? 1 : 0;

    const signatureString = `${merchantLogin}:${amount}:${orderId}:${password1}`;
    const signature = crypto.createHash("md5").update(signatureString).digest("hex");

    const baseUrl = isTest 
      ? "https://auth.robokassa.ru/Merchant/Index.aspx"
      : "https://auth.robokassa.ru/Merchant/Index.aspx";

    const params = new URLSearchParams({
      MerchantLogin: merchantLogin,
      OutSum: amount.toString(),
      InvId: orderId,
      Description: description,
      SignatureValue: signature,
      IsTest: isTest.toString(),
      Culture: "ru",
    });

    if (userName) {
      params.append("Shp_userName", userName);
    }
    params.append("Shp_userId", userId);
    params.append("Shp_subscriptionType", subscriptionType);

    const paymentUrl = `${baseUrl}?${params.toString()}`;

    logger?.info("✅ [generateRobokassaLink] Payment link generated:", { orderId, amount, paymentUrl });

    return {
      paymentUrl,
      orderId,
      amount,
      description,
    };
  },
});
