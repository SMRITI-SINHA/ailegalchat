import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { aiUsage } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || "50", 10);

function getISTDateString(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
}

function getMidnightISTResetISO(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const tomorrow = new Date(istNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return new Date(tomorrow.getTime() - istOffset).toISOString();
}

async function getUsageCount(userId: string, date: string): Promise<number> {
  const rows = await db
    .select({ callCount: aiUsage.callCount })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.date, date)));
  return rows.reduce((sum, r) => sum + r.callCount, 0);
}

async function atomicIncrementUsage(userId: string, date: string): Promise<void> {
  await db
    .insert(aiUsage)
    .values({ userId, date, callCount: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.date],
      set: { callCount: sql`${aiUsage.callCount} + 1` },
    });
}

export async function checkAIUsage(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const date = getISTDateString();

  try {
    const callCount = await getUsageCount(userId, date);

    if (callCount >= AI_DAILY_LIMIT) {
      return res.status(429).json({
        error: "Daily AI usage limit reached. Resets at midnight IST.",
        used: callCount,
        limit: AI_DAILY_LIMIT,
        remaining: 0,
        resetsAt: getMidnightISTResetISO(),
      });
    }

    req.aiUserId = userId;
    req.aiUsageDate = date;
    next();
  } catch (err) {
    console.error("[AI Usage] Failed to check usage:", err);
    return res.status(503).json({ error: "Usage check unavailable. Please try again." });
  }
}

export async function recordAIUsage(req: Request): Promise<void> {
  const userId = req.aiUserId;
  const date = req.aiUsageDate;
  if (!userId || !date) return;
  try {
    await atomicIncrementUsage(userId, date);
  } catch (err) {
    console.error("[AI Usage] Failed to record usage:", err);
  }
}

export async function getTodayUsage(req: Request): Promise<{ used: number; limit: number; remaining: number; resetsAt: string }> {
  const userId = req.user?.id;
  if (!userId) {
    return { used: 0, limit: AI_DAILY_LIMIT, remaining: AI_DAILY_LIMIT, resetsAt: getMidnightISTResetISO() };
  }
  const date = getISTDateString();
  const used = await getUsageCount(userId, date);
  const remaining = Math.max(0, AI_DAILY_LIMIT - used);
  return { used, limit: AI_DAILY_LIMIT, remaining, resetsAt: getMidnightISTResetISO() };
}

export { AI_DAILY_LIMIT, getISTDateString };
