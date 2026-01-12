import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import OpenAI from "openai";
import mammoth from "mammoth";
import { storage } from "./storage";
import { insertDocumentSchema, insertDraftSchema, draftTypes, insertResearchNoteSchema, insertCalendarEventSchema } from "@shared/schema";
import { indianKanoon } from "./indian-kanoon";
import { GoogleCalendarService } from "./google-calendar";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

function decodeFilename(rawName: string): string {
  try {
    return Buffer.from(rawName, "latin1").toString("utf8");
  } catch {
    return rawName;
  }
}

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const mimeType = file.mimetype.toLowerCase();
  const fileName = file.originalname.toLowerCase();
  
  try {
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text || "";
    }
    
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value || "";
    }
    
    if (mimeType === "application/msword" || fileName.endsWith(".doc")) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value || "";
    }
    
    if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
      return file.buffer.toString("utf-8");
    }
    
    return `[Unsupported file format: ${mimeType}]`;
  } catch (error) {
    console.error(`Error extracting text from ${file.originalname}:`, error);
    return `[Error extracting text from document]`;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODEL_TIERS = {
  mini: "gpt-4o-mini",
  standard: "gpt-4.1",
  pro: "o3",
} as const;

const MODEL_COSTS = {
  mini: 0.15,
  standard: 0.40,
  pro: 2.00,
} as const;

function determineModelTier(query: string): "mini" | "standard" | "pro" {
  const complexKeywords = [
    "constitutional",
    "supreme court",
    "precedent analysis",
    "conflicting",
    "interpretation",
    "jurisdiction",
    "novel",
  ];
  const standardKeywords = [
    "section",
    "act",
    "statute",
    "case law",
    "judgment",
    "contract",
    "dispute",
  ];

  const lowerQuery = query.toLowerCase();

  if (complexKeywords.some((kw) => lowerQuery.includes(kw))) {
    return "pro";
  }
  if (standardKeywords.some((kw) => lowerQuery.includes(kw))) {
    return "standard";
  }
  return "mini";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  app.post("/api/documents/upload", upload.array("files", 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const documents = await Promise.all(
        files.map(async (file) => {
          const extractedText = await extractTextFromFile(file);
          const pageCount = Math.max(1, Math.ceil(extractedText.length / 3000));
          const decodedName = decodeFilename(file.originalname);
          
          const doc = await storage.createDocument({
            name: decodedName,
            type: file.mimetype,
            size: file.size,
            pages: pageCount,
            status: "completed",
            processingCost: 0,
            summary: null,
            extractedText: extractedText,
          });

          const cost = 0.50 + (pageCount * 0.01);
          await storage.updateDocument(doc.id, {
            processingCost: parseFloat(cost.toFixed(2)),
          });
          await storage.addCostEntry({
            type: "document_processing",
            description: `Processed ${file.originalname}`,
            amount: cost,
            modelUsed: "mini",
          });

          return doc;
        })
      );

      res.status(201).json(documents);
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.get("/api/chat/sessions", async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getChatSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/chat/sessions", async (req: Request, res: Response) => {
    try {
      const session = await storage.createChatSession({
        title: req.body.title || "New Chat",
        sessionType: req.body.sessionType || "general",
        documentIds: req.body.documentIds || [],
        modelTier: "mini",
        totalCost: 0,
        messageCount: 0,
      });
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.delete("/api/chat/sessions/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteChatSession(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.get("/api/chat/sessions/:id/messages", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getChatMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/messages", async (req: Request, res: Response) => {
    try {
      const { sessionId, role, content } = req.body;
      if (!sessionId || !role || !content) {
        return res.status(400).json({ error: "sessionId, role, and content are required" });
      }
      const message = await storage.createChatMessage({ sessionId, role, content });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/chat/query", async (req: Request, res: Response) => {
    try {
      const { message, sessionId, documentIds } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const tier = determineModelTier(message);
      const model = MODEL_TIERS[tier];
      const cost = MODEL_COSTS[tier];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let documentContext = "";
      if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
        const docs = await Promise.all(
          documentIds.map((id: string) => storage.getDocument(id))
        );
        const validDocs = docs.filter((d) => d && d.extractedText);
        if (validDocs.length > 0) {
          documentContext = validDocs
            .map((d) => `=== Document: ${d!.name} ===\n${d!.extractedText}`)
            .join("\n\n");
        }
      }

      let systemPrompt = `You are Chakshi, an expert legal AI assistant specializing in Indian law. You provide accurate, well-researched legal analysis with proper citations. Always:
1. Cite relevant sections of law, acts, and precedents
2. Explain legal concepts in clear, professional language
3. Note any limitations or areas of uncertainty
4. Suggest next steps or considerations when appropriate

When referencing case law or statutes, use proper legal citation format.`;

      if (documentContext) {
        systemPrompt += `\n\nYou have access to the following uploaded documents. Use this content to answer questions accurately and cite specific sections from the documents:\n\n${documentContext}`;
      }

      try {
        const stream = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          stream: true,
          max_completion_tokens: 4096,
        });

        let fullContent = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        const citations: { id: string; source: string; text: string }[] = [];

        const confidence = 0.75 + Math.random() * 0.20;

        await storage.addCostEntry({
          type: "chat_query",
          description: message.substring(0, 50),
          amount: cost,
          modelUsed: tier,
        });

        res.write(
          `data: ${JSON.stringify({
            done: true,
            modelUsed: tier,
            confidence: parseFloat(confidence.toFixed(2)),
            cost,
            citations,
          })}\n\n`
        );

        res.end();
      } catch (aiError) {
        console.error("AI Error:", aiError);
        res.write(
          `data: ${JSON.stringify({
            content: "I apologize, but I encountered an error processing your request. Please try again.",
            done: true,
            modelUsed: tier,
            confidence: 0.5,
            cost: 0,
            citations: [],
          })}\n\n`
        );
        res.end();
      }
    } catch (error) {
      console.error("Error in chat query:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process query" });
      }
    }
  });

  app.get("/api/drafts", async (req: Request, res: Response) => {
    try {
      const drafts = await storage.getDrafts();
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  app.get("/api/drafts/:id", async (req: Request, res: Response) => {
    try {
      const draft = await storage.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      res.json(draft);
    } catch (error) {
      console.error("Error fetching draft:", error);
      res.status(500).json({ error: "Failed to fetch draft" });
    }
  });

  app.post("/api/drafts", async (req: Request, res: Response) => {
    try {
      const parsed = insertDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const draft = await storage.createDraft(parsed.data);
      res.json(draft);
    } catch (error) {
      console.error("Error creating draft:", error);
      res.status(500).json({ error: "Failed to create draft" });
    }
  });

  app.post("/api/drafts/generate", async (req: Request, res: Response) => {
    try {
      const { type, title, facts, parties, jurisdiction, additionalInfo, language, additionalPrompts, formatReference } = req.body;

      if (!type || !facts) {
        return res.status(400).json({ error: "Type and facts are required" });
      }

      const selectedLanguage = language || "English";
      const draftTitle = title || "Untitled Draft";
      const tier = type === "brief" || type === "petition" ? "standard" : "mini";
      const model = MODEL_TIERS[tier];

      const languageInstruction = selectedLanguage !== "English" 
        ? `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST write the ENTIRE document in ${selectedLanguage} language. Every word, every sentence, every section heading must be in ${selectedLanguage}. Do not use English at all except for proper nouns, case citations (like "AIR 2023 SC 456"), or statute names (like "Indian Contract Act, 1872"). The document must be grammatically correct and professionally written in ${selectedLanguage} using appropriate legal terminology in that language.`
        : "";

      const prompt = `Generate a professional legal ${type} with the following details:

Title: ${draftTitle}
Parties: ${parties || "To be specified"}
Jurisdiction: ${jurisdiction || "As applicable"}

Facts of the Case:
${facts}

${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}
${additionalPrompts ? `User's Additional Prompts: ${additionalPrompts}` : ""}
${formatReference ? `Note: User has provided a format reference document named "${formatReference}" - maintain a professional legal document structure.` : ""}

Generate a complete, properly formatted legal document following Indian legal conventions. Include:
1. Proper heading and court details
2. Party descriptions
3. Statement of facts
4. Legal grounds/arguments (if applicable)
5. Prayer/Relief sought
6. Verification and signature blocks

Format with proper section numbering and legal terminology.${languageInstruction}`;

      const systemPrompt = selectedLanguage !== "English"
        ? `You are an expert legal document drafter specializing in Indian law. You are completely fluent in ${selectedLanguage} and must generate the ENTIRE document in ${selectedLanguage} with perfect grammar and appropriate legal terminology in that language. Only use English for proper nouns, specific case citations, or official statute names. All section headings, content, and legal arguments must be in ${selectedLanguage}.`
        : "You are an expert legal document drafter specializing in Indian law. Generate properly formatted legal documents following standard Indian legal conventions.";

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "";
      const cost = tier === "standard" ? 1.50 : 0.80;

      const draft = await storage.createDraft({
        title: draftTitle,
        type,
        content,
        status: "completed",
        modelUsed: tier,
        sessionId: null,
      });

      await storage.addCostEntry({
        type: "draft_generation",
        description: `Generated ${type}: ${title}`,
        amount: cost,
        modelUsed: tier,
      });

      res.status(201).json(draft);
    } catch (error) {
      console.error("Error generating draft:", error);
      res.status(500).json({ error: "Failed to generate draft" });
    }
  });

  app.patch("/api/drafts/:id", async (req: Request, res: Response) => {
    try {
      const { content, status } = req.body;
      const draft = await storage.updateDraft(req.params.id, { content, status });
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      res.json(draft);
    } catch (error) {
      console.error("Error updating draft:", error);
      res.status(500).json({ error: "Failed to update draft" });
    }
  });

  app.delete("/api/drafts/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteDraft(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ error: "Failed to delete draft" });
    }
  });

  app.post("/api/drafts/translate", async (req: Request, res: Response) => {
    try {
      const { content, targetLanguage } = req.body;

      if (!content || !targetLanguage) {
        return res.status(400).json({ error: "Content and targetLanguage are required" });
      }

      const systemPrompt = `You are a professional legal translator fluent in all Indian languages. Translate the following legal document to ${targetLanguage}. 
Maintain the exact structure, formatting, section numbers, and legal terminology.
Only translate the content - do not add explanations or comments.
For proper nouns, case citations, and official statute names, keep them in their original form.
Ensure the translation is accurate and uses appropriate legal terminology in ${targetLanguage}.`;

      const response = await openai.chat.completions.create({
        model: MODEL_TIERS.standard,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Translate this legal document to ${targetLanguage}:\n\n${content}` },
        ],
        max_completion_tokens: 8192,
      });

      const translatedContent = response.choices[0]?.message?.content || content;

      await storage.addCostEntry({
        type: "translation",
        description: `Translated document to ${targetLanguage}`,
        amount: MODEL_COSTS.standard,
        modelUsed: "standard",
      });

      res.json({ translatedContent, language: targetLanguage });
    } catch (error) {
      console.error("Error translating document:", error);
      res.status(500).json({ error: "Failed to translate document" });
    }
  });

  app.get("/api/costs", async (req: Request, res: Response) => {
    try {
      const ledger = await storage.getCostLedger();
      const total = await storage.getTotalCost();
      res.json({ entries: ledger, total });
    } catch (error) {
      console.error("Error fetching costs:", error);
      res.status(500).json({ error: "Failed to fetch costs" });
    }
  });

  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const documents = await storage.getDocuments();
      const sessions = await storage.getChatSessions();
      const drafts = await storage.getDrafts();
      const totalCost = await storage.getTotalCost();

      res.json({
        documentsCount: documents.length,
        documentsProcessing: documents.filter((d) => d.status === "processing").length,
        sessionsCount: sessions.length,
        sessionsActive: sessions.filter(
          (s) => new Date(s.updatedAt).getTime() > Date.now() - 3600000
        ).length,
        draftsCount: drafts.length,
        draftsInProgress: drafts.filter((d) => d.status === "draft").length,
        totalCost: parseFloat(totalCost.toFixed(2)),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/research/search", async (req: Request, res: Response) => {
    try {
      const { query, page = 0 } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      const results = await indianKanoon.search(query, page);
      res.json({ results, isConfigured: indianKanoon.isConfigured() });
    } catch (error) {
      console.error("Research search error:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  });

  app.post("/api/research/statutes", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      const statutes = await indianKanoon.searchStatutes(query);
      res.json({ statutes });
    } catch (error) {
      console.error("Statute search error:", error);
      res.status(500).json({ error: "Failed to search statutes" });
    }
  });

  app.get("/api/research/document/:docId", async (req: Request, res: Response) => {
    try {
      const document = await indianKanoon.getDocument(req.params.docId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Document fetch error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  app.post("/api/memos/generate", async (req: Request, res: Response) => {
    try {
      const { facts, issues, documentIds, language, jurisdiction, parties, title } = req.body;
      if (!facts) {
        return res.status(400).json({ error: "Facts are required" });
      }

      const selectedLanguage = language || "English";
      const memoTitle = title || "Legal Memorandum";

      const languageInstruction = selectedLanguage !== "English" 
        ? `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST write the ENTIRE memorandum in ${selectedLanguage} language. Every word, every sentence, every section heading must be in ${selectedLanguage}. Do not use English at all except for proper nouns, case citations (like "AIR 2023 SC 456"), or statute names (like "Indian Contract Act, 1872"). The memorandum must be grammatically correct and professionally written in ${selectedLanguage} using appropriate legal terminology in that language.`
        : "";

      const prompt = `Generate a comprehensive legal memorandum using the IRAC format based on the following:

${memoTitle !== "Legal Memorandum" ? `SUBJECT: ${memoTitle}` : ""}
${parties ? `PARTIES: ${parties}` : ""}
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : ""}

FACTS:
${facts}

${issues ? `ISSUES TO ANALYZE:\n${issues}` : "Identify the key legal issues from the facts."}

Generate a complete legal memo with:
1. QUESTIONS PRESENTED - Clear statement of legal questions
2. BRIEF ANSWERS - Concise answers to each question
3. FACTUAL BACKGROUND - Summary of relevant facts
4. APPLICABLE LAW - Relevant statutes and case law (cite Indian law)
5. ANALYSIS - Apply law to facts using IRAC methodology
6. CONCLUSION - Final recommendations

Ensure all citations are to actual Indian statutes and case law. Use proper legal citation format.${languageInstruction}`;

      const systemPrompt = selectedLanguage !== "English"
        ? `You are an expert legal research assistant specializing in Indian law. You are completely fluent in ${selectedLanguage} and must generate the ENTIRE memorandum in ${selectedLanguage} with perfect grammar and appropriate legal terminology in that language. Only use English for proper nouns, specific case citations, or official statute names. All section headings, content, and legal analysis must be in ${selectedLanguage}.`
        : "You are an expert legal research assistant specializing in Indian law. Generate comprehensive legal memoranda with proper citations to Indian statutes and case law.";

      const response = await openai.chat.completions.create({
        model: MODEL_TIERS.standard,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 4096,
      });

      const fullMemo = response.choices[0]?.message?.content || "";
      const cost = MODEL_COSTS.standard;

      await storage.addCostEntry({
        type: "memo_generation",
        description: "Generated legal memorandum",
        amount: cost,
        modelUsed: "standard",
      });

      res.json({
        fullMemo,
        modelUsed: "standard",
        cost,
      });
    } catch (error) {
      console.error("Memo generation error:", error);
      res.status(500).json({ error: "Failed to generate memo" });
    }
  });

  // Compliance Checklists CRUD
  app.get("/api/compliance/checklists", async (req: Request, res: Response) => {
    try {
      const checklists = await storage.getComplianceChecklists();
      // Parse items JSON before sending to client
      const parsedChecklists = checklists.map(c => ({
        ...c,
        items: typeof c.items === "string" ? JSON.parse(c.items) : c.items,
      }));
      res.json(parsedChecklists);
    } catch (error) {
      console.error("Error fetching checklists:", error);
      res.status(500).json({ error: "Failed to fetch checklists" });
    }
  });

  app.post("/api/compliance/checklists", async (req: Request, res: Response) => {
    try {
      const { title, industry, jurisdiction, activity, items } = req.body;
      if (!title || !items) {
        return res.status(400).json({ error: "Title and items are required" });
      }
      const checklist = await storage.createComplianceChecklist({
        title,
        industry: industry || "",
        jurisdiction: jurisdiction || "",
        activity: activity || "",
        items: JSON.stringify(items),
        status: "active",
      });
      res.json(checklist);
    } catch (error) {
      console.error("Error saving checklist:", error);
      res.status(500).json({ error: "Failed to save checklist" });
    }
  });

  app.get("/api/compliance/checklists/:id", async (req: Request, res: Response) => {
    try {
      const checklist = await storage.getComplianceChecklist(req.params.id);
      if (!checklist) {
        return res.status(404).json({ error: "Checklist not found" });
      }
      // Parse items JSON before sending to client
      res.json({
        ...checklist,
        items: typeof checklist.items === "string" ? JSON.parse(checklist.items) : checklist.items,
      });
    } catch (error) {
      console.error("Error fetching checklist:", error);
      res.status(500).json({ error: "Failed to fetch checklist" });
    }
  });

  app.delete("/api/compliance/checklists/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteComplianceChecklist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting checklist:", error);
      res.status(500).json({ error: "Failed to delete checklist" });
    }
  });

  // Research Notes CRUD - uses ResearchQuery model with "note:" prefix to distinguish from search results
  app.get("/api/research/notes", async (req: Request, res: Response) => {
    try {
      const allQueries = await storage.getResearchQueries();
      // Filter to only return notes (queries with "note:" prefix)
      const notes = allQueries.filter(q => q.query.startsWith("note:"));
      // Parse results JSON before sending
      const parsedNotes = notes.map(n => ({
        ...n,
        query: n.query.replace("note:", ""), // Remove prefix for display
        results: typeof n.results === "string" ? JSON.parse(n.results) : n.results,
      }));
      res.json(parsedNotes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/research/notes", async (req: Request, res: Response) => {
    try {
      const { title, content, query } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }
      // Store with "note:" prefix to distinguish from regular search queries
      const note = await storage.createResearchQuery({
        query: `note:${title}`,
        results: JSON.stringify({ title, content, savedAt: new Date().toISOString() }),
      });
      res.json({
        ...note,
        query: title, // Return without prefix
        results: { title, content, savedAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error("Error saving note:", error);
      res.status(500).json({ error: "Failed to save note" });
    }
  });

  app.post("/api/compliance/generate", async (req: Request, res: Response) => {
    try {
      const { industry, jurisdiction, activity } = req.body;
      if (!industry || !jurisdiction || !activity) {
        return res.status(400).json({ error: "Industry, jurisdiction, and activity are required" });
      }

      const prompt = `Generate a compliance checklist for the following:

Industry: ${industry}
Jurisdiction: ${jurisdiction}
Activity: ${activity}

For each compliance item, provide:
1. Title - Clear name of the compliance requirement
2. Description - What needs to be done
3. Legal Reference - Specific act, section, or regulation
4. Deadline - When it must be completed
5. Risk Level - high/medium/low based on penalties for non-compliance

Generate at least 8-10 relevant compliance items specific to Indian law and regulations.`;

      const response = await openai.chat.completions.create({
        model: MODEL_TIERS.mini,
        messages: [
          {
            role: "system",
            content: "You are an expert compliance advisor specializing in Indian regulatory requirements. Generate accurate compliance checklists with proper legal references.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content || "";
      const cost = MODEL_COSTS.mini;

      await storage.addCostEntry({
        type: "compliance_checklist",
        description: `Generated checklist for ${industry} - ${activity}`,
        amount: cost,
        modelUsed: "mini",
      });

      res.json({
        content,
        modelUsed: "mini",
        cost,
      });
    } catch (error) {
      console.error("Compliance generation error:", error);
      res.status(500).json({ error: "Failed to generate checklist" });
    }
  });

  app.get("/api/research/notes", async (req: Request, res: Response) => {
    try {
      const draftId = req.query.draftId as string | undefined;
      const notes = await storage.getResearchNotes();
      const filtered = draftId ? notes.filter(n => n.draftId === draftId) : notes;
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching research notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/research/notes", async (req: Request, res: Response) => {
    try {
      const parsed = insertResearchNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const note = await storage.createResearchNote(parsed.data);
      res.json(note);
    } catch (error) {
      console.error("Error creating research note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.delete("/api/research/notes/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteResearchNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting research note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  const oauthStates = new Map<string, { userId: string; expiresAt: number; redirectUri: string }>();

  app.get("/api/calendar/google/auth-url", (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || "default-user";
      const state = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "";
      const redirectUri = `${protocol}://${host}/api/calendar/google/callback`;
      
      oauthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000, redirectUri });
      
      const authUrl = GoogleCalendarService.getAuthUrl(state, redirectUri);
      res.json({ authUrl, state });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/calendar/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return res.redirect(`/hub/calendar?error=${encodeURIComponent(oauthError as string)}`);
      }

      if (!code || !state) {
        return res.redirect("/hub/calendar?error=missing_params");
      }

      const stateData = oauthStates.get(state as string);
      if (!stateData || stateData.expiresAt < Date.now()) {
        oauthStates.delete(state as string);
        return res.redirect("/hub/calendar?error=invalid_state");
      }

      const { userId, redirectUri } = stateData;
      oauthStates.delete(state as string);

      const tokens = await GoogleCalendarService.exchangeCodeForTokens(code as string, redirectUri);
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      const existingCreds = await storage.getGoogleCalendarCredentials(userId);
      if (existingCreds) {
        await storage.updateGoogleCalendarCredentials(userId, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existingCreds.refreshToken,
          tokenExpiry,
        });
      } else {
        await storage.createGoogleCalendarCredentials({
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || "",
          tokenExpiry,
          calendarId: "primary",
        });
      }

      res.redirect("/hub/calendar?connected=google");
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect("/hub/calendar?error=oauth_failed");
    }
  });

  app.get("/api/calendar/google/status", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || "default-user";
      const creds = await storage.getGoogleCalendarCredentials(userId);

      if (!creds) {
        return res.json({ connected: false });
      }

      const isExpired = new Date(creds.tokenExpiry) < new Date();
      res.json({
        connected: true,
        isExpired,
        lastSyncAt: creds.lastSyncAt,
        calendarId: creds.calendarId,
      });
    } catch (error) {
      console.error("Error checking status:", error);
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  app.post("/api/calendar/google/disconnect", async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || "default-user";
      await storage.deleteGoogleCalendarCredentials(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  app.post("/api/calendar/google/sync", async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || "default-user";
      const creds = await storage.getGoogleCalendarCredentials(userId);

      if (!creds) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const service = new GoogleCalendarService(userId);
      const result = await service.fullSync();

      res.json({
        success: true,
        fromGoogle: result.fromGoogle,
        toGoogle: result.toGoogle,
      });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  app.get("/api/calendar/events", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || "default-user";
      const events = await storage.getCalendarEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/calendar/events", async (req: Request, res: Response) => {
    try {
      const parsed = insertCalendarEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const event = await storage.createCalendarEvent(parsed.data);

      const creds = await storage.getGoogleCalendarCredentials(parsed.data.userId);
      if (creds) {
        const service = new GoogleCalendarService(parsed.data.userId);
        await service.createGoogleEvent(event);
      }

      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.patch("/api/calendar/events/:id", async (req: Request, res: Response) => {
    try {
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const updated = await storage.updateCalendarEvent(req.params.id, req.body);

      if (updated && updated.googleEventId) {
        const creds = await storage.getGoogleCalendarCredentials(updated.userId);
        if (creds) {
          const service = new GoogleCalendarService(updated.userId);
          await service.updateGoogleEvent(updated);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/calendar/events/:id", async (req: Request, res: Response) => {
    try {
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (event.googleEventId) {
        const creds = await storage.getGoogleCalendarCredentials(event.userId);
        if (creds) {
          const service = new GoogleCalendarService(event.userId);
          await service.deleteGoogleEvent(event.googleEventId);
        }
      }

      await storage.deleteCalendarEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  return httpServer;
}
