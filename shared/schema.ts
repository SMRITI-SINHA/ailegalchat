import { pgTable, text, varchar, integer, boolean, timestamp, real, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
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
  storagePath: text("storage_path"),
  storageUrl: text("storage_url"),
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
  userId: varchar("user_id").notNull().default("default-user"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  content: text("content"),
  extractedHtml: text("extracted_html"),
  status: text("status").notNull().default("pending"),
  storagePath: text("storage_path"),
  storageUrl: text("storage_url"),
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

export const savedCases = pgTable("saved_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cnrNumber: text("cnr_number").notNull().unique(),
  caseType: text("case_type"),
  filingNumber: text("filing_number"),
  filingDate: text("filing_date"),
  registrationNumber: text("registration_number"),
  registrationDate: text("registration_date"),
  caseStatus: text("case_status"),
  firstHearingDate: text("first_hearing_date"),
  nextHearingDate: text("next_hearing_date"),
  caseStage: text("case_stage"),
  courtNumberAndJudge: text("court_number_and_judge"),
  petitioners: text("petitioners"),
  respondents: text("respondents"),
  actsAndSections: text("acts_and_sections"),
  caseTransferDetails: text("case_transfer_details"),
  caseHistory: text("case_history"),
  savedAt: timestamp("saved_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSavedCaseSchema = createInsertSchema(savedCases).omit({
  id: true,
  savedAt: true,
});

export type InsertSavedCase = z.infer<typeof insertSavedCaseSchema>;
export type SavedCase = typeof savedCases.$inferSelect;

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

export const embedUsage = pgTable("embed_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorFingerprint: text("visitor_fingerprint").notNull(),
  ipAddress: text("ip_address"),
  usageCount: integer("usage_count").notNull().default(0),
  usageDate: text("usage_date").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type EmbedUsage = typeof embedUsage.$inferSelect;

export const aiUsage = pgTable("ai_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  callCount: integer("call_count").notNull().default(0),
}, (t) => [
  uniqueIndex("ai_usage_user_date_idx").on(t.userId, t.date),
]);

export type AiUsage = typeof aiUsage.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  ipAddress: text("ip_address"),
  success: boolean("success").notNull().default(true),
  errorCode: text("error_code"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const calendarEventTypes = ["academic", "exam", "career", "court", "professional"] as const;
export type CalendarEventType = typeof calendarEventTypes[number];

export const syncStatuses = ["pending", "synced", "failed", "conflict"] as const;
export type SyncStatus = typeof syncStatuses[number];

// Document Type Hierarchy for Indian Legal Practice
export interface DocumentSubSubtype {
  id: string;
  label: string;
}

export interface DocumentSubtype {
  id: string;
  label: string;
  subSubtypes?: DocumentSubSubtype[];
}

export interface DocumentCategory {
  id: string;
  label: string;
  subtypes: DocumentSubtype[];
}

export const documentTypeHierarchy: DocumentCategory[] = [
  {
    id: "civil_litigation",
    label: "Civil Litigation (CPC)",
    subtypes: [
      { id: "plaint", label: "Plaint (Civil Suit)" },
      { id: "written_statement", label: "Written Statement" },
      { id: "replication", label: "Replication / Rejoinder" },
      { id: "interim_application", label: "Interim Application (CPC)" },
      { id: "affidavit_civil", label: "Affidavit" },
      { id: "execution_petition", label: "Execution Petition" },
      { id: "review_revision_civil", label: "Review / Revision Petition" },
      { id: "caveat", label: "Caveat" },
      { id: "misc_application_civil", label: "Miscellaneous Application" },
      { id: "other_civil", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "order_vii_rule_11", label: "Order VII Rule 11" },
        { id: "order_xxxix_rules_1_2", label: "Order XXXIX Rules 1 & 2" },
        { id: "order_vi_rule_17", label: "Order VI Rule 17" },
        { id: "order_xxi_execution", label: "Order XXI (Execution)" },
        { id: "section_151_cpc", label: "Section 151 CPC" },
        { id: "other_cpc", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "criminal_litigation",
    label: "Criminal Litigation (CrPC/BNS)",
    subtypes: [
      { id: "bail_application", label: "Bail Application" },
      { id: "anticipatory_bail", label: "Anticipatory Bail Application" },
      { id: "criminal_complaint", label: "Criminal Complaint" },
      { id: "petition_crpc", label: "Petition (CrPC)" },
      { id: "application_crpc", label: "Application (CrPC)" },
      { id: "affidavit_criminal", label: "Affidavit" },
      { id: "reply_objection_criminal", label: "Reply / Objection" },
      { id: "quashing_petition", label: "Quashing Petition (Section 482)" },
      { id: "revision_appeal_criminal", label: "Revision / Appeal" },
      { id: "other_criminal", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "section_156_3", label: "Section 156(3) CrPC" },
        { id: "section_41a", label: "Section 41A CrPC" },
        { id: "section_438_439", label: "Section 438 / 439" },
        { id: "section_482_crpc", label: "Section 482 CrPC" },
        { id: "ni_act_138", label: "NI Act Section 138" },
        { id: "other_crpc", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "constitutional_writ",
    label: "Constitutional / Writ Jurisdiction",
    subtypes: [
      { id: "writ_petition", label: "Writ Petition" },
      { id: "writ_appeal", label: "Writ Appeal" },
      { id: "slp", label: "Special Leave Petition (SLP)" },
      { id: "review_petition_const", label: "Review Petition" },
      { id: "contempt_petition", label: "Contempt Petition" },
      { id: "other_constitutional", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "article_226", label: "Article 226" },
        { id: "article_32", label: "Article 32" },
        { id: "article_136", label: "Article 136" },
        { id: "service_matter", label: "Service Matter" },
        { id: "tax_matter", label: "Tax Matter" },
        { id: "other_const", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "notices_replies",
    label: "Notices & Replies",
    subtypes: [
      { id: "legal_notice_general", label: "Legal Notice (General)" },
      { id: "legal_notice_cheque", label: "Legal Notice – Cheque Bounce" },
      { id: "demand_notice", label: "Demand Notice" },
      { id: "reply_to_notice", label: "Reply to Legal Notice" },
      { id: "show_cause_reply", label: "Show Cause Reply" },
      { id: "termination_notice", label: "Termination Notice" },
      { id: "arbitration_notice", label: "Arbitration Notice (Section 21)" },
      { id: "other_notice", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "section_138_ni", label: "Section 138 NI Act" },
        { id: "contractual_breach", label: "Contractual Breach" },
        { id: "employment_dispute", label: "Employment Dispute" },
        { id: "property_dispute", label: "Property Dispute" },
        { id: "other_notice_type", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "contracts_commercial",
    label: "Contracts & Commercial",
    subtypes: [
      { id: "employment_agreement", label: "Employment Agreement" },
      { id: "service_agreement", label: "Service Agreement" },
      { id: "nda", label: "NDA" },
      { id: "vendor_supply_agreement", label: "Vendor / Supply Agreement" },
      { id: "shareholders_agreement", label: "Shareholders' Agreement" },
      { id: "partnership_deed", label: "Partnership Deed" },
      { id: "lease_license", label: "Lease / License Agreement" },
      { id: "addendum_amendment", label: "Addendum / Amendment" },
      { id: "termination_agreement", label: "Termination Agreement" },
      { id: "other_contract", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "fixed_term_consultancy", label: "Fixed-term / Consultancy" },
        { id: "exclusivity_clause", label: "Exclusivity Clause" },
        { id: "arbitration_clause", label: "Arbitration Clause" },
        { id: "governing_law_clause", label: "Governing Law Clause" },
        { id: "other_contract_type", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "arbitration",
    label: "Arbitration (A&C Act)",
    subtypes: [
      { id: "notice_arbitration", label: "Notice of Arbitration" },
      { id: "statement_claim", label: "Statement of Claim" },
      { id: "statement_defence", label: "Statement of Defence" },
      { id: "section_9_application", label: "Section 9 Application" },
      { id: "section_11_petition", label: "Section 11 Petition" },
      { id: "section_34_petition", label: "Section 34 Petition" },
      { id: "section_36_application", label: "Section 36 Application" },
      { id: "other_arbitration", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "domestic_arbitration", label: "Domestic Arbitration" },
        { id: "international_commercial", label: "International Commercial Arbitration" },
        { id: "emergency_relief", label: "Emergency Relief" },
        { id: "other_arb_type", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "family_law",
    label: "Family Law",
    subtypes: [
      { id: "divorce_petition", label: "Divorce Petition" },
      { id: "maintenance_application", label: "Maintenance Application" },
      { id: "domestic_violence", label: "Domestic Violence Complaint" },
      { id: "child_custody", label: "Child Custody Petition" },
      { id: "mutual_consent", label: "Mutual Consent Petition" },
      { id: "other_family", label: "Other" },
    ].map(s => ({
      ...s,
      subSubtypes: [
        { id: "section_125_crpc", label: "Section 125 CrPC" },
        { id: "hindu_marriage_act", label: "Hindu Marriage Act" },
        { id: "dv_act", label: "DV Act" },
        { id: "other_family_type", label: "Other (specify)" },
      ]
    }))
  },
  {
    id: "corporate_regulatory",
    label: "Corporate / Regulatory",
    subtypes: [
      { id: "legal_opinion", label: "Legal Opinion" },
      { id: "board_resolution", label: "Board Resolution" },
      { id: "share_transfer", label: "Share Transfer Documents" },
      { id: "due_diligence", label: "Due Diligence Report" },
      { id: "roc_filings", label: "ROC Filings Draft" },
      { id: "sebi_rbi_reply", label: "SEBI / RBI Reply" },
      { id: "other_corporate", label: "Other" },
    ].map(s => ({ ...s, subSubtypes: [] }))
  },
  {
    id: "legal_research",
    label: "Legal Research & Opinions",
    subtypes: [
      { id: "legal_memo", label: "Legal Memo" },
      { id: "case_law_research", label: "Case Law Research" },
      { id: "opinion_note", label: "Opinion Note" },
      { id: "brief_note", label: "Brief Note" },
      { id: "comparative_analysis", label: "Comparative Analysis" },
      { id: "other_research", label: "Other" },
    ].map(s => ({ ...s, subSubtypes: [] }))
  },
  {
    id: "miscellaneous",
    label: "Miscellaneous / Custom",
    subtypes: [
      { id: "custom_document", label: "Custom Document (specify)" },
    ].map(s => ({ ...s, subSubtypes: [] }))
  },
];

export type DocumentTypeSelection = {
  category: string;
  categoryLabel: string;
  subtype: string;
  subtypeLabel: string;
  subSubtype?: string;
  subSubtypeLabel?: string;
  customText?: string;
};

// Pre-Draft Validation Types (Court-Ready Pipeline)
export type JurisdictionType = {
  territorial: string;
  pecuniary?: string;
  subjectMatter?: string;
};

export type PreDraftValidation = {
  documentCategory: "civil" | "criminal" | "constitutional" | "commercial" | "contract" | "notice" | "legal_memo";
  courtForum: string;
  jurisdiction: JurisdictionType;
  limitationStatus?: {
    isChecked: boolean;
    limitationPeriod?: string;
    dateOfCauseOfAction?: string;
    isWithinLimitation?: boolean;
    notes?: string;
  };
  factualSufficiency: {
    isComplete: boolean;
    missingElements?: string[];
  };
  validationWarnings?: string[];
  validationErrors?: string[];
};

// Document DNA - Mandatory Structural Blocks
export const documentDNABlocks = [
  { id: "forum_court", label: "Forum / Court", required: true },
  { id: "parties", label: "Parties & Description", required: true },
  { id: "jurisdiction_maintainability", label: "Jurisdiction & Maintainability", required: true },
  { id: "facts", label: "Facts (Chronological)", required: true },
  { id: "legal_basis", label: "Legal Basis (Statutes First, Then Case Law)", required: true },
  { id: "relief_prayer", label: "Relief / Prayer", required: true },
  { id: "procedural_closure", label: "Procedural Closure (Verification / Signature / Place / Date)", required: true },
] as const;

export type DocumentDNABlock = typeof documentDNABlocks[number];

// Citation Verification Status
export type CitationVerification = {
  citation: string;
  type: "statute" | "case_law";
  isVerified: boolean;
  source?: string;
  court?: string;
  year?: string;
  verificationNotes?: string;
};

// Judge/Registry Simulator Report
export type JudgeSimulatorReport = {
  overallStatus: "pass" | "fail" | "needs_review";
  maintainabilityCheck: {
    status: "pass" | "fail" | "warning";
    notes?: string;
    orderVIIRule11Risk?: boolean;
  };
  jurisdictionConsistency: {
    status: "pass" | "fail" | "warning";
    notes?: string;
  };
  limitationPleading: {
    status: "pass" | "fail" | "warning" | "not_applicable";
    notes?: string;
  };
  reliefEnforceability: {
    status: "pass" | "fail" | "warning";
    notes?: string;
  };
  internalContradictions: {
    status: "pass" | "fail";
    contradictions?: string[];
  };
  recommendations?: string[];
};
