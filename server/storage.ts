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
  TrainingDoc,
  InsertTrainingDoc,
  LegalMemo,
  InsertLegalMemo,
  ComplianceChecklist,
  InsertComplianceChecklist,
  ResearchQuery,
  InsertResearchQuery,
  ResearchNote,
  InsertResearchNote,
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

  getTrainingDocs(): Promise<TrainingDoc[]>;
  getTrainingDoc(id: string): Promise<TrainingDoc | undefined>;
  createTrainingDoc(doc: InsertTrainingDoc): Promise<TrainingDoc>;
  deleteTrainingDoc(id: string): Promise<void>;

  getLegalMemos(): Promise<LegalMemo[]>;
  getLegalMemo(id: string): Promise<LegalMemo | undefined>;
  createLegalMemo(memo: InsertLegalMemo): Promise<LegalMemo>;
  updateLegalMemo(id: string, updates: Partial<LegalMemo>): Promise<LegalMemo | undefined>;
  deleteLegalMemo(id: string): Promise<void>;

  getComplianceChecklists(): Promise<ComplianceChecklist[]>;
  getComplianceChecklist(id: string): Promise<ComplianceChecklist | undefined>;
  createComplianceChecklist(checklist: InsertComplianceChecklist): Promise<ComplianceChecklist>;
  updateComplianceChecklist(id: string, updates: Partial<ComplianceChecklist>): Promise<ComplianceChecklist | undefined>;
  deleteComplianceChecklist(id: string): Promise<void>;

  getResearchQueries(): Promise<ResearchQuery[]>;
  getResearchQuery(id: string): Promise<ResearchQuery | undefined>;
  createResearchQuery(query: InsertResearchQuery): Promise<ResearchQuery>;

  getResearchNotes(): Promise<ResearchNote[]>;
  getResearchNote(id: string): Promise<ResearchNote | undefined>;
  createResearchNote(note: InsertResearchNote): Promise<ResearchNote>;
  deleteResearchNote(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage>;
  private drafts: Map<string, Draft>;
  private costLedger: Map<string, CostLedger>;
  private trainingDocs: Map<string, TrainingDoc>;
  private legalMemos: Map<string, LegalMemo>;
  private complianceChecklists: Map<string, ComplianceChecklist>;
  private researchQueries: Map<string, ResearchQuery>;
  private researchNotes: Map<string, ResearchNote>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.drafts = new Map();
    this.costLedger = new Map();
    this.trainingDocs = new Map();
    this.legalMemos = new Map();
    this.complianceChecklists = new Map();
    this.researchQueries = new Map();
    this.researchNotes = new Map();
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
        extractedText: null,
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
        extractedText: null,
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
        extractedText: null,
        uploadedAt: new Date(Date.now() - 120000),
      },
    ];

    sampleDocs.forEach((doc) => this.documents.set(doc.id, doc));

    const sampleSessions: ChatSession[] = [
      {
        id: "session-1",
        title: "Contract Analysis",
        sessionType: "general",
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
        sessionType: "research",
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
        language: "English",
        useFirmStyle: false,
        sessionId: "session-2",
        referenceDocIds: null,
        riskAnalysis: null,
        grammarErrors: null,
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
        language: "English",
        useFirmStyle: false,
        sessionId: null,
        referenceDocIds: null,
        riskAnalysis: null,
        grammarErrors: null,
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
      id,
      name: insertDoc.name,
      type: insertDoc.type,
      size: insertDoc.size,
      pages: insertDoc.pages ?? null,
      status: insertDoc.status ?? "pending",
      processingCost: insertDoc.processingCost ?? null,
      summary: insertDoc.summary ?? null,
      extractedText: insertDoc.extractedText ?? null,
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
      id,
      title: insertSession.title,
      sessionType: insertSession.sessionType ?? null,
      documentIds: insertSession.documentIds ?? null,
      modelTier: insertSession.modelTier ?? null,
      totalCost: insertSession.totalCost ?? null,
      messageCount: insertSession.messageCount ?? null,
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
      id,
      sessionId: insertMsg.sessionId,
      role: insertMsg.role,
      content: insertMsg.content,
      modelUsed: insertMsg.modelUsed ?? null,
      confidence: insertMsg.confidence ?? null,
      cost: insertMsg.cost ?? null,
      citations: insertMsg.citations ?? null,
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
      id,
      title: insertDraft.title,
      type: insertDraft.type,
      content: insertDraft.content ?? null,
      status: insertDraft.status ?? "draft",
      modelUsed: insertDraft.modelUsed ?? null,
      language: insertDraft.language ?? null,
      useFirmStyle: insertDraft.useFirmStyle ?? null,
      sessionId: insertDraft.sessionId ?? null,
      referenceDocIds: insertDraft.referenceDocIds ?? null,
      riskAnalysis: insertDraft.riskAnalysis ?? null,
      grammarErrors: insertDraft.grammarErrors ?? null,
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
      id,
      type: insertEntry.type,
      description: insertEntry.description ?? null,
      amount: insertEntry.amount,
      modelUsed: insertEntry.modelUsed ?? null,
      createdAt: new Date(),
    };
    this.costLedger.set(id, entry);
    return entry;
  }

  async getTotalCost(): Promise<number> {
    return Array.from(this.costLedger.values()).reduce((sum, entry) => sum + entry.amount, 0);
  }

  async getTrainingDocs(): Promise<TrainingDoc[]> {
    return Array.from(this.trainingDocs.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async getTrainingDoc(id: string): Promise<TrainingDoc | undefined> {
    return this.trainingDocs.get(id);
  }

  async createTrainingDoc(insertDoc: InsertTrainingDoc): Promise<TrainingDoc> {
    const id = randomUUID();
    const doc: TrainingDoc = {
      id,
      name: insertDoc.name,
      type: insertDoc.type,
      size: insertDoc.size,
      content: insertDoc.content ?? null,
      status: insertDoc.status ?? "pending",
      uploadedAt: new Date(),
    };
    this.trainingDocs.set(id, doc);
    return doc;
  }

  async deleteTrainingDoc(id: string): Promise<void> {
    this.trainingDocs.delete(id);
  }

  async getLegalMemos(): Promise<LegalMemo[]> {
    return Array.from(this.legalMemos.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getLegalMemo(id: string): Promise<LegalMemo | undefined> {
    return this.legalMemos.get(id);
  }

  async createLegalMemo(insertMemo: InsertLegalMemo): Promise<LegalMemo> {
    const id = randomUUID();
    const now = new Date();
    const memo: LegalMemo = {
      id,
      title: insertMemo.title,
      facts: insertMemo.facts,
      issues: insertMemo.issues ?? null,
      applicableLaw: insertMemo.applicableLaw ?? null,
      analysis: insertMemo.analysis ?? null,
      conclusion: insertMemo.conclusion ?? null,
      sources: insertMemo.sources ?? null,
      fullMemo: insertMemo.fullMemo ?? null,
      status: insertMemo.status ?? "draft",
      modelUsed: insertMemo.modelUsed ?? null,
      documentIds: insertMemo.documentIds ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.legalMemos.set(id, memo);
    return memo;
  }

  async updateLegalMemo(id: string, updates: Partial<LegalMemo>): Promise<LegalMemo | undefined> {
    const memo = this.legalMemos.get(id);
    if (!memo) return undefined;
    const updated = { ...memo, ...updates, updatedAt: new Date() };
    this.legalMemos.set(id, updated);
    return updated;
  }

  async deleteLegalMemo(id: string): Promise<void> {
    this.legalMemos.delete(id);
  }

  async getComplianceChecklists(): Promise<ComplianceChecklist[]> {
    return Array.from(this.complianceChecklists.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getComplianceChecklist(id: string): Promise<ComplianceChecklist | undefined> {
    return this.complianceChecklists.get(id);
  }

  async createComplianceChecklist(insertChecklist: InsertComplianceChecklist): Promise<ComplianceChecklist> {
    const id = randomUUID();
    const now = new Date();
    const checklist: ComplianceChecklist = {
      id,
      title: insertChecklist.title,
      industry: insertChecklist.industry,
      jurisdiction: insertChecklist.jurisdiction,
      activity: insertChecklist.activity,
      items: insertChecklist.items ?? null,
      status: insertChecklist.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    this.complianceChecklists.set(id, checklist);
    return checklist;
  }

  async updateComplianceChecklist(id: string, updates: Partial<ComplianceChecklist>): Promise<ComplianceChecklist | undefined> {
    const checklist = this.complianceChecklists.get(id);
    if (!checklist) return undefined;
    const updated = { ...checklist, ...updates, updatedAt: new Date() };
    this.complianceChecklists.set(id, updated);
    return updated;
  }

  async deleteComplianceChecklist(id: string): Promise<void> {
    this.complianceChecklists.delete(id);
  }

  async getResearchQueries(): Promise<ResearchQuery[]> {
    return Array.from(this.researchQueries.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getResearchQuery(id: string): Promise<ResearchQuery | undefined> {
    return this.researchQueries.get(id);
  }

  async createResearchQuery(insertQuery: InsertResearchQuery): Promise<ResearchQuery> {
    const id = randomUUID();
    const query: ResearchQuery = {
      id,
      query: insertQuery.query,
      results: insertQuery.results ?? null,
      legalDomain: insertQuery.legalDomain ?? null,
      statutes: insertQuery.statutes ?? null,
      caseLaw: insertQuery.caseLaw ?? null,
      analysis: insertQuery.analysis ?? null,
      sources: insertQuery.sources ?? null,
      createdAt: new Date(),
    };
    this.researchQueries.set(id, query);
    return query;
  }

  async getResearchNotes(): Promise<ResearchNote[]> {
    return Array.from(this.researchNotes.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getResearchNote(id: string): Promise<ResearchNote | undefined> {
    return this.researchNotes.get(id);
  }

  async createResearchNote(insertNote: InsertResearchNote): Promise<ResearchNote> {
    const id = randomUUID();
    const note: ResearchNote = {
      id,
      name: insertNote.name,
      content: insertNote.content,
      draftId: insertNote.draftId ?? null,
      createdAt: new Date(),
    };
    this.researchNotes.set(id, note);
    return note;
  }

  async deleteResearchNote(id: string): Promise<void> {
    this.researchNotes.delete(id);
  }
}

export const storage = new MemStorage();
