import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.greetings.get.path, async (req, res) => {
    const greetings = await storage.getGreetings();
    res.json(greetings);
  });

  // Seed data if empty
  const existing = await storage.getGreetings();
  if (existing.length === 0) {
    await storage.createGreeting({ message: "Привет, мир!" });
  }

  return httpServer;
}
