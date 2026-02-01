import { greetings, type Greeting, type InsertGreeting } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getGreetings(): Promise<Greeting[]>;
  createGreeting(greeting: InsertGreeting): Promise<Greeting>;
}

export class DatabaseStorage implements IStorage {
  async getGreetings(): Promise<Greeting[]> {
    return await db.select().from(greetings);
  }

  async createGreeting(insertGreeting: InsertGreeting): Promise<Greeting> {
    const [greeting] = await db
      .insert(greetings)
      .values(insertGreeting)
      .returning();
    return greeting;
  }
}

export const storage = new DatabaseStorage();
