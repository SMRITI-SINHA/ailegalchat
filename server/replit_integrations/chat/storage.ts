import { db } from "../../db";
import { chatSessions, chatMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: string): Promise<typeof chatSessions.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof chatSessions.$inferSelect)[]>;
  createConversation(title: string): Promise<typeof chatSessions.$inferSelect>;
  deleteConversation(id: string): Promise<void>;
  getMessagesByConversation(conversationId: string): Promise<(typeof chatMessages.$inferSelect)[]>;
  createMessage(conversationId: string, role: string, content: string): Promise<typeof chatMessages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: string) {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return session;
  },

  async getAllConversations() {
    return db.select().from(chatSessions).orderBy(desc(chatSessions.createdAt));
  },

  async createConversation(title: string) {
    const [session] = await db
      .insert(chatSessions)
      .values({ title, userId: "integration", sessionType: "integration" })
      .returning();
    return session;
  },

  async deleteConversation(id: string) {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
    await db.delete(chatSessions).where(eq(chatSessions.id, id));
  },

  async getMessagesByConversation(conversationId: string) {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, conversationId))
      .orderBy(chatMessages.createdAt);
  },

  async createMessage(conversationId: string, role: string, content: string) {
    const [message] = await db
      .insert(chatMessages)
      .values({ sessionId: conversationId, userId: "integration", role, content })
      .returning();
    return message;
  },
};
