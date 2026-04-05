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
  CnrNote,
  InsertCnrNote,
  SavedCase,
  InsertSavedCase,
  GoogleCalendarCredentials,
  InsertGoogleCalendarCredentials,
  CalendarEvent,
  InsertCalendarEvent,
  AiUsage,
  AuditLog,
  InsertAuditLog,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { auditLogs as auditLogsTable } from "@shared/schema";
import { desc, eq, gte, and } from "drizzle-orm";

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

  getTrainingDocs(userId?: string): Promise<TrainingDoc[]>;
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
  updateResearchNote(id: string, updates: Partial<{ name: string; content: string }>): Promise<ResearchNote | undefined>;
  deleteResearchNote(id: string): Promise<void>;

  getCnrNotes(): Promise<CnrNote[]>;
  getCnrNote(id: string): Promise<CnrNote | undefined>;
  createCnrNote(note: InsertCnrNote): Promise<CnrNote>;
  updateCnrNote(id: string, updates: Partial<CnrNote>): Promise<CnrNote | undefined>;
  deleteCnrNote(id: string): Promise<void>;

  getSavedCases(): Promise<SavedCase[]>;
  getSavedCase(id: string): Promise<SavedCase | undefined>;
  getSavedCaseByCnr(cnrNumber: string): Promise<SavedCase | undefined>;
  createSavedCase(savedCase: InsertSavedCase): Promise<SavedCase>;
  deleteSavedCase(id: string): Promise<void>;

  getGoogleCalendarCredentials(userId: string): Promise<GoogleCalendarCredentials | undefined>;
  createGoogleCalendarCredentials(creds: InsertGoogleCalendarCredentials): Promise<GoogleCalendarCredentials>;
  updateGoogleCalendarCredentials(userId: string, updates: Partial<GoogleCalendarCredentials>): Promise<GoogleCalendarCredentials | undefined>;
  deleteGoogleCalendarCredentials(userId: string): Promise<void>;

  getCalendarEvents(userId: string): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  getCalendarEventByGoogleId(googleEventId: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;

  getAIUsage(userId: string, date: string): Promise<AiUsage | undefined>;
  incrementAIUsage(userId: string, date: string): Promise<AiUsage>;
  createAuditLog(entry: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { userId?: string; action?: string; since?: Date; limit?: number }): Promise<AuditLog[]>;
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
  private cnrNotes: Map<string, CnrNote>;
  private savedCases: Map<string, SavedCase>;
  private googleCalendarCredentials: Map<string, GoogleCalendarCredentials>;
  private calendarEvents: Map<string, CalendarEvent>;
  private aiUsageMap: Map<string, AiUsage>;
  private auditLogs: Map<string, AuditLog>;

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
    this.cnrNotes = new Map();
    this.savedCases = new Map();
    this.googleCalendarCredentials = new Map();
    this.calendarEvents = new Map();
    this.aiUsageMap = new Map();
    this.auditLogs = new Map();
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
      extractedHtml: insertDoc.extractedHtml ?? null,
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
      parentSessionId: insertSession.parentSessionId ?? null,
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

  async getTrainingDocs(userId?: string): Promise<TrainingDoc[]> {
    const docs = Array.from(this.trainingDocs.values());
    const filtered = userId ? docs.filter(d => d.userId === userId) : docs;
    return filtered.sort(
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
      userId: insertDoc.userId ?? "default-user",
      name: insertDoc.name,
      type: insertDoc.type,
      size: insertDoc.size,
      content: insertDoc.content ?? null,
      extractedHtml: insertDoc.extractedHtml ?? null,
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

  async updateResearchNote(id: string, updates: Partial<{ name: string; content: string }>): Promise<ResearchNote | undefined> {
    const note = this.researchNotes.get(id);
    if (!note) return undefined;
    const updatedNote = { ...note, ...updates };
    this.researchNotes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteResearchNote(id: string): Promise<void> {
    this.researchNotes.delete(id);
  }

  async getCnrNotes(): Promise<CnrNote[]> {
    return Array.from(this.cnrNotes.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getCnrNote(id: string): Promise<CnrNote | undefined> {
    return this.cnrNotes.get(id);
  }

  async createCnrNote(note: InsertCnrNote): Promise<CnrNote> {
    const id = randomUUID();
    const now = new Date();
    const newNote: CnrNote = {
      id,
      title: note.title,
      content: note.content,
      cnrNumber: note.cnrNumber || null,
      createdAt: now,
      updatedAt: now,
    };
    this.cnrNotes.set(id, newNote);
    return newNote;
  }

  async updateCnrNote(id: string, updates: Partial<CnrNote>): Promise<CnrNote | undefined> {
    const note = this.cnrNotes.get(id);
    if (!note) return undefined;
    const updatedNote = { ...note, ...updates, updatedAt: new Date() };
    this.cnrNotes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteCnrNote(id: string): Promise<void> {
    this.cnrNotes.delete(id);
  }

  async getSavedCases(): Promise<SavedCase[]> {
    return Array.from(this.savedCases.values()).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }

  async getSavedCase(id: string): Promise<SavedCase | undefined> {
    return this.savedCases.get(id);
  }

  async getSavedCaseByCnr(cnrNumber: string): Promise<SavedCase | undefined> {
    return Array.from(this.savedCases.values()).find(
      (c) => c.cnrNumber === cnrNumber
    );
  }

  async createSavedCase(savedCase: InsertSavedCase): Promise<SavedCase> {
    const id = randomUUID();
    const newCase: SavedCase = {
      id,
      cnrNumber: savedCase.cnrNumber,
      caseType: savedCase.caseType || null,
      filingNumber: savedCase.filingNumber || null,
      filingDate: savedCase.filingDate || null,
      registrationNumber: savedCase.registrationNumber || null,
      registrationDate: savedCase.registrationDate || null,
      caseStatus: savedCase.caseStatus || null,
      firstHearingDate: savedCase.firstHearingDate || null,
      nextHearingDate: savedCase.nextHearingDate || null,
      caseStage: savedCase.caseStage || null,
      courtNumberAndJudge: savedCase.courtNumberAndJudge || null,
      petitioners: savedCase.petitioners || null,
      respondents: savedCase.respondents || null,
      actsAndSections: savedCase.actsAndSections || null,
      caseTransferDetails: savedCase.caseTransferDetails || null,
      caseHistory: savedCase.caseHistory || null,
      savedAt: new Date(),
    };
    this.savedCases.set(id, newCase);
    return newCase;
  }

  async deleteSavedCase(id: string): Promise<void> {
    this.savedCases.delete(id);
  }

  async getGoogleCalendarCredentials(userId: string): Promise<GoogleCalendarCredentials | undefined> {
    return Array.from(this.googleCalendarCredentials.values()).find(
      (creds) => creds.userId === userId
    );
  }

  async createGoogleCalendarCredentials(insertCreds: InsertGoogleCalendarCredentials): Promise<GoogleCalendarCredentials> {
    const id = randomUUID();
    const now = new Date();
    const creds: GoogleCalendarCredentials = {
      id,
      userId: insertCreds.userId,
      calendarId: insertCreds.calendarId ?? null,
      accessToken: insertCreds.accessToken,
      refreshToken: insertCreds.refreshToken,
      tokenExpiry: insertCreds.tokenExpiry,
      syncToken: insertCreds.syncToken ?? null,
      lastSyncAt: insertCreds.lastSyncAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.googleCalendarCredentials.set(id, creds);
    return creds;
  }

  async updateGoogleCalendarCredentials(userId: string, updates: Partial<GoogleCalendarCredentials>): Promise<GoogleCalendarCredentials | undefined> {
    const creds = await this.getGoogleCalendarCredentials(userId);
    if (!creds) return undefined;
    const updated = { ...creds, ...updates, updatedAt: new Date() };
    this.googleCalendarCredentials.set(creds.id, updated);
    return updated;
  }

  async deleteGoogleCalendarCredentials(userId: string): Promise<void> {
    const creds = await this.getGoogleCalendarCredentials(userId);
    if (creds) {
      this.googleCalendarCredentials.delete(creds.id);
    }
  }

  async getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    return Array.from(this.calendarEvents.values())
      .filter((event) => event.userId === userId)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    return this.calendarEvents.get(id);
  }

  async getCalendarEventByGoogleId(googleEventId: string): Promise<CalendarEvent | undefined> {
    return Array.from(this.calendarEvents.values()).find(
      (event) => event.googleEventId === googleEventId
    );
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const id = randomUUID();
    const now = new Date();
    const event: CalendarEvent = {
      id,
      userId: insertEvent.userId,
      title: insertEvent.title,
      description: insertEvent.description ?? null,
      startTime: insertEvent.startTime,
      endTime: insertEvent.endTime,
      type: insertEvent.type ?? "professional",
      isHighPriority: insertEvent.isHighPriority ?? false,
      googleEventId: insertEvent.googleEventId ?? null,
      syncStatus: insertEvent.syncStatus ?? "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.calendarEvents.set(id, event);
    return event;
  }

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const event = this.calendarEvents.get(id);
    if (!event) return undefined;
    const updated = { ...event, ...updates, updatedAt: new Date() };
    this.calendarEvents.set(id, updated);
    return updated;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    this.calendarEvents.delete(id);
  }

  async getAIUsage(userId: string, date: string): Promise<AiUsage | undefined> {
    const key = `${userId}:${date}`;
    return this.aiUsageMap.get(key);
  }

  async incrementAIUsage(userId: string, date: string): Promise<AiUsage> {
    const key = `${userId}:${date}`;
    const existing = this.aiUsageMap.get(key);
    if (existing) {
      const updated: AiUsage = { ...existing, callCount: existing.callCount + 1 };
      this.aiUsageMap.set(key, updated);
      return updated;
    }
    const newUsage: AiUsage = {
      id: randomUUID(),
      userId,
      date,
      callCount: 1,
    };
    this.aiUsageMap.set(key, newUsage);
    return newUsage;
  }

  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogsTable).values({
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      ipAddress: entry.ipAddress ?? null,
      success: entry.success ?? true,
      errorCode: entry.errorCode ?? null,
      metadata: entry.metadata ?? null,
    }).returning();
    return log;
  }

  async getAuditLogs(filters?: { userId?: string; action?: string; since?: Date; limit?: number }): Promise<AuditLog[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(auditLogsTable.userId, filters.userId));
    if (filters?.action) conditions.push(eq(auditLogsTable.action, filters.action));
    if (filters?.since) conditions.push(gte(auditLogsTable.createdAt, filters.since));

    const query = db
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(filters?.limit ?? 100);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }
}

export const storage = new MemStorage();
