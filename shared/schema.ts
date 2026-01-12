import { pgTable, text, varchar, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  pages: integer("pages").default(0),
  status: text("status").notNull().default("pending"),
  processingCost: real("processing_cost").default(0),
  summary: text("summary"),
  extractedText: text("extracted_text"),
  extractedHtml: text("extracted_html"),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sessionType: text("session_type").default("general"),
  documentIds: text("document_ids").array(),
  parentSessionId: varchar("parent_session_id"),
  modelTier: text("model_tier").default("mini"),
  totalCost: real("total_cost").default(0),
  messageCount: integer("message_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  modelUsed: text("model_used"),
  confidence: real("confidence"),
  cost: real("cost").default(0),
  citations: text("citations"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const drafts = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  status: text("status").notNull().default("draft"),
  modelUsed: text("model_used"),
  language: text("language").default("English"),
  useFirmStyle: boolean("use_firm_style").default(false),
  sessionId: varchar("session_id"),
  referenceDocIds: text("reference_doc_ids").array(),
  riskAnalysis: text("risk_analysis"),
  grammarErrors: text("grammar_errors"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDraftSchema = createInsertSchema(drafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof drafts.$inferSelect;

export const trainingDocs = pgTable("training_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  content: text("content"),
  status: text("status").notNull().default("pending"),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTrainingDocSchema = createInsertSchema(trainingDocs).omit({
  id: true,
  uploadedAt: true,
});

export type InsertTrainingDoc = z.infer<typeof insertTrainingDocSchema>;
export type TrainingDoc = typeof trainingDocs.$inferSelect;

export const legalMemos = pgTable("legal_memos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  facts: text("facts").notNull(),
  issues: text("issues"),
  applicableLaw: text("applicable_law"),
  analysis: text("analysis"),
  conclusion: text("conclusion"),
  sources: text("sources"),
  fullMemo: text("full_memo"),
  status: text("status").notNull().default("draft"),
  modelUsed: text("model_used"),
  documentIds: text("document_ids").array(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLegalMemoSchema = createInsertSchema(legalMemos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLegalMemo = z.infer<typeof insertLegalMemoSchema>;
export type LegalMemo = typeof legalMemos.$inferSelect;

export const complianceChecklists = pgTable("compliance_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  industry: text("industry").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  activity: text("activity").notNull(),
  items: text("items"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertComplianceChecklistSchema = createInsertSchema(complianceChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComplianceChecklist = z.infer<typeof insertComplianceChecklistSchema>;
export type ComplianceChecklist = typeof complianceChecklists.$inferSelect;

export const researchQueries = pgTable("research_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  results: text("results"),
  legalDomain: text("legal_domain"),
  statutes: text("statutes"),
  caseLaw: text("case_law"),
  analysis: text("analysis"),
  sources: text("sources"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertResearchQuerySchema = createInsertSchema(researchQueries).omit({
  id: true,
  createdAt: true,
});

export type InsertResearchQuery = z.infer<typeof insertResearchQuerySchema>;
export type ResearchQuery = typeof researchQueries.$inferSelect;

export const costLedger = pgTable("cost_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  modelUsed: text("model_used"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCostLedgerSchema = createInsertSchema(costLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertCostLedger = z.infer<typeof insertCostLedgerSchema>;
export type CostLedger = typeof costLedger.$inferSelect;

export const draftTypes = [
  "petition",
  "written_statement",
  "notice",
  "contract",
  "brief",
  "application",
  "reply",
  "affidavit",
  "memo",
  "agreement",
  "power_of_attorney",
  "deed",
  "will",
  "mou",
  "nda",
] as const;

export type DraftType = typeof draftTypes[number];

export const modelTiers = ["mini", "standard", "pro"] as const;
export type ModelTier = typeof modelTiers[number];

export const documentStatuses = ["pending", "processing", "completed", "failed"] as const;
export type DocumentStatus = typeof documentStatuses[number];

export const sessionTypes = ["general", "research", "chatwithpdf", "nyaya"] as const;
export type SessionType = typeof sessionTypes[number];

export const indianLanguages = [
  "English",
  "Hindi",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Telugu",
  "Tamil",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Odia",
  "Assamese",
  "Bhojpuri",
  "Rajasthani",
  "Kashmiri",
  "Konkani",
  "Manipuri",
  "Sanskrit",
  "Urdu",
  "Sindhi",
  "Nepali",
  "Dogri",
] as const;

export type IndianLanguage = typeof indianLanguages[number];

export interface IndianKanoonResult {
  docId: string;
  title: string;
  headline?: string;
  docSize?: number;
  court?: string;
  date?: string;
}

export interface LegalProvision {
  id: string;
  source: string;
  section: string;
  text: string;
  isNewLaw: boolean;
}

export interface Citation {
  id: string;
  source: string;
  text: string;
  page?: number;
  confidence?: number;
  url?: string;
}

export interface RiskItem {
  id: string;
  text: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
  startIndex: number;
  endIndex: number;
}

export interface GrammarError {
  id: string;
  text: string;
  correction: string;
  startIndex: number;
  endIndex: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  legalReference?: string;
  deadline?: string;
  riskLevel: "low" | "medium" | "high";
  completed: boolean;
  notes?: string;
  proofUploaded?: boolean;
}

export const researchNotes = pgTable("research_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  content: text("content").notNull(),
  draftId: varchar("draft_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertResearchNoteSchema = createInsertSchema(researchNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertResearchNote = z.infer<typeof insertResearchNoteSchema>;
export type ResearchNote = typeof researchNotes.$inferSelect;

export const cnrNotes = pgTable("cnr_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  cnrNumber: text("cnr_number"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCnrNoteSchema = createInsertSchema(cnrNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCnrNote = z.infer<typeof insertCnrNoteSchema>;
export type CnrNote = typeof cnrNotes.$inferSelect;

export const googleCalendarCredentials = pgTable("google_calendar_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  calendarId: text("calendar_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry").notNull(),
  syncToken: text("sync_token"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGoogleCalendarCredentialsSchema = createInsertSchema(googleCalendarCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGoogleCalendarCredentials = z.infer<typeof insertGoogleCalendarCredentialsSchema>;
export type GoogleCalendarCredentials = typeof googleCalendarCredentials.$inferSelect;

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: text("type").notNull().default("professional"),
  isHighPriority: boolean("is_high_priority").default(false),
  googleEventId: text("google_event_id"),
  syncStatus: text("sync_status").default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export const calendarEventTypes = ["academic", "exam", "career", "court", "professional"] as const;
export type CalendarEventType = typeof calendarEventTypes[number];

export const syncStatuses = ["pending", "synced", "failed", "conflict"] as const;
export type SyncStatus = typeof syncStatuses[number];
