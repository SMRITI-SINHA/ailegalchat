import type {
  User,
  InsertUser,
  Document,
  InsertDocument,
  ChatSession,
  InsertChatSession,
  ChatMessage,
  InsertChatMessage,
  Draft,
  InsertDraft,
  CostLedger,
  InsertCostLedger,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<void>;

  getChatSessions(): Promise<ChatSession[]>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  deleteChatSession(id: string): Promise<void>;

  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  getDrafts(): Promise<Draft[]>;
  getDraft(id: string): Promise<Draft | undefined>;
  createDraft(draft: InsertDraft): Promise<Draft>;
  updateDraft(id: string, updates: Partial<Draft>): Promise<Draft | undefined>;
  deleteDraft(id: string): Promise<void>;

  getCostLedger(): Promise<CostLedger[]>;
  addCostEntry(entry: InsertCostLedger): Promise<CostLedger>;
  getTotalCost(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage>;
  private drafts: Map<string, Draft>;
  private costLedger: Map<string, CostLedger>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.drafts = new Map();
    this.costLedger = new Map();
    this.seedData();
  }

  private seedData() {
    const sampleDocs: Document[] = [
      {
        id: "doc-1",
        name: "Contract_Agreement_2024.pdf",
        type: "application/pdf",
        size: 2458624,
        pages: 45,
        status: "completed",
        processingCost: 0.95,
        summary: "This is a comprehensive service agreement between ABC Corp and XYZ Ltd covering IT consulting services for a 2-year term. Key clauses include payment terms, intellectual property rights, confidentiality obligations, and termination conditions.",
        uploadedAt: new Date(Date.now() - 600000),
      },
      {
        id: "doc-2",
        name: "Property_Dispute_Case.pdf",
        type: "application/pdf",
        size: 1847552,
        pages: 78,
        status: "completed",
        processingCost: 1.20,
        summary: "Civil suit regarding property boundary dispute in South Delhi. The petitioner claims adverse possession over a 500 sq yard plot. Multiple witness statements and land records are included.",
        uploadedAt: new Date(Date.now() - 3600000),
      },
      {
        id: "doc-3",
        name: "IPC_Section_420_Analysis.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 524288,
        pages: 12,
        status: "processing",
        processingCost: 0,
        summary: null,
        uploadedAt: new Date(Date.now() - 120000),
      },
    ];

    sampleDocs.forEach((doc) => this.documents.set(doc.id, doc));

    const sampleSessions: ChatSession[] = [
      {
        id: "session-1",
        title: "Contract Analysis",
        documentIds: ["doc-1"],
        modelTier: "standard",
        totalCost: 4.20,
        messageCount: 15,
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 1800000),
      },
      {
        id: "session-2",
        title: "Property Law Research",
        documentIds: ["doc-2"],
        modelTier: "pro",
        totalCost: 12.50,
        messageCount: 8,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 43200000),
      },
    ];

    sampleSessions.forEach((session) => this.chatSessions.set(session.id, session));

    const sampleDrafts: Draft[] = [
      {
        id: "draft-1",
        title: "Written Statement - Property Dispute",
        type: "written_statement",
        content: "IN THE COURT OF CIVIL JUDGE...",
        status: "completed",
        modelUsed: "standard",
        sessionId: "session-2",
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 3600000),
      },
      {
        id: "draft-2",
        title: "Legal Notice - Breach of Contract",
        type: "notice",
        content: "LEGAL NOTICE\n\nTo,\nThe Managing Director...",
        status: "draft",
        modelUsed: "mini",
        sessionId: null,
        createdAt: new Date(Date.now() - 14400000),
        updatedAt: new Date(Date.now() - 10800000),
      },
    ];

    sampleDrafts.forEach((draft) => this.drafts.set(draft.id, draft));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const doc: Document = {
      ...insertDoc,
      id,
      uploadedAt: new Date(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;
    const updated = { ...doc, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async getChatSessions(): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = randomUUID();
    const now = new Date();
    const session: ChatSession = {
      ...insertSession,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.chatSessions.set(id, session);
    return session;
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.chatSessions.set(id, updated);
    return updated;
  }

  async deleteChatSession(id: string): Promise<void> {
    this.chatSessions.delete(id);
    for (const [msgId, msg] of this.chatMessages) {
      if (msg.sessionId === id) {
        this.chatMessages.delete(msgId);
      }
    }
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter((msg) => msg.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createChatMessage(insertMsg: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const msg: ChatMessage = {
      ...insertMsg,
      id,
      createdAt: new Date(),
    };
    this.chatMessages.set(id, msg);
    return msg;
  }

  async getDrafts(): Promise<Draft[]> {
    return Array.from(this.drafts.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    return this.drafts.get(id);
  }

  async createDraft(insertDraft: InsertDraft): Promise<Draft> {
    const id = randomUUID();
    const now = new Date();
    const draft: Draft = {
      ...insertDraft,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.set(id, draft);
    return draft;
  }

  async updateDraft(id: string, updates: Partial<Draft>): Promise<Draft | undefined> {
    const draft = this.drafts.get(id);
    if (!draft) return undefined;
    const updated = { ...draft, ...updates, updatedAt: new Date() };
    this.drafts.set(id, updated);
    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    this.drafts.delete(id);
  }

  async getCostLedger(): Promise<CostLedger[]> {
    return Array.from(this.costLedger.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async addCostEntry(insertEntry: InsertCostLedger): Promise<CostLedger> {
    const id = randomUUID();
    const entry: CostLedger = {
      ...insertEntry,
      id,
      createdAt: new Date(),
    };
    this.costLedger.set(id, entry);
    return entry;
  }

  async getTotalCost(): Promise<number> {
    return Array.from(this.costLedger.values()).reduce((sum, entry) => sum + entry.amount, 0);
  }
}

export const storage = new MemStorage();
