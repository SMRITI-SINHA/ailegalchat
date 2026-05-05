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
import { getDb } from "./db";
import {
  auditLogs as auditLogsTable,
  users,
  documents,
  chatSessions,
  chatMessages,
  drafts,
  costLedger as costLedgerTable,
  trainingDocs,
  legalMemos,
  complianceChecklists,
  researchQueries,
  researchNotes,
  cnrNotes,
  savedCases as savedCasesTable,
  googleCalendarCredentials as googleCalendarCredentialsTable,
  calendarEvents as calendarEventsTable,
  aiUsage as aiUsageTable,
} from "@shared/schema";
import { desc, asc, eq, gte, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string, userId: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string, userId: string): Promise<void>;

  getChatSessions(userId: string): Promise<ChatSession[]>;
  getChatSession(id: string, userId: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  deleteChatSession(id: string, userId: string): Promise<void>;

  getChatMessages(sessionId: string, userId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  getDrafts(userId: string): Promise<Draft[]>;
  getDraft(id: string, userId: string): Promise<Draft | undefined>;
  createDraft(draft: InsertDraft): Promise<Draft>;
  updateDraft(id: string, userId: string, updates: Partial<Draft>): Promise<Draft | undefined>;
  deleteDraft(id: string, userId: string): Promise<void>;

  getCostLedger(): Promise<CostLedger[]>;
  addCostEntry(entry: InsertCostLedger): Promise<CostLedger>;
  getTotalCost(): Promise<number>;

  getTrainingDocs(userId?: string): Promise<TrainingDoc[]>;
  getTrainingDoc(id: string): Promise<TrainingDoc | undefined>;
  createTrainingDoc(doc: InsertTrainingDoc): Promise<TrainingDoc>;
  deleteTrainingDoc(id: string): Promise<void>;

  getLegalMemos(userId: string): Promise<LegalMemo[]>;
  getLegalMemo(id: string, userId: string): Promise<LegalMemo | undefined>;
  createLegalMemo(memo: InsertLegalMemo): Promise<LegalMemo>;
  updateLegalMemo(id: string, updates: Partial<LegalMemo>): Promise<LegalMemo | undefined>;
  deleteLegalMemo(id: string, userId: string): Promise<void>;

  getComplianceChecklists(): Promise<ComplianceChecklist[]>;
  getComplianceChecklist(id: string): Promise<ComplianceChecklist | undefined>;
  createComplianceChecklist(checklist: InsertComplianceChecklist): Promise<ComplianceChecklist>;
  updateComplianceChecklist(id: string, updates: Partial<ComplianceChecklist>): Promise<ComplianceChecklist | undefined>;
  deleteComplianceChecklist(id: string): Promise<void>;

  getResearchQueries(userId: string): Promise<ResearchQuery[]>;
  getResearchQuery(id: string, userId: string): Promise<ResearchQuery | undefined>;
  createResearchQuery(query: InsertResearchQuery): Promise<ResearchQuery>;

  getResearchNotes(userId: string): Promise<ResearchNote[]>;
  getResearchNote(id: string, userId: string): Promise<ResearchNote | undefined>;
  createResearchNote(note: InsertResearchNote): Promise<ResearchNote>;
  updateResearchNote(id: string, userId: string, updates: Partial<{ name: string; content: string }>): Promise<ResearchNote | undefined>;
  deleteResearchNote(id: string, userId: string): Promise<void>;

  getCnrNotes(userId: string): Promise<CnrNote[]>;
  getCnrNote(id: string, userId: string): Promise<CnrNote | undefined>;
  createCnrNote(note: InsertCnrNote): Promise<CnrNote>;
  updateCnrNote(id: string, userId: string, updates: Partial<CnrNote>): Promise<CnrNote | undefined>;
  deleteCnrNote(id: string, userId: string): Promise<void>;

  getSavedCases(userId: string): Promise<SavedCase[]>;
  getSavedCase(id: string, userId: string): Promise<SavedCase | undefined>;
  getSavedCaseByCnr(cnrNumber: string, userId: string): Promise<SavedCase | undefined>;
  createSavedCase(savedCase: InsertSavedCase): Promise<SavedCase>;
  deleteSavedCase(id: string, userId: string): Promise<void>;

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

  async getDocuments(userId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(d => d.userId === userId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getDocument(id: string, userId: string): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    return doc && doc.userId === userId ? doc : undefined;
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const doc: Document = {
      id,
      userId: insertDoc.userId,
      name: insertDoc.name,
      type: insertDoc.type,
      size: insertDoc.size,
      pages: insertDoc.pages ?? null,
      status: insertDoc.status ?? "pending",
      processingCost: insertDoc.processingCost ?? null,
      summary: insertDoc.summary ?? null,
      extractedText: insertDoc.extractedText ?? null,
      extractedHtml: insertDoc.extractedHtml ?? null,
      storagePath: insertDoc.storagePath ?? null,
      storageUrl: insertDoc.storageUrl ?? null,
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

  async deleteDocument(id: string, userId: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc && doc.userId === userId) {
      this.documents.delete(id);
    }
  }

  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getChatSession(id: string, userId: string): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(id);
    return session && session.userId === userId ? session : undefined;
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = randomUUID();
    const now = new Date();
    const session: ChatSession = {
      id,
      userId: insertSession.userId,
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

  async deleteChatSession(id: string, userId: string): Promise<void> {
    const session = this.chatSessions.get(id);
    if (session && session.userId === userId) {
      this.chatSessions.delete(id);
      for (const [msgId, msg] of this.chatMessages) {
        if (msg.sessionId === id) {
          this.chatMessages.delete(msgId);
        }
      }
    }
  }

  async getChatMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const session = this.chatSessions.get(sessionId);
    if (!session || session.userId !== userId) return [];
    return Array.from(this.chatMessages.values())
      .filter((msg) => msg.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createChatMessage(insertMsg: InsertChatMessage): Promise<ChatMessage> {
    const session = this.chatSessions.get(insertMsg.sessionId);
    if (!session || session.userId !== insertMsg.userId) {
      throw new Error("Unauthorized: session does not belong to user");
    }
    const id = randomUUID();
    const msg: ChatMessage = {
      id,
      userId: insertMsg.userId,
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

  async getDrafts(userId: string): Promise<Draft[]> {
    return Array.from(this.drafts.values())
      .filter(d => d.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getDraft(id: string, userId: string): Promise<Draft | undefined> {
    const draft = this.drafts.get(id);
    return draft && draft.userId === userId ? draft : undefined;
  }

  async createDraft(insertDraft: InsertDraft): Promise<Draft> {
    const id = randomUUID();
    const now = new Date();
    const draft: Draft = {
      id,
      userId: insertDraft.userId,
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

  async updateDraft(id: string, userId: string, updates: Partial<Draft>): Promise<Draft | undefined> {
    const draft = this.drafts.get(id);
    if (!draft || draft.userId !== userId) return undefined;
    const { userId: _stripped, ...safeUpdates } = updates as Draft;
    const updated = { ...draft, ...safeUpdates, userId, updatedAt: new Date() };
    this.drafts.set(id, updated);
    return updated;
  }

  async deleteDraft(id: string, userId: string): Promise<void> {
    const draft = this.drafts.get(id);
    if (draft && draft.userId === userId) {
      this.drafts.delete(id);
    }
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
      storagePath: insertDoc.storagePath ?? null,
      storageUrl: insertDoc.storageUrl ?? null,
      uploadedAt: new Date(),
    };
    this.trainingDocs.set(id, doc);
    return doc;
  }

  async deleteTrainingDoc(id: string): Promise<void> {
    this.trainingDocs.delete(id);
  }

  async getLegalMemos(userId: string): Promise<LegalMemo[]> {
    return Array.from(this.legalMemos.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getLegalMemo(id: string, userId: string): Promise<LegalMemo | undefined> {
    const memo = this.legalMemos.get(id);
    return memo && memo.userId === userId ? memo : undefined;
  }

  async createLegalMemo(insertMemo: InsertLegalMemo): Promise<LegalMemo> {
    const id = randomUUID();
    const now = new Date();
    const memo: LegalMemo = {
      id,
      userId: insertMemo.userId,
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

  async deleteLegalMemo(id: string, userId: string): Promise<void> {
    const memo = this.legalMemos.get(id);
    if (memo && memo.userId === userId) {
      this.legalMemos.delete(id);
    }
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

  async getResearchQueries(userId: string): Promise<ResearchQuery[]> {
    return Array.from(this.researchQueries.values())
      .filter(q => q.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getResearchQuery(id: string, userId: string): Promise<ResearchQuery | undefined> {
    const q = this.researchQueries.get(id);
    return q && q.userId === userId ? q : undefined;
  }

  async createResearchQuery(insertQuery: InsertResearchQuery): Promise<ResearchQuery> {
    const id = randomUUID();
    const query: ResearchQuery = {
      id,
      userId: insertQuery.userId,
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

  async getResearchNotes(userId: string): Promise<ResearchNote[]> {
    return Array.from(this.researchNotes.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getResearchNote(id: string, userId: string): Promise<ResearchNote | undefined> {
    const note = this.researchNotes.get(id);
    return note && note.userId === userId ? note : undefined;
  }

  async createResearchNote(insertNote: InsertResearchNote): Promise<ResearchNote> {
    const id = randomUUID();
    const note: ResearchNote = {
      id,
      userId: insertNote.userId,
      name: insertNote.name,
      content: insertNote.content,
      draftId: insertNote.draftId ?? null,
      createdAt: new Date(),
    };
    this.researchNotes.set(id, note);
    return note;
  }

  async updateResearchNote(id: string, userId: string, updates: Partial<{ name: string; content: string }>): Promise<ResearchNote | undefined> {
    const note = this.researchNotes.get(id);
    if (!note || note.userId !== userId) return undefined;
    const updatedNote = { ...note, ...updates };
    this.researchNotes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteResearchNote(id: string, userId: string): Promise<void> {
    const note = this.researchNotes.get(id);
    if (note && note.userId === userId) {
      this.researchNotes.delete(id);
    }
  }

  async getCnrNotes(userId: string): Promise<CnrNote[]> {
    return Array.from(this.cnrNotes.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getCnrNote(id: string, userId: string): Promise<CnrNote | undefined> {
    const note = this.cnrNotes.get(id);
    return note && note.userId === userId ? note : undefined;
  }

  async createCnrNote(note: InsertCnrNote): Promise<CnrNote> {
    const id = randomUUID();
    const now = new Date();
    const newNote: CnrNote = {
      id,
      userId: note.userId,
      title: note.title,
      content: note.content,
      cnrNumber: note.cnrNumber || null,
      createdAt: now,
      updatedAt: now,
    };
    this.cnrNotes.set(id, newNote);
    return newNote;
  }

  async updateCnrNote(id: string, userId: string, updates: Partial<CnrNote>): Promise<CnrNote | undefined> {
    const note = this.cnrNotes.get(id);
    if (!note || note.userId !== userId) return undefined;
    const { userId: _stripped, ...safeUpdates } = updates as CnrNote;
    const updatedNote = { ...note, ...safeUpdates, userId, updatedAt: new Date() };
    this.cnrNotes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteCnrNote(id: string, userId: string): Promise<void> {
    const note = this.cnrNotes.get(id);
    if (note && note.userId === userId) {
      this.cnrNotes.delete(id);
    }
  }

  async getSavedCases(userId: string): Promise<SavedCase[]> {
    return Array.from(this.savedCases.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  async getSavedCase(id: string, userId: string): Promise<SavedCase | undefined> {
    const c = this.savedCases.get(id);
    return c && c.userId === userId ? c : undefined;
  }

  async getSavedCaseByCnr(cnrNumber: string, userId: string): Promise<SavedCase | undefined> {
    return Array.from(this.savedCases.values()).find(
      (c) => c.cnrNumber === cnrNumber && c.userId === userId
    );
  }

  async createSavedCase(savedCase: InsertSavedCase): Promise<SavedCase> {
    const id = randomUUID();
    const newCase: SavedCase = {
      id,
      userId: savedCase.userId,
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

  async deleteSavedCase(id: string, userId: string): Promise<void> {
    const c = this.savedCases.get(id);
    if (c && c.userId === userId) {
      this.savedCases.delete(id);
    }
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
    const [log] = await getDb().insert(auditLogsTable).values({
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

    const query = getDb()
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

export class DatabaseStorage implements IStorage {
  // ── Users ──────────────────────────────────────────────────────────────────
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await getDb().insert(users).values(insertUser).returning();
    return user;
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  async getDocuments(userId: string): Promise<Document[]> {
    return getDb().select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.uploadedAt));
  }

  async getDocument(id: string, userId: string): Promise<Document | undefined> {
    const [doc] = await getDb().select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
    return doc;
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const [doc] = await getDb().insert(documents).values(insertDoc).returning();
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const [doc] = await getDb().update(documents).set(updates).where(eq(documents.id, id)).returning();
    return doc;
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    await getDb().delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  }

  // ── Chat sessions ──────────────────────────────────────────────────────────
  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return getDb().select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.updatedAt));
  }

  async getChatSession(id: string, userId: string): Promise<ChatSession | undefined> {
    const [session] = await getDb().select().from(chatSessions).where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));
    return session;
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const [session] = await getDb().insert(chatSessions).values(insertSession).returning();
    return session;
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const [session] = await getDb().update(chatSessions).set({ ...updates, updatedAt: new Date() }).where(eq(chatSessions.id, id)).returning();
    return session;
  }

  async deleteChatSession(id: string, userId: string): Promise<void> {
    await getDb().delete(chatMessages).where(eq(chatMessages.sessionId, id));
    await getDb().delete(chatSessions).where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));
  }

  // ── Chat messages ──────────────────────────────────────────────────────────
  async getChatMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const [session] = await getDb().select().from(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
    if (!session) return [];
    return getDb().select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(asc(chatMessages.createdAt));
  }

  async createChatMessage(insertMsg: InsertChatMessage): Promise<ChatMessage> {
    const [msg] = await getDb().insert(chatMessages).values(insertMsg).returning();
    return msg;
  }

  // ── Drafts ─────────────────────────────────────────────────────────────────
  async getDrafts(userId: string): Promise<Draft[]> {
    return getDb().select().from(drafts).where(eq(drafts.userId, userId)).orderBy(desc(drafts.updatedAt));
  }

  async getDraft(id: string, userId: string): Promise<Draft | undefined> {
    const [draft] = await getDb().select().from(drafts).where(and(eq(drafts.id, id), eq(drafts.userId, userId)));
    return draft;
  }

  async createDraft(insertDraft: InsertDraft): Promise<Draft> {
    const [draft] = await getDb().insert(drafts).values(insertDraft).returning();
    return draft;
  }

  async updateDraft(id: string, userId: string, updates: Partial<Draft>): Promise<Draft | undefined> {
    const { userId: _stripped, ...safeUpdates } = updates as Draft;
    const [draft] = await getDb().update(drafts).set({ ...safeUpdates, updatedAt: new Date() }).where(and(eq(drafts.id, id), eq(drafts.userId, userId))).returning();
    return draft;
  }

  async deleteDraft(id: string, userId: string): Promise<void> {
    await getDb().delete(drafts).where(and(eq(drafts.id, id), eq(drafts.userId, userId)));
  }

  // ── Cost ledger ────────────────────────────────────────────────────────────
  async getCostLedger(): Promise<CostLedger[]> {
    return getDb().select().from(costLedgerTable).orderBy(desc(costLedgerTable.createdAt));
  }

  async addCostEntry(entry: InsertCostLedger): Promise<CostLedger> {
    const [cost] = await getDb().insert(costLedgerTable).values(entry).returning();
    return cost;
  }

  async getTotalCost(): Promise<number> {
    const [result] = await getDb().select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(costLedgerTable);
    return result?.total ?? 0;
  }

  // ── Training docs ──────────────────────────────────────────────────────────
  async getTrainingDocs(userId?: string): Promise<TrainingDoc[]> {
    if (userId) {
      return getDb().select().from(trainingDocs).where(eq(trainingDocs.userId, userId)).orderBy(desc(trainingDocs.uploadedAt));
    }
    return getDb().select().from(trainingDocs).orderBy(desc(trainingDocs.uploadedAt));
  }

  async getTrainingDoc(id: string): Promise<TrainingDoc | undefined> {
    const [doc] = await getDb().select().from(trainingDocs).where(eq(trainingDocs.id, id));
    return doc;
  }

  async createTrainingDoc(insertDoc: InsertTrainingDoc): Promise<TrainingDoc> {
    const [doc] = await getDb().insert(trainingDocs).values(insertDoc).returning();
    return doc;
  }

  async deleteTrainingDoc(id: string): Promise<void> {
    await getDb().delete(trainingDocs).where(eq(trainingDocs.id, id));
  }

  // ── Legal memos ────────────────────────────────────────────────────────────
  async getLegalMemos(userId: string): Promise<LegalMemo[]> {
    return getDb().select().from(legalMemos).where(eq(legalMemos.userId, userId)).orderBy(desc(legalMemos.updatedAt));
  }

  async getLegalMemo(id: string, userId: string): Promise<LegalMemo | undefined> {
    const [memo] = await getDb().select().from(legalMemos).where(and(eq(legalMemos.id, id), eq(legalMemos.userId, userId)));
    return memo;
  }

  async createLegalMemo(insertMemo: InsertLegalMemo): Promise<LegalMemo> {
    const [memo] = await getDb().insert(legalMemos).values(insertMemo).returning();
    return memo;
  }

  async updateLegalMemo(id: string, updates: Partial<LegalMemo>): Promise<LegalMemo | undefined> {
    const [memo] = await getDb().update(legalMemos).set({ ...updates, updatedAt: new Date() }).where(eq(legalMemos.id, id)).returning();
    return memo;
  }

  async deleteLegalMemo(id: string, userId: string): Promise<void> {
    await getDb().delete(legalMemos).where(and(eq(legalMemos.id, id), eq(legalMemos.userId, userId)));
  }

  // ── Compliance checklists ──────────────────────────────────────────────────
  async getComplianceChecklists(): Promise<ComplianceChecklist[]> {
    return getDb().select().from(complianceChecklists).orderBy(desc(complianceChecklists.updatedAt));
  }

  async getComplianceChecklist(id: string): Promise<ComplianceChecklist | undefined> {
    const [checklist] = await getDb().select().from(complianceChecklists).where(eq(complianceChecklists.id, id));
    return checklist;
  }

  async createComplianceChecklist(insertChecklist: InsertComplianceChecklist): Promise<ComplianceChecklist> {
    const [checklist] = await getDb().insert(complianceChecklists).values(insertChecklist).returning();
    return checklist;
  }

  async updateComplianceChecklist(id: string, updates: Partial<ComplianceChecklist>): Promise<ComplianceChecklist | undefined> {
    const [checklist] = await getDb().update(complianceChecklists).set({ ...updates, updatedAt: new Date() }).where(eq(complianceChecklists.id, id)).returning();
    return checklist;
  }

  async deleteComplianceChecklist(id: string): Promise<void> {
    await getDb().delete(complianceChecklists).where(eq(complianceChecklists.id, id));
  }

  // ── Research queries ───────────────────────────────────────────────────────
  async getResearchQueries(userId: string): Promise<ResearchQuery[]> {
    return getDb().select().from(researchQueries).where(eq(researchQueries.userId, userId)).orderBy(desc(researchQueries.createdAt));
  }

  async getResearchQuery(id: string, userId: string): Promise<ResearchQuery | undefined> {
    const [query] = await getDb().select().from(researchQueries).where(and(eq(researchQueries.id, id), eq(researchQueries.userId, userId)));
    return query;
  }

  async createResearchQuery(insertQuery: InsertResearchQuery): Promise<ResearchQuery> {
    const [query] = await getDb().insert(researchQueries).values(insertQuery).returning();
    return query;
  }

  // ── Research notes ─────────────────────────────────────────────────────────
  async getResearchNotes(userId: string): Promise<ResearchNote[]> {
    return getDb().select().from(researchNotes).where(eq(researchNotes.userId, userId)).orderBy(desc(researchNotes.createdAt));
  }

  async getResearchNote(id: string, userId: string): Promise<ResearchNote | undefined> {
    const [note] = await getDb().select().from(researchNotes).where(and(eq(researchNotes.id, id), eq(researchNotes.userId, userId)));
    return note;
  }

  async createResearchNote(insertNote: InsertResearchNote): Promise<ResearchNote> {
    const [note] = await getDb().insert(researchNotes).values(insertNote).returning();
    return note;
  }

  async updateResearchNote(id: string, userId: string, updates: Partial<{ name: string; content: string }>): Promise<ResearchNote | undefined> {
    const [note] = await getDb().update(researchNotes).set(updates).where(and(eq(researchNotes.id, id), eq(researchNotes.userId, userId))).returning();
    return note;
  }

  async deleteResearchNote(id: string, userId: string): Promise<void> {
    await getDb().delete(researchNotes).where(and(eq(researchNotes.id, id), eq(researchNotes.userId, userId)));
  }

  // ── CNR notes ──────────────────────────────────────────────────────────────
  async getCnrNotes(userId: string): Promise<CnrNote[]> {
    return getDb().select().from(cnrNotes).where(eq(cnrNotes.userId, userId)).orderBy(desc(cnrNotes.updatedAt));
  }

  async getCnrNote(id: string, userId: string): Promise<CnrNote | undefined> {
    const [note] = await getDb().select().from(cnrNotes).where(and(eq(cnrNotes.id, id), eq(cnrNotes.userId, userId)));
    return note;
  }

  async createCnrNote(insertNote: InsertCnrNote): Promise<CnrNote> {
    const [note] = await getDb().insert(cnrNotes).values(insertNote).returning();
    return note;
  }

  async updateCnrNote(id: string, userId: string, updates: Partial<CnrNote>): Promise<CnrNote | undefined> {
    const { userId: _stripped, ...safeUpdates } = updates as CnrNote;
    const [note] = await getDb().update(cnrNotes).set({ ...safeUpdates, updatedAt: new Date() }).where(and(eq(cnrNotes.id, id), eq(cnrNotes.userId, userId))).returning();
    return note;
  }

  async deleteCnrNote(id: string, userId: string): Promise<void> {
    await getDb().delete(cnrNotes).where(and(eq(cnrNotes.id, id), eq(cnrNotes.userId, userId)));
  }

  // ── Saved cases ────────────────────────────────────────────────────────────
  async getSavedCases(userId: string): Promise<SavedCase[]> {
    return getDb().select().from(savedCasesTable).where(eq(savedCasesTable.userId, userId)).orderBy(desc(savedCasesTable.savedAt));
  }

  async getSavedCase(id: string, userId: string): Promise<SavedCase | undefined> {
    const [c] = await getDb().select().from(savedCasesTable).where(and(eq(savedCasesTable.id, id), eq(savedCasesTable.userId, userId)));
    return c;
  }

  async getSavedCaseByCnr(cnrNumber: string, userId: string): Promise<SavedCase | undefined> {
    const [c] = await getDb().select().from(savedCasesTable).where(and(eq(savedCasesTable.cnrNumber, cnrNumber), eq(savedCasesTable.userId, userId)));
    return c;
  }

  async createSavedCase(insertCase: InsertSavedCase): Promise<SavedCase> {
    const [c] = await getDb().insert(savedCasesTable).values(insertCase).returning();
    return c;
  }

  async deleteSavedCase(id: string, userId: string): Promise<void> {
    await getDb().delete(savedCasesTable).where(and(eq(savedCasesTable.id, id), eq(savedCasesTable.userId, userId)));
  }

  // ── Google Calendar credentials ────────────────────────────────────────────
  async getGoogleCalendarCredentials(userId: string): Promise<GoogleCalendarCredentials | undefined> {
    const [creds] = await getDb().select().from(googleCalendarCredentialsTable).where(eq(googleCalendarCredentialsTable.userId, userId));
    return creds;
  }

  async createGoogleCalendarCredentials(insertCreds: InsertGoogleCalendarCredentials): Promise<GoogleCalendarCredentials> {
    const [creds] = await getDb().insert(googleCalendarCredentialsTable).values(insertCreds).returning();
    return creds;
  }

  async updateGoogleCalendarCredentials(userId: string, updates: Partial<GoogleCalendarCredentials>): Promise<GoogleCalendarCredentials | undefined> {
    const [creds] = await getDb().update(googleCalendarCredentialsTable).set({ ...updates, updatedAt: new Date() }).where(eq(googleCalendarCredentialsTable.userId, userId)).returning();
    return creds;
  }

  async deleteGoogleCalendarCredentials(userId: string): Promise<void> {
    await getDb().delete(googleCalendarCredentialsTable).where(eq(googleCalendarCredentialsTable.userId, userId));
  }

  // ── Calendar events ────────────────────────────────────────────────────────
  async getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    return getDb().select().from(calendarEventsTable).where(eq(calendarEventsTable.userId, userId)).orderBy(asc(calendarEventsTable.startTime));
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await getDb().select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    return event;
  }

  async getCalendarEventByGoogleId(googleEventId: string): Promise<CalendarEvent | undefined> {
    const [event] = await getDb().select().from(calendarEventsTable).where(eq(calendarEventsTable.googleEventId, googleEventId));
    return event;
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await getDb().insert(calendarEventsTable).values(insertEvent).returning();
    return event;
  }

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const [event] = await getDb().update(calendarEventsTable).set({ ...updates, updatedAt: new Date() }).where(eq(calendarEventsTable.id, id)).returning();
    return event;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await getDb().delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
  }

  // ── AI usage ───────────────────────────────────────────────────────────────
  async getAIUsage(userId: string, date: string): Promise<AiUsage | undefined> {
    const [usage] = await getDb().select().from(aiUsageTable).where(and(eq(aiUsageTable.userId, userId), eq(aiUsageTable.date, date)));
    return usage;
  }

  async incrementAIUsage(userId: string, date: string): Promise<AiUsage> {
    const [usage] = await getDb()
      .insert(aiUsageTable)
      .values({ userId, date, callCount: 1 })
      .onConflictDoUpdate({
        target: [aiUsageTable.userId, aiUsageTable.date],
        set: { callCount: sql`${aiUsageTable.callCount} + 1` },
      })
      .returning();
    return usage;
  }

  // ── Audit logs ─────────────────────────────────────────────────────────────
  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const [log] = await getDb().insert(auditLogsTable).values({
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

    const query = getDb()
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

export const storage = new DatabaseStorage();
