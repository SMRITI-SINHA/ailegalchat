import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import OpenAI from "openai";
import mammoth from "mammoth";
import sanitizeHtmlLib from "sanitize-html";
// pdf-parse loaded dynamically to avoid bundling browser dependencies
let PDFParseClass: any;
async function getPDFParseClass() {
  if (!PDFParseClass) {
    const module = await import("pdf-parse") as any;
    PDFParseClass = module.PDFParse;
  }
  return PDFParseClass;
}
import { storage } from "./storage";
import { insertDocumentSchema, insertDraftSchema, draftTypes, insertResearchNoteSchema, insertCalendarEventSchema, insertCnrNoteSchema, insertSavedCaseSchema, savedCases, embedUsage } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { indianKanoon } from "./indian-kanoon";
import { legalWebSearch } from "./legal-web-search";
import { GoogleCalendarService } from "./google-calendar";
import { trainingDataLoader } from "./training-data-loader";
import { inLegalBERT } from "./huggingface";
import { transcribeAudio as elevenLabsTranscribe, getUncachableElevenLabsClient, DEFAULT_VOICE_ID, TTS_MODEL } from "./elevenlabs";

function decodeFilename(rawName: string): string {
  try {
    return Buffer.from(rawName, "latin1").toString("utf8");
  } catch {
    return rawName;
  }
}

// Escape HTML entities
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sanitize HTML using sanitize-html library for proper XSS protection
function sanitizeHtml(html: string): string {
  // Use sanitize-html with whitelist of safe tags for legal documents
  let sanitized = sanitizeHtmlLib(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                   'ul', 'ol', 'li', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr'],
    allowedAttributes: {
      'p': ['style'],
      'div': ['style'],
      'span': ['style'],
      'td': ['style', 'colspan', 'rowspan'],
      'th': ['style', 'colspan', 'rowspan'],
    },
    allowedStyles: {
      '*': {
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        'font-weight': [/^bold$/, /^normal$/],
      }
    },
    disallowedTagsMode: 'discard',
  });
  
  // Remove page markers
  sanitized = sanitized
    .replace(/—\s*\d+\s*(of|\/)\s*\d+\s*—/gi, '')
    .replace(/>Page\s+\d+</gi, '><');
  
  return sanitized;
}

// Convert plain text to structured HTML preserving legal document formatting
function textToLegalHtml(text: string): string {
  // Remove page markers like "— 1 of 6 —" or "Page 1" etc.
  let cleaned = text
    .replace(/—\s*\d+\s*(of|\/)\s*\d+\s*—/gi, '')
    .replace(/^\s*Page\s+\d+\s*$/gmi, '')
    .replace(/^\s*-\s*\d+\s*-\s*$/gm, '')
    .replace(/^\s*\d+\s*$/gm, ''); // Remove standalone page numbers
  
  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into lines for processing
  const lines = cleaned.split('\n');
  const htmlParts: string[] = [];
  let i = 0;
  
  // Detect if a line starts a numbered clause or lettered sub-clause
  // Covers: 1., 2), (1), 1.1, 1.1.1, 2.3.4, I., II., (i), (a), a., A., bullets, etc.
  const isNumberedClause = (line: string) => /^\d+[\.\)]\s+/.test(line) || /^\(\d+\)\s+/.test(line);
  // Multi-level decimal: 1.1, 1.1.1, 2.3.4.5, etc. - uses (?:\d+\.)+ to match any depth
  const isDecimalNumbered = (line: string) => /^(?:\d+\.)+\d*[\.)]?\s+/.test(line);
  const isRomanClause = (line: string) => /^[IVXLCDM]+[\.\)]\s+/i.test(line) || /^\([ivxlcdm]+\)\s+/i.test(line);
  const isLetteredClause = (line: string) => /^\([a-z]\)\s+/i.test(line) || /^[a-z][\.\)]\s+/i.test(line);
  const isBulletClause = (line: string) => /^[\-\*\•]\s+/.test(line);
  const isSubClause = (line: string) => 
    isNumberedClause(line) || 
    isDecimalNumbered(line) || 
    isRomanClause(line) || 
    isLetteredClause(line) ||
    isBulletClause(line);
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Empty line - preserve as spacing
    if (trimmedLine === '') {
      htmlParts.push('<p>&nbsp;</p>');
      i++;
      continue;
    }
    
    // Detect centered content (court titles, "Versus", etc.)
    const isCentered = (
      /^(IN THE|BEFORE THE|HON'?BLE|COURT OF|VERSUS|Vs\.?|V\/s\.?|SCHEDULE|ANNEXURE)/i.test(trimmedLine) ||
      /^O\.?S\.?\s*No\.|^W\.?P\.?\s*No\.|^C\.?A\.?\s*No\.|^S\.?L\.?P\.?\s*No\./i.test(trimmedLine) ||
      /^(JOINT|COMPROMISE|MEMO|PETITION|APPLICATION|AFFIDAVIT|REPLY|WRITTEN STATEMENT|PRAYER|RELIEF)/i.test(trimmedLine)
    );
    
    // Detect headings (ALL CAPS lines that are likely section headers)
    const isHeading = /^[A-Z][A-Z\s\-:\.]+$/.test(trimmedLine) && 
                      trimmedLine.length > 8 && 
                      trimmedLine.length < 80 &&
                      !isSubClause(trimmedLine);
    
    // Detect party alignment markers (…Plaintiff, ...Defendant)
    const isRightAligned = /^\.{2,}(Plaintiff|Defendant|Petitioner|Respondent|Appellant|Complainant)/i.test(trimmedLine) ||
                           /^…+(Plaintiff|Defendant|Petitioner|Respondent|Appellant|Complainant)/i.test(trimmedLine);
    
    // Build the line with proper formatting
    let htmlLine = escapeHtml(trimmedLine);
    
    if (isHeading) {
      htmlLine = `<p style="text-align:center"><strong>${htmlLine}</strong></p>`;
      i++;
    } else if (isCentered) {
      htmlLine = `<p style="text-align:center">${htmlLine}</p>`;
      i++;
    } else if (isRightAligned) {
      htmlLine = `<p style="text-align:right">${htmlLine}</p>`;
      i++;
    } else if (isSubClause(trimmedLine)) {
      // Numbered/lettered clauses - each becomes its own paragraph
      // But continuation lines (non-clause, non-empty) should be grouped with <br/>
      let blockLines = [htmlLine];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        // If next line is empty, we've hit a paragraph break
        if (nextTrimmed === '') break;
        // If next line is a new clause, break to make it its own paragraph
        if (isSubClause(nextTrimmed)) break;
        // If next line looks like a centered section, break
        if (/^(IN THE|VERSUS|SCHEDULE|Dated|PRAYER|RELIEF)/i.test(nextTrimmed)) break;
        
        i++;
        blockLines.push(escapeHtml(nextTrimmed));
      }
      htmlLine = `<p>${blockLines.join('<br/>')}</p>`;
      i++;
    } else {
      // Regular paragraph - group consecutive lines until blank line or new section
      let blockLines = [htmlLine];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        // If next line is empty, we've hit a paragraph break
        if (nextTrimmed === '') break;
        // If next line is a new clause, break
        if (isSubClause(nextTrimmed)) break;
        // If next line looks like a new section, break
        if (/^(IN THE|BEFORE|VERSUS|SCHEDULE|JOINT|Dated|PRAYER|RELIEF)/i.test(nextTrimmed)) break;
        // If next line is right-aligned, break
        if (/^\.{2,}|^…+/.test(nextTrimmed)) break;
        
        i++;
        blockLines.push(escapeHtml(nextTrimmed));
      }
      htmlLine = `<p>${blockLines.join('<br/>')}</p>`;
      i++;
    }
    
    htmlParts.push(htmlLine);
  }
  
  return htmlParts.join('\n');
}

// Extract formatting patterns from HTML to help AI understand document structure
function extractFormatPatterns(html: string): string {
  const patterns: string[] = [];
  
  // Detect heading styles
  const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi);
  const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi);
  const h3Matches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi);
  
  if (h1Matches) patterns.push(`- Main Headings (H1): ${h1Matches.length} found. Example: "${h1Matches[0]?.replace(/<[^>]*>/g, '').substring(0, 50)}"`);
  if (h2Matches) patterns.push(`- Section Headings (H2): ${h2Matches.length} found. Example: "${h2Matches[0]?.replace(/<[^>]*>/g, '').substring(0, 50)}"`);
  if (h3Matches) patterns.push(`- Sub-section Headings (H3): ${h3Matches.length} found. Example: "${h3Matches[0]?.replace(/<[^>]*>/g, '').substring(0, 50)}"`);
  
  // Detect numbering patterns
  const romanNumerals = html.match(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\s/g);
  const arabicNumerals = html.match(/\b(\d+)\.\s+[A-Z]/g);
  const letterNumbering = html.match(/\([a-z]\)/g);
  const subClauseNumbering = html.match(/\(\d+\)/g);
  
  if (romanNumerals) patterns.push(`- Roman Numeral Sections: Yes (${romanNumerals.length} instances)`);
  if (arabicNumerals) patterns.push(`- Arabic Numeral Sections: Yes (${arabicNumerals.length} instances)`);
  if (letterNumbering) patterns.push(`- Letter Sub-clauses (a), (b), (c): Yes (${letterNumbering.length} instances)`);
  if (subClauseNumbering) patterns.push(`- Numeric Sub-clauses (1), (2), (3): Yes (${subClauseNumbering.length} instances)`);
  
  // Detect legal terminology patterns
  const whereas = html.match(/WHEREAS/gi);
  const nowTherefore = html.match(/NOW\s+THEREFORE/gi);
  const schedule = html.match(/SCHEDULE/gi);
  const witnesseth = html.match(/WITNESSETH/gi);
  const recitals = html.match(/RECITALS?/gi);
  const definitions = html.match(/DEFINITION|INTERPRETATION/gi);
  
  if (whereas) patterns.push(`- "WHEREAS" clauses: ${whereas.length} instances`);
  if (nowTherefore) patterns.push(`- "NOW THEREFORE" clause: Present`);
  if (witnesseth) patterns.push(`- "WITNESSETH" clause: Present`);
  if (recitals) patterns.push(`- Recitals section: Present`);
  if (definitions) patterns.push(`- Definitions/Interpretation section: Present`);
  if (schedule) patterns.push(`- Schedule sections: ${schedule.length} instances`);
  
  // Detect list structures
  const orderedLists = html.match(/<ol[^>]*>/gi);
  const unorderedLists = html.match(/<ul[^>]*>/gi);
  const tables = html.match(/<table[^>]*>/gi);
  
  if (orderedLists) patterns.push(`- Ordered Lists: ${orderedLists.length} found`);
  if (unorderedLists) patterns.push(`- Bullet Lists: ${unorderedLists.length} found`);
  if (tables) patterns.push(`- Tables: ${tables.length} found`);
  
  // Detect paragraph count and structure
  const paragraphs = html.match(/<p[^>]*>/gi);
  if (paragraphs) patterns.push(`- Paragraphs: ${paragraphs.length} found`);
  
  // Detect strong/emphasis patterns
  const boldText = html.match(/<strong[^>]*>([^<]+)<\/strong>/gi);
  if (boldText) patterns.push(`- Bold/Strong text: ${boldText.length} instances for emphasis`);
  
  // Extract first few section headers to show structure
  const allHeadings = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi) || [];
  if (allHeadings.length > 0) {
    patterns.push(`\nDOCUMENT SECTION STRUCTURE:`);
    allHeadings.slice(0, 10).forEach((heading, idx) => {
      const text = heading.replace(/<[^>]*>/g, '').trim();
      patterns.push(`  ${idx + 1}. ${text}`);
    });
  }
  
  return patterns.length > 0 ? patterns.join('\n') : "Standard document format detected.";
}

async function extractTextFromFile(file: Express.Multer.File): Promise<{ text: string; html: string }> {
  const mimeType = file.mimetype.toLowerCase();
  const fileName = file.originalname.toLowerCase();
  
  try {
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const PDFParse = await getPDFParseClass();
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      const text = result.text || "";
      return { text, html: textToLegalHtml(text) };
    }
    
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        fileName.endsWith(".docx")) {
      // Use convertToHtml to preserve document structure
      const htmlResult = await mammoth.convertToHtml({ buffer: file.buffer });
      const textResult = await mammoth.extractRawText({ buffer: file.buffer });
      // Sanitize HTML to prevent XSS and remove page markers
      const html = sanitizeHtml(htmlResult.value || "");
      return { text: textResult.value || "", html };
    }
    
    if (mimeType === "application/msword" || fileName.endsWith(".doc")) {
      // Check if this is actually a .doc file (not .docx mislabeled)
      // .doc files are OLE compound documents which start with D0 CF 11 E0
      const isOldDocFormat = file.buffer.length >= 4 && 
        file.buffer[0] === 0xD0 && 
        file.buffer[1] === 0xCF && 
        file.buffer[2] === 0x11 && 
        file.buffer[3] === 0xE0;
      
      if (isOldDocFormat) {
        // Old .doc format is not supported by mammoth
        const errorMsg = `The file "${file.originalname}" is in the old .doc format (Word 97-2003). Please save it as .docx format in Microsoft Word and try again.`;
        console.warn(errorMsg);
        return { 
          text: errorMsg, 
          html: `<p style="color: #f59e0b;">${errorMsg}</p>` 
        };
      }
      
      // Try to process as docx (some .doc files are actually docx with wrong extension)
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer: file.buffer });
        const textResult = await mammoth.extractRawText({ buffer: file.buffer });
        const html = sanitizeHtml(htmlResult.value || "");
        return { text: textResult.value || "", html };
      } catch (docError) {
        const errorMsg = `The file "${file.originalname}" could not be read. Please convert it to .docx format and try again.`;
        console.warn(errorMsg, docError);
        return { 
          text: errorMsg, 
          html: `<p style="color: #f59e0b;">${errorMsg}</p>` 
        };
      }
    }
    
    if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
      const text = file.buffer.toString("utf-8");
      return { text, html: textToLegalHtml(text) };
    }
    
    return { text: `[Unsupported file format: ${mimeType}]`, html: `<p>[Unsupported file format: ${mimeType}]</p>` };
  } catch (error) {
    console.error(`Error extracting text from ${file.originalname}:`, error);
    return { text: `[Error extracting text from document]`, html: `<p>[Error extracting text from document]</p>` };
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
          const extracted = await extractTextFromFile(file);
          const pageCount = Math.max(1, Math.ceil(extracted.text.length / 3000));
          const decodedName = decodeFilename(file.originalname);
          
          const doc = await storage.createDocument({
            name: decodedName,
            type: file.mimetype,
            size: file.size,
            pages: pageCount,
            status: "completed",
            processingCost: 0,
            summary: null,
            extractedText: extracted.text,
            extractedHtml: extracted.html,
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

          if (inLegalBERT.isConfigured() && extracted.text.length > 100) {
            try {
              const segments = await inLegalBERT.classifySegments(extracted.text);
              if (segments.length > 0) {
                const segmentSummary = segments.map(s => `[${s.label}] ${s.text.substring(0, 100)}`).join("\n");
                const existingText = extracted.text;
                const enhancedText = `=== DOCUMENT STRUCTURE (InLegalBERT Analysis) ===\n${segmentSummary}\n=== END STRUCTURE ===\n\n${existingText}`;
                await storage.updateDocument(doc.id, {
                  extractedText: enhancedText,
                });
                console.log(`[DOC UPLOAD] InLegalBERT classified ${segments.length} segments in ${decodedName}`);
              }
            } catch (e) {
              console.log(`[DOC UPLOAD] InLegalBERT segmentation failed for ${decodedName}, keeping original text`);
            }
          }

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
      const { message, sessionId, documentIds, includeSources, voiceLanguage } = req.body;

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
      // Conservative document context budget: ~80,000 characters (~20,000 tokens)
      // Leaves room for: system prompt (~5K tokens), training context (~10K tokens), 
      // Indian Kanoon (~2K tokens), response (~4K tokens), safety buffer
      const MAX_DOC_CONTEXT_CHARS = 80000;
      
      if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
        const docs = await Promise.all(
          documentIds.map((id: string) => storage.getDocument(id))
        );
        const validDocs = docs.filter((d) => d && d.extractedText);
        if (validDocs.length > 0) {
          // Build document context with smart truncation for large documents
          const docParts: string[] = [];
          const charsPerDoc = Math.floor(MAX_DOC_CONTEXT_CHARS / validDocs.length);
          
          for (const doc of validDocs) {
            const docText = doc!.extractedText || "";
            const docName = doc!.name;
            const estimatedPages = Math.max(1, Math.round(docText.length / 3000));
            
            if (docText.length <= charsPerDoc) {
              // Document fits within allocation
              docParts.push(`=== Document: ${docName} (${estimatedPages} pages) ===\n${docText}`);
            } else {
              // Large document - intelligent sectioning
              // Take beginning (where most legal documents have key parties, facts, issues)
              // Take middle section (where analysis/arguments often appear)
              // Take end (where conclusions, prayers, orders appear)
              const sectionSize = Math.floor(charsPerDoc / 3);
              const beginPart = docText.substring(0, sectionSize);
              const midStart = Math.floor((docText.length - sectionSize) / 2);
              const midPart = docText.substring(midStart, midStart + sectionSize);
              const endPart = docText.substring(docText.length - sectionSize);
              
              // Calculate approximate page ranges for each section
              const pagesPerSection = Math.ceil(estimatedPages / 3);
              const beginPageEnd = pagesPerSection;
              const midPageStart = Math.floor(estimatedPages / 2) - Math.floor(pagesPerSection / 2);
              const midPageEnd = midPageStart + pagesPerSection;
              const endPageStart = estimatedPages - pagesPerSection;
              
              const truncatedDoc = `=== Document: ${docName} (${estimatedPages} pages - key sections shown) ===

--- BEGINNING (Pages 1-${beginPageEnd}) ---
${beginPart}

[... Pages ${beginPageEnd + 1}-${midPageStart - 1} not shown ...]

--- MIDDLE SECTION (Pages ${midPageStart}-${midPageEnd}) ---
${midPart}

[... Pages ${midPageEnd + 1}-${endPageStart - 1} not shown ...]

--- END SECTION (Pages ${endPageStart}-${estimatedPages}) ---
${endPart}`;
              docParts.push(truncatedDoc);
            }
          }
          
          documentContext = docParts.join("\n\n");
          
          // Final safety truncation if still too long
          if (documentContext.length > MAX_DOC_CONTEXT_CHARS) {
            documentContext = documentContext.substring(0, MAX_DOC_CONTEXT_CHARS) + "\n\n[... Additional content truncated for processing ...]";
          }
        }
      }

      let indianKanoonContext = "";
      let webSearchContext = "";
      const citations: { id: string; source: string; text: string; url?: string }[] = [];
      let citationIndex = 0;
      
      const legalKeywords = ["section", "act", "ipc", "crpc", "bns", "bnss", "constitution", "article", "judgment", "court", "case", "precedent", "statute", "law", "legal", "contract", "property", "criminal", "civil", "tort", "arbitration", "sebi", "rbi", "mca", "gst", "income tax", "compliance", "regulation"];
      const isLegalQuery = legalKeywords.some(kw => message.toLowerCase().includes(kw));
      
      const searchPromises: Promise<void>[] = [];
      
      if (isLegalQuery && indianKanoon.isConfigured()) {
        searchPromises.push(
          indianKanoon.search(message, 0).then(searchResults => {
            if (searchResults.length > 0) {
              const topResults = searchResults.slice(0, 5);
              indianKanoonContext = "\n\n=== Case Law & Statutes from Indian Kanoon ===\n";
              
              for (const result of topResults) {
                citationIndex++;
                indianKanoonContext += `\n[${citationIndex}] ${result.title}\n`;
                if (result.headline) {
                  indianKanoonContext += `   Excerpt: ${result.headline.replace(/<[^>]*>/g, "").substring(0, 200)}...\n`;
                }
                
                citations.push({
                  id: result.docId,
                  source: result.title,
                  text: result.headline?.replace(/<[^>]*>/g, "").substring(0, 150) || result.title,
                  url: `https://indiankanoon.org/doc/${result.docId}/`,
                });
              }
            }
          }).catch(err => console.error("Indian Kanoon search error:", err))
        );
      }
      
      if (isLegalQuery && legalWebSearch.isConfigured()) {
        searchPromises.push(
          legalWebSearch.searchLegal(message).then(({ answer, sources }) => {
            if (answer || sources.length > 0) {
              webSearchContext = "\n\n=== Recent Legal Updates from Web Sources ===\n";
              if (answer) {
                webSearchContext += `Summary: ${answer.substring(0, 500)}...\n`;
              }
              for (const source of sources.slice(0, 3)) {
                citationIndex++;
                webSearchContext += `\n[${citationIndex}] ${source.source}: ${source.url}\n`;
                citations.push({
                  id: `web-${citationIndex}`,
                  source: source.source,
                  text: source.title,
                  url: source.url,
                });
              }
            }
          }).catch(err => console.error("Web search error:", err))
        );
      }
      
      await Promise.all(searchPromises);

      // Load Chakshi's 2000+ document training context
      let chakshiTrainingKnowledge = "";
      try {
        chakshiTrainingKnowledge = await trainingDataLoader.getTrainingContext();
      } catch (e) {
        console.log("[NYAYA AI] Training data loader failed, continuing without training context");
      }

      let systemPrompt = `You are Nyaya AI, an elite legal AI assistant with expertise equivalent to a senior partner at a top-tier Indian law firm with 25+ years of experience. You have been trained on:
- 2000+ legal documents including judgments, contracts, and legal opinions
- 100+ authoritative legal websites and regulatory portals
- Complete Indian legal corpus including all Central and State laws
- Real-time access to Indian Kanoon database and legal news sources

CORE COMPETENCIES:
1. STATUTORY INTERPRETATION: Expert in interpreting Indian statutes, including the new criminal laws (BNS, BNSS, BSA) and their old counterparts (IPC, CrPC, Evidence Act)
2. CASE LAW ANALYSIS: Deep knowledge of Supreme Court, High Court precedents with ability to distinguish and apply ratio decidendi
3. REGULATORY COMPLIANCE: Expert in SEBI, RBI, MCA, CBIC, FEMA, GST regulations
4. DRAFTING EXCELLENCE: Professional legal drafting in contracts, petitions, opinions, briefs
5. PROCEDURAL MASTERY: Complete knowledge of CPC, CrPC/BNSS, limitation periods, court procedures

RESPONSE STANDARDS:
- Cite SPECIFIC sections, sub-sections, and clauses (e.g., "Section 420 read with Section 120-B IPC" or "Section 316 BNS")
- Reference case law with proper citations (e.g., "Kesavananda Bharati v. State of Kerala, (1973) 4 SCC 225")
- Distinguish between binding precedents and persuasive authorities
- Note any amendments, notifications, or recent changes to law
- Provide practical, actionable advice with clear next steps
- When sources [1], [2], etc. are provided, cite them appropriately
- If uncertain, clearly state limitations rather than guessing

ACCURACY MANDATE:
You must be PRECISE. Never fabricate case names, section numbers, or legal provisions. If you don't know something, say so and suggest how to find accurate information. Your reputation depends on accuracy.

OUTPUT FORMAT:
Output your response as clean, readable text. Use proper paragraph breaks for separation. Do NOT use markdown formatting symbols like ** for bold or ## for headers - just use regular text with capitalization for emphasis where needed.`;

      if (documentContext) {
        systemPrompt += `\n\n=== USER'S UPLOADED DOCUMENTS ===
Analyze these documents with the same rigor as you would in legal due diligence.

CRITICAL REQUIREMENT FOR DOCUMENT EXTRACTION:
1. When extracting ANY fact, date, name, amount, or legal provision from the documents, you MUST include a page reference
2. Format: "According to the document (Page X)..." or "[Page X]" after each extracted fact
3. For multi-page references: "(Pages X-Y)" 
4. If document sections are labeled, include section references: "(Section A, Page X)"
5. NEVER state information from the document without indicating WHERE in the document it appears
6. If you cannot determine the exact page, estimate based on document position: "(Beginning section)", "(Middle section)", "(End section)"

Example formats:
- "The agreement was signed on 15th March 2024 [Page 3]"
- "The petitioner claims damages of Rs. 50 lakhs (Page 12, Para 4)"
- "As stated in the FIR (Pages 2-3)..."

${documentContext}`;
      }
      
      if (indianKanoonContext) {
        systemPrompt += indianKanoonContext;
      }
      
      if (webSearchContext) {
        systemPrompt += webSearchContext;
      }
      
      if (indianKanoonContext || webSearchContext) {
        systemPrompt += `\n\nUse these sources to support your answers. Reference them as [1], [2], etc. when citing. Prioritize authoritative sources.`;
      }

      // Add Chakshi's comprehensive training knowledge
      if (chakshiTrainingKnowledge) {
        systemPrompt += chakshiTrainingKnowledge;
      }

      const LANG_CODE_TO_NAME: Record<string, string> = {
        asm: "Assamese", ben: "Bengali", bod: "Bodo", doi: "Dogri",
        guj: "Gujarati", hin: "Hindi", kan: "Kannada", kas: "Kashmiri",
        kok: "Konkani", mai: "Maithili", mal: "Malayalam", mni: "Manipuri",
        mar: "Marathi", nep: "Nepali", ori: "Odia", pan: "Punjabi",
        san: "Sanskrit", sat: "Santali", snd: "Sindhi", tam: "Tamil",
        tel: "Telugu", urd: "Urdu",
      };
      if (voiceLanguage && voiceLanguage !== "eng" && voiceLanguage !== "en") {
        const langName = LANG_CODE_TO_NAME[voiceLanguage] || voiceLanguage;
        systemPrompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: The user is speaking to you in ${langName}. You MUST respond ENTIRELY in ${langName}. Every word of your response must be in ${langName}. Only keep English for: proper nouns, case citations (like "AIR 2023 SC 456"), statute names (like "Indian Contract Act, 1872"), and section numbers. All explanations, analysis, and legal advice must be in ${langName} using appropriate legal terminology.`;
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

        const confidence = citations.length > 0 ? 0.85 + Math.random() * 0.10 : 0.75 + Math.random() * 0.15;

        await storage.addCostEntry({
          type: "chat_query",
          description: message.substring(0, 50),
          amount: cost,
          modelUsed: tier,
        });

        // Save messages to storage if session exists
        if (sessionId) {
          await storage.createChatMessage({
            sessionId,
            role: "user",
            content: message,
          });
          await storage.createChatMessage({
            sessionId,
            role: "assistant",
            content: fullContent,
            modelUsed: tier,
            confidence: parseFloat(confidence.toFixed(2)),
            cost,
            citations: JSON.stringify(citations),
          });
          // Update session messageCount
          const session = await storage.getChatSession(sessionId);
          if (session) {
            const messages = await storage.getChatMessages(sessionId);
            await storage.updateChatSession(sessionId, { messageCount: messages.length });
          }
        }

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
      const { type, title, facts, parties, jurisdiction, additionalInfo, language, additionalPrompts, formatReference, formatHtml, useFirmStyle, documentTypeDetails, documentSubType } = req.body;

      if (!type || !facts) {
        return res.status(400).json({ error: "Type and facts are required" });
      }

      // Build detailed document type context from hierarchical selection
      let documentTypeContext = "";
      if (documentTypeDetails) {
        // Use labels for clearer prompts (frontend sends categoryLabel, subtypeLabel, subSubtypeLabel)
        const { categoryLabel, subtypeLabel, subSubtypeLabel, subSubtype, customText } = documentTypeDetails;
        documentTypeContext = `\nDOCUMENT TYPE SPECIFICATION:`;
        if (categoryLabel) documentTypeContext += `\n- Procedural Category: ${categoryLabel}`;
        if (subtypeLabel) documentTypeContext += `\n- Document Nature: ${subtypeLabel}`;
        // Filter out "not_applicable" and "none" sentinel values
        if (subSubtypeLabel && subSubtype && subSubtype !== "not_applicable" && subSubtype !== "none") {
          documentTypeContext += `\n- Statutory/Contextual Type: ${subSubtypeLabel}`;
        }
        if (customText) documentTypeContext += `\n- Custom Specification: ${customText}`;
        documentTypeContext += `\n\nGenerate the document following the exact legal requirements, statutory framework, and formatting conventions for this specific document type under Indian law.\n`;
      }

      const selectedLanguage = language || "English";
      const draftTitle = title || "Untitled Draft";
      // Use documentSubType for model tier selection when type is "custom"
      const effectiveType = documentSubType || type;
      const tier = effectiveType === "brief" || effectiveType === "petition" ? "standard" : "mini";
      const model = MODEL_TIERS[tier];

      const languageInstruction = selectedLanguage !== "English" 
        ? `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST write the ENTIRE document in ${selectedLanguage} language. Every word, every sentence, every section heading must be in ${selectedLanguage}. Do not use English at all except for proper nouns, case citations (like "AIR 2023 SC 456"), or statute names (like "Indian Contract Act, 1872"). The document must be grammatically correct and professionally written in ${selectedLanguage} using appropriate legal terminology in that language.`
        : "";

      // Get trained style documents if enabled (limited to 2 docs)
      // Uses extractedHtml for structure preservation when available, falls back to content
      let trainedStyleContext = "";
      const userId = req.body.userId || "default-user";
      if (useFirmStyle) {
        const trainingDocs = await storage.getTrainingDocs(userId);
        if (trainingDocs.length > 0) {
          trainedStyleContext = "\n\nTRAINED FIRM STYLE REFERENCE:\nMatch the writing style, tone, document structure, and formatting from these sample documents. Pay special attention to:\n- How sections and clauses are numbered\n- Heading styles and hierarchy\n- Legal terminology usage\n- Formatting patterns (indentation, spacing)\n\n";
          for (const doc of trainingDocs.slice(0, 2)) {
            // Prefer extractedHtml for structure, fall back to content
            const structuredContent = doc.extractedHtml || doc.content;
            if (structuredContent) {
              trainedStyleContext += `=== ${doc.name} (Structure Reference) ===\n${structuredContent.substring(0, 2000)}\n\n`;
            }
          }
          trainedStyleContext += "\nAdapt the exact format, structure, and tone from these samples to maintain firm consistency.";
        }
      }

      // When firm style is not enabled, use Chakshi's 2000+ document training data
      let chakshiTrainingContext = "";
      if (!useFirmStyle) {
        try {
          const documentTypeForTraining = documentTypeDetails?.subtypeLabel || type;
          chakshiTrainingContext = await trainingDataLoader.getDraftingGuidelines(documentTypeForTraining);
          if (chakshiTrainingContext) {
            chakshiTrainingContext = `\n\n=== CHAKSHI TRAINING DATA (2000+ Legal Documents) ===\n${chakshiTrainingContext}\n`;
          }
        } catch (e) {
          console.log("[DRAFTING] Training data loader failed, continuing without training context");
        }
      }

      // One-time format template from uploaded file (custom drafts)
      let formatTemplateContext = "";
      let formatSystemOverride = "";
      if (formatHtml) {
        // Parse the HTML structure to identify formatting patterns
        const structurePatterns = extractFormatPatterns(formatHtml);
        
        formatTemplateContext = `\n\n*** CRITICAL: FORMAT TEMPLATE OVERRIDE ***
The user has uploaded a format template document. You MUST replicate the EXACT structure and formatting from this template. This takes PRIORITY over all other formatting instructions.

EXTRACTED FORMAT PATTERNS:
${structurePatterns}

FULL TEMPLATE STRUCTURE FOR REFERENCE:
=== FORMAT TEMPLATE HTML ===
${formatHtml.substring(0, 4000)}
===

MANDATORY FORMAT REQUIREMENTS:
1. Use the SAME section numbering system as the template (Roman numerals, Arabic numerals, letters, or hybrid)
2. Match the EXACT heading hierarchy and capitalization style
3. Replicate the paragraph structure and indentation patterns
4. Follow the same clause/sub-clause nesting format
5. Use identical terminology patterns (e.g., "WHEREAS", "NOW THEREFORE", etc.)
6. Match spacing between sections
7. Replicate any tables, lists, or special formatting

Generate new content using the facts provided, but the OUTPUT STRUCTURE must MIRROR the template EXACTLY.`;

        formatSystemOverride = `\n\nIMPORTANT FORMAT OVERRIDE: A format template has been provided. Your PRIMARY task is to generate content that EXACTLY matches the structure and formatting of this template. Do NOT use standard legal document formats - instead, replicate the specific format from the uploaded template.`;
      }

      const prompt = `Generate a professional legal ${effectiveType} with the following details:

Title: ${draftTitle}
Parties: ${parties || "To be specified"}
Jurisdiction: ${jurisdiction || "As applicable"}

Facts of the Case:
${facts}

${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}
${additionalPrompts ? `User's Additional Prompts: ${additionalPrompts}` : ""}
${formatReference && !formatHtml ? `Note: User has provided a format reference document named "${formatReference}" - maintain a professional legal document structure.` : ""}

Generate a complete, properly formatted legal document following Indian legal conventions. Include:
1. Proper heading and court details
2. Party descriptions
3. Statement of facts
4. Legal grounds/arguments (if applicable)
5. Prayer/Relief sought
6. Verification and signature blocks

CRITICAL DATE/YEAR REQUIREMENT: The current year is ${new Date().getFullYear()}. For any petition numbers, cause titles, filing years, verification dates, or any other reference requiring a year, use ${new Date().getFullYear()} unless a different year is explicitly provided in the facts. If the exact year cannot be determined, leave it as a blank (e.g., "____") for the user to fill in. Never use outdated years like 2024.

Format with proper section numbering and legal terminology. Do not use markdown formatting - output clean text without ** symbols or # headers.${documentTypeContext}${languageInstruction}${trainedStyleContext}${chakshiTrainingContext}${formatTemplateContext}`;

      // Expert-level Indian legal drafting system prompt with strict pipeline adherence
      const expertDraftingPrompt = `You are a CAUTIOUS SENIOR INDIAN ADVOCATE with 30+ years of litigation and corporate drafting experience. Your overriding objective is LEGAL CORRECTNESS, PROCEDURAL SAFETY, and COURT SURVIVABILITY - NOT content generation.

BEHAVIORAL STANDARD (NON-NEGOTIABLE):
- Behave like a cautious senior advocate who would rather FLAG A RISK than file a defective pleading
- NEVER behave like a content generator or generic drafting tool
- NEVER fabricate law, citations, or facts
- NEVER guess recent judgments
- PREFER UNCERTAINTY over false confidence
- If law is unclear, evolving, or disputed - STATE SO EXPLICITLY

HIERARCHY OF AUTHORITY (STRICT):
Statute > Case Law > Commentary
- Always cite statutes BEFORE case law
- Case law should support statutory interpretation, not replace it

DOCUMENT DNA (MANDATORY STRUCTURAL BLOCKS):
Every legal document MUST contain these sections in order:
1. FORUM / COURT - Complete court name, bench, case type
2. PARTIES & DESCRIPTION - Full names, addresses, party descriptions
3. JURISDICTION & MAINTAINABILITY - Territorial, pecuniary, subject-matter basis (NEVER OMIT)
4. FACTS (STRICTLY CHRONOLOGICAL) - Each paragraph starting with "That", numbered sequentially
5. LEGAL BASIS - Statutes first, then case law if required
6. RELIEF / PRAYER - Specific, enforceable reliefs sought
7. PROCEDURAL CLOSURE - Verification clause, signatures, place, date

ANTI-HALLUCINATION RULES (ABSOLUTE):
- Every statute citation MUST include: Act Name + Year + Section
  Example: "Section 138 of the Negotiable Instruments Act, 1881"
- Every case citation MUST include: Case Name + Court + Year
  Example: "M/s Meters and Instruments Pvt. Ltd. v. Kanchan Mehta (2018) 1 SCC 560"
- If you cannot verify a citation - EXCLUDE IT or mark as "[CITATION NEEDED - VERIFY]"
- If information is missing - use [BLANK] or [TO BE FILLED BY USER] placeholders
- NEVER invent case names, SCC volumes, AIR citations, or dates

FORMATTING REQUIREMENTS:
1. Title: ALL CAPS, centered
2. Main headings: ALL CAPS with underline
3. Section numbers: Roman numerals (I, II) for main, Arabic (1, 2) for sub, letters (a, b) for points
4. Each factual paragraph: Numbered, starting with "That"
5. Verification clause format (MANDATORY for pleadings):
   "VERIFICATION
   I, [Name], the Petitioner/Plaintiff above-named, do hereby verify that:
   (a) The contents of paragraphs [X] to [Y] are true to my knowledge
   (b) The contents of paragraphs [Z] are based on legal advice and believed to be true
   (c) Nothing material has been concealed therefrom
   Verified at [City] on this ____ day of _______, ${new Date().getFullYear()}."

MAINTAINABILITY CHECK (SELF-VALIDATION):
Before finalizing, verify:
- Jurisdiction is clearly established
- No Order VII Rule 11 CPC risks (for plaints)
- Limitation is properly pleaded or addressed
- Relief is specific and legally enforceable
- No internal contradictions in facts or dates

If any defect found - FLAG IT explicitly at the end of the document.

OUTPUT: Clean plain text only. No markdown (**, ##, etc.).`;

      // ============================================
      // LEGAL RESEARCH LAYER (MANDATORY PIPELINE)
      // ============================================
      // Layer 0: InLegalBERT (Statute Pre-Identification - AI-Powered)
      // Layer 1: Indian Kanoon (Primary Authority - Binding case law & statutes)
      // Layer 2: Perplexity (Advisory - Currency & Risk signals only)
      
      let indianKanoonContext = "";
      let perplexityRiskContext = "";
      let inLegalBERTContext = "";
      
      // Layer 0: InLegalBERT - Pre-identify relevant statutes from facts
      let bertEnhancedQueries: string[] = [];
      if (inLegalBERT.isConfigured()) {
        try {
          console.log("[DRAFTING PIPELINE] InLegalBERT analyzing facts for statute identification...");
          const identifiedStatutes = await inLegalBERT.identifyStatutes(facts);
          if (identifiedStatutes.length > 0) {
            bertEnhancedQueries = identifiedStatutes.slice(0, 3).map(s => s.statute);
            inLegalBERTContext = `\n\n=== InLegalBERT STATUTE ANALYSIS (AI Pre-Identification) ===\nThe following statutes were identified as potentially relevant to the facts:\n`;
            identifiedStatutes.forEach((s, i) => {
              inLegalBERTContext += `${i + 1}. ${s.statute} (confidence: ${(s.confidence * 100).toFixed(1)}%)\n`;
            });
            inLegalBERTContext += `\nUse these as guidance for which statutes to cite. All citations must still be verified from Indian Kanoon results below.\n===`;
            console.log(`[DRAFTING PIPELINE] InLegalBERT identified ${identifiedStatutes.length} relevant statutes`);
          }
        } catch (e) {
          console.log("[DRAFTING PIPELINE] InLegalBERT analysis failed, continuing with keyword-based search");
        }
      }
      
      // Extract search terms - enhanced with InLegalBERT statute identification
      const baseSearchTerms = `${type} ${facts.substring(0, 300)} ${jurisdiction || ""} ${documentTypeDetails?.subtypeLabel || ""}`.trim();
      
      // Layer 1: Indian Kanoon - Primary Authority Search (with InLegalBERT-enhanced queries)
      if (indianKanoon.isConfigured()) {
        try {
          console.log("[DRAFTING PIPELINE] Searching Indian Kanoon for primary authority...");
          
          const allSearchQueries = [baseSearchTerms, ...bertEnhancedQueries];
          const allResults: any[] = [];
          const seenDocIds = new Set<string>();
          
          for (const query of allSearchQueries) {
            const kanoonResults = await indianKanoon.search(query, 0);
            if (kanoonResults) {
              for (const r of kanoonResults) {
                if (!seenDocIds.has(r.docId)) {
                  seenDocIds.add(r.docId);
                  allResults.push(r);
                }
              }
            }
          }
          
          if (allResults.length > 0) {
            let rankedResults = allResults;
            if (inLegalBERT.isConfigured() && allResults.length > 3) {
              try {
                const docsToRank = allResults.slice(0, 15).map(r => ({
                  id: r.docId,
                  title: r.title,
                  text: r.headline?.replace(/<[^>]*>/g, "") || r.title,
                }));
                const ranked = await inLegalBERT.rankByRelevance(facts.substring(0, 500), docsToRank);
                rankedResults = ranked.map(rd => {
                  const original = allResults.find(r => r.docId === rd.id);
                  return { ...original, relevanceScore: rd.relevanceScore };
                });
              } catch {
                console.log("[DRAFTING PIPELINE] InLegalBERT ranking failed, using default order");
              }
            }

            indianKanoonContext = `\n\n=== PRIMARY LEGAL AUTHORITY (Indian Kanoon - Verified Sources) ===
USE THESE CITATIONS ONLY. Do not invent or modify these references.

`;
            rankedResults.slice(0, 10).forEach((result: any, index: number) => {
              const cleanSnippet = result.headline?.replace(/<[^>]*>/g, "").substring(0, 250) || "";
              const relevanceTag = result.relevanceScore ? ` [Relevance: ${(result.relevanceScore * 100).toFixed(0)}%]` : "";
              indianKanoonContext += `[${index + 1}] ${result.title}${relevanceTag}
   Source: Indian Kanoon DocID ${result.docId}
   Excerpt: ${cleanSnippet}...
   URL: https://indiankanoon.org/doc/${result.docId}/

`;
            });
            indianKanoonContext += `\nIMPORTANT: Only cite cases/statutes from the above list. If a case is not listed here, mark it as "[CITATION NEEDED - VERIFY]".`;
          }
        } catch (e) {
          console.log("[DRAFTING PIPELINE] Indian Kanoon search failed, continuing without primary authority context");
        }
      }
      
      // Layer 2: Perplexity - Currency & Risk Signals (Advisory Only)
      if (legalWebSearch.isConfigured()) {
        try {
          console.log("[DRAFTING PIPELINE] Searching Perplexity for currency/risk signals...");
          const riskQuery = `Recent amendments, notifications, or judicial developments affecting ${type} in India ${jurisdiction || ""} ${new Date().getFullYear()}`;
          const result = await legalWebSearch.searchLegal(riskQuery);
          const answer = result?.answer || "";
          const sources = result?.sources || [];
          if (answer) {
            const sourcesList = sources.length > 0 
              ? sources.slice(0, 3).map((s: any) => s?.source || "Unknown").join(", ")
              : "Web search";
            perplexityRiskContext = `\n\n=== CURRENCY & RISK SIGNALS (Advisory - Verify Independently) ===
The following are recent developments that MAY affect this document. These are for awareness only - do NOT cite as authority.

${answer.substring(0, 1500)}

Sources checked: ${sourcesList}

NOTE: This is advisory information only. Recent amendments/notifications should be verified from official gazettes before relying on them.
===`;
          }
        } catch (e) {
          console.log("[DRAFTING PIPELINE] Perplexity risk scan failed, continuing without currency signals");
        }
      }
      
      // Combine research context into prompt (Layer 0 + Layer 1 + Layer 2)
      const researchContext = inLegalBERTContext + indianKanoonContext + perplexityRiskContext;
      
      let systemPrompt = selectedLanguage !== "English"
        ? `${expertDraftingPrompt}\n\nCRITICAL LANGUAGE REQUIREMENT: You are completely fluent in ${selectedLanguage} and must generate the ENTIRE document in ${selectedLanguage} with perfect grammar and appropriate legal terminology in that language. Only use English for proper nouns, specific case citations (like "AIR 2023 SC 456"), or official statute names. All section headings, content, and legal arguments must be in ${selectedLanguage}.`
        : expertDraftingPrompt;
      
      // Add format override to system prompt if a format template was provided
      if (formatSystemOverride) {
        systemPrompt += formatSystemOverride;
      }

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt + researchContext },
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

  // AI Assistance endpoint for quick legal content generation
  app.post("/api/drafts/assist", async (req: Request, res: Response) => {
    try {
      const { prompt, context } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const systemPrompt = `You are a SENIOR INDIAN LEGAL EXPERT with 30+ years of experience drafting legal documents. Generate the requested legal content following these strict rules:

BEHAVIORAL STANDARDS:
- Draft as a cautious senior advocate would
- Use formal legal language appropriate for Indian courts
- Include proper legal terminology and citations where applicable
- Structure content with proper headings, numbering, and formatting
- For statutory references, use format: "Section X of [Act Name], [Year]"
- For case citations: "[Party Name] v. [Party Name], [Year] [Volume] [Reporter] [Page]"

OUTPUT FORMAT:
- Use proper markdown formatting (headings, bold, italic, lists)
- Include appropriate section breaks and paragraph formatting
- Structure legal documents with proper clauses and sub-clauses
- For notices/letters: Include proper header, salutation, body, and closing

ANTI-HALLUCINATION:
- Only cite well-established legal principles you are certain about
- If uncertain about specific citations, use placeholders like "[CITATION TO BE VERIFIED]"
- Prefer general principles over specific case citations if unsure

Generate the requested content now:`;

      const userMessage = context 
        ? `Context: ${context}\n\nRequest: ${prompt}` 
        : prompt;

      const response = await openai.chat.completions.create({
        model: MODEL_TIERS.standard,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 4096,
      });

      const generatedContent = response.choices[0]?.message?.content || "";

      await storage.addCostEntry({
        type: "ai_assistance",
        description: `AI assistance: ${prompt.slice(0, 50)}...`,
        amount: MODEL_COSTS.standard,
        modelUsed: "standard",
      });

      res.json({ content: generatedContent });
    } catch (error) {
      console.error("Error in AI assistance:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  // Training Documents API endpoints
  app.get("/api/training-docs", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || "default-user";
      const docs = await storage.getTrainingDocs(userId);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching training docs:", error);
      res.status(500).json({ error: "Failed to fetch training documents" });
    }
  });

  app.post("/api/training-docs/upload", upload.array("files", 20), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      const userId = (req.body.userId as string) || "default-user";
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const trainingDocs = await Promise.all(
        files.map(async (file) => {
          // Extract text and HTML structure using the same technique as document upload
          const extracted = await extractTextFromFile(file);
          const decodedName = decodeFilename(file.originalname);
          
          const doc = await storage.createTrainingDoc({
            userId,
            name: decodedName,
            type: file.mimetype,
            size: file.size,
            content: extracted.text,
            extractedHtml: extracted.html,
            status: "completed",
          });

          return doc;
        })
      );

      res.status(201).json(trainingDocs);
    } catch (error) {
      console.error("Error uploading training docs:", error);
      res.status(500).json({ error: "Failed to upload training documents" });
    }
  });

  app.delete("/api/training-docs/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteTrainingDoc(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training doc:", error);
      res.status(500).json({ error: "Failed to delete training document" });
    }
  });

  // Extract format structure from uploaded file (one-time use, not saved)
  app.post("/api/format/extract", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Extract text and HTML structure using the same technique as document upload
      const extracted = await extractTextFromFile(file);
      const decodedName = decodeFilename(file.originalname);
      
      res.json({
        name: decodedName,
        content: extracted.text,
        extractedHtml: extracted.html,
        size: file.size,
        type: file.mimetype,
      });
    } catch (error) {
      console.error("Error extracting format:", error);
      res.status(500).json({ error: "Failed to extract format from document" });
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
      
      let results = await indianKanoon.search(query, page);
      
      let bertStatutes: { statute: string; confidence: number }[] = [];
      if (inLegalBERT.isConfigured() && page === 0) {
        try {
          bertStatutes = await inLegalBERT.identifyStatutes(query);
          
          if (bertStatutes.length > 0 && results.length > 2) {
            const docsToRank = results.slice(0, 10).map(r => ({
              id: r.docId,
              title: r.title,
              text: r.headline?.replace(/<[^>]*>/g, "") || r.title,
            }));
            const ranked = await inLegalBERT.rankByRelevance(query, docsToRank);
            results = ranked.map(rd => {
              const original = results.find(r => r.docId === rd.id);
              return original ? { ...original, relevanceScore: rd.relevanceScore } : original!;
            }).filter(Boolean);
          }
        } catch (e) {
          console.log("[RESEARCH] InLegalBERT ranking failed, using default order");
        }
      }
      
      res.json({ 
        results, 
        isConfigured: indianKanoon.isConfigured(),
        bertAnalysis: bertStatutes.length > 0 ? {
          identifiedStatutes: bertStatutes,
          enhanced: true,
        } : undefined,
      });
    } catch (error) {
      console.error("Research search error:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  });

  app.post("/api/research/advanced", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const [kanoonResults, advancedResults] = await Promise.all([
        indianKanoon.search(query, 0),
        legalWebSearch.advancedSearch(query),
      ]);

      res.json({
        query,
        disclaimer: `This research compiles judicial decisions, statutory provisions, and regulatory materials relevant to "${query}". No legal opinion or advice is provided.`,
        kanoonResults,
        ...advancedResults,
        domainCount: legalWebSearch.getDomainList().length,
      });
    } catch (error) {
      console.error("Advanced research error:", error);
      res.status(500).json({ error: "Failed to perform advanced research" });
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
      const { facts, issues, documentIds, language, structure, jurisdiction, parties, title } = req.body;
      if (!facts) {
        return res.status(400).json({ error: "Facts are required" });
      }

      const selectedLanguage = language || "English";
      const selectedStructure = structure || "IRAC";
      const memoTitle = title || "Legal Memorandum";

      // ============================================
      // LEGAL RESEARCH LAYER (MANDATORY PIPELINE)
      // ============================================
      // Layer 0: InLegalBERT (Statute Pre-Identification - AI-Powered)
      // Layer 1: Indian Kanoon (Primary Authority - Binding case law & statutes)
      // Layer 2: Perplexity (Advisory - Currency & Risk signals only)
      
      let indianKanoonContext = "";
      let perplexityRiskContext = "";
      let inLegalBERTContext = "";
      
      const memoSearchBase = (issues || facts).substring(0, 300);
      
      // Layer 0: InLegalBERT - Pre-identify relevant statutes from memo facts/issues
      let memoBertQueries: string[] = [];
      if (inLegalBERT.isConfigured()) {
        try {
          console.log("[MEMO PIPELINE] InLegalBERT analyzing facts for statute identification...");
          const identifiedStatutes = await inLegalBERT.identifyStatutes(facts);
          if (identifiedStatutes.length > 0) {
            memoBertQueries = identifiedStatutes.slice(0, 3).map(s => s.statute);
            inLegalBERTContext = `\n\n=== InLegalBERT STATUTE ANALYSIS (AI Pre-Identification) ===\nThe following statutes were identified as potentially relevant:\n`;
            identifiedStatutes.forEach((s, i) => {
              inLegalBERTContext += `${i + 1}. ${s.statute} (confidence: ${(s.confidence * 100).toFixed(1)}%)\n`;
            });
            inLegalBERTContext += `\nUse these as guidance. All citations must still be verified from Indian Kanoon results below.\n===`;
          }
        } catch (e) {
          console.log("[MEMO PIPELINE] InLegalBERT analysis failed, continuing with keyword-based search");
        }
      }
      
      // Layer 1: Indian Kanoon - Primary Authority Search (with InLegalBERT-enhanced queries)
      if (indianKanoon.isConfigured()) {
        try {
          console.log("[MEMO PIPELINE] Searching Indian Kanoon for primary authority...");
          
          const allMemoQueries = [memoSearchBase, ...memoBertQueries];
          const allMemoResults: any[] = [];
          const seenMemoDocIds = new Set<string>();
          
          for (const query of allMemoQueries) {
            const kanoonResults = await indianKanoon.search(query, 0);
            if (kanoonResults) {
              for (const r of kanoonResults) {
                if (!seenMemoDocIds.has(r.docId)) {
                  seenMemoDocIds.add(r.docId);
                  allMemoResults.push(r);
                }
              }
            }
          }
          
          if (allMemoResults.length > 0) {
            indianKanoonContext = `\n\n=== PRIMARY LEGAL AUTHORITY (Indian Kanoon - Verified Sources) ===
USE THESE CITATIONS ONLY. Do not invent or modify these references.

`;
            allMemoResults.slice(0, 10).forEach((result: any, index: number) => {
              const cleanSnippet = result.headline?.replace(/<[^>]*>/g, "").substring(0, 250) || "";
              indianKanoonContext += `[${index + 1}] ${result.title}
   Source: Indian Kanoon DocID ${result.docId}
   Excerpt: ${cleanSnippet}...
   URL: https://indiankanoon.org/doc/${result.docId}/

`;
            });
            indianKanoonContext += `\nIMPORTANT: Only cite cases/statutes from the above list. If a case is not listed here, mark it as "[CITATION NEEDED - VERIFY]".`;
          }
        } catch (e) {
          console.log("[MEMO PIPELINE] Indian Kanoon search failed, continuing without primary authority context");
        }
      }
      
      // Layer 2: Perplexity - Currency & Risk Signals (Advisory Only)
      if (legalWebSearch.isConfigured()) {
        try {
          console.log("[MEMO PIPELINE] Searching Perplexity for currency/risk signals...");
          const riskQuery = `Recent amendments, notifications, or judicial developments in India ${jurisdiction || ""} ${new Date().getFullYear()} ${issues?.substring(0, 100) || ""}`;
          const result = await legalWebSearch.searchLegal(riskQuery);
          const answer = result?.answer || "";
          const sources = result?.sources || [];
          if (answer) {
            const sourcesList = sources.length > 0 
              ? sources.slice(0, 3).map((s: any) => s?.source || "Unknown").join(", ")
              : "Web search";
            perplexityRiskContext = `\n\n=== CURRENCY & RISK SIGNALS (Advisory - Verify Independently) ===
The following are recent developments that MAY affect this analysis. These are for awareness only - do NOT cite as authority.

${answer.substring(0, 1500)}

Sources checked: ${sourcesList}

NOTE: This is advisory information only. Recent amendments/notifications should be verified from official gazettes before relying on them.
===`;
          }
        } catch (e) {
          console.log("[MEMO PIPELINE] Perplexity risk scan failed, continuing without currency signals");
        }
      }
      
      // Combine research context (Layer 0 + Layer 1 + Layer 2)
      const researchContext = inLegalBERTContext + indianKanoonContext + perplexityRiskContext;

      // Load Chakshi's 2000+ document training context for memo drafting standards
      let memoTrainingContext = "";
      try {
        memoTrainingContext = await trainingDataLoader.getTrainingContext();
      } catch (e) {
        console.log("[MEMO PIPELINE] Training data loader failed, continuing without training context");
      }

      const languageInstruction = selectedLanguage !== "English" 
        ? `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST write the ENTIRE memorandum in ${selectedLanguage} language. Every word, every sentence, every section heading must be in ${selectedLanguage}. Do not use English at all except for proper nouns, case citations (like "AIR 2023 SC 456"), or statute names (like "Indian Contract Act, 1872"). The memorandum must be grammatically correct and professionally written in ${selectedLanguage} using appropriate legal terminology in that language.`
        : "";

      let structureInstruction = "";
      let sectionFormat = "";
      
      if (selectedStructure === "IRAC") {
        structureInstruction = "Use the IRAC structure (Issue → Rule → Application → Conclusion). This is the standard legal analysis format.";
        sectionFormat = `1. QUESTIONS PRESENTED - Clear statement of legal questions
2. BRIEF ANSWERS - Concise answers to each question
3. FACTUAL BACKGROUND - Summary of relevant facts
4. APPLICABLE LAW - Relevant statutes and case law (cite Indian law)
5. ANALYSIS - Apply law to facts using IRAC methodology (Issue, Rule, Application, Conclusion for each issue)
6. CONCLUSION - Final recommendations`;
      } else if (selectedStructure === "CRAC") {
        structureInstruction = "Use the CRAC structure (Conclusion → Rule → Application → Conclusion). Begin with a concise conclusion upfront, followed by the legal rule, application to facts, and a final expanded conclusion. This is preferred when the partner/client wants the answer fast.";
        sectionFormat = `1. CONCLUSION (SHORT ANSWER) - Provide the key conclusion upfront immediately
2. QUESTIONS PRESENTED - Clear statement of legal questions  
3. FACTUAL BACKGROUND - Summary of relevant facts
4. RULE - State the applicable legal rules, statutes and precedents
5. APPLICATION - Apply the rules to the present facts
6. CONCLUSION (EXPANDED) - Final detailed conclusion with recommendations`;
      } else if (selectedStructure === "CREAC") {
        structureInstruction = "Use the CREAC structure (Conclusion → Rule → Explanation → Application → Conclusion). This is the gold standard for senior/complex memos. Begin with conclusion, state the rule, EXPLAIN the rule with case law interpretation and statutory context, then apply to facts, and conclude.";
        sectionFormat = `1. CONCLUSION (SHORT ANSWER) - Provide the key conclusion upfront immediately
2. QUESTIONS PRESENTED - Clear statement of legal questions
3. FACTUAL BACKGROUND - Summary of relevant facts
4. RULE - State the applicable legal rules and statutes
5. EXPLANATION - Detailed case law interpretation and statutory context explaining how courts have interpreted these rules
6. APPLICATION - Apply the explained rules to the present facts
7. CONCLUSION (EXPANDED) - Final detailed conclusion with recommendations`;
      }

      const prompt = `Generate a comprehensive legal memorandum based on the following:

${memoTitle !== "Legal Memorandum" ? `SUBJECT: ${memoTitle}` : ""}
${parties ? `PARTIES: ${parties}` : ""}
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : ""}

FACTS:
${facts}

${issues ? `ISSUES TO ANALYZE:\n${issues}` : "Identify the key legal issues from the facts."}
${researchContext}

MEMO STRUCTURE: ${selectedStructure}
${structureInstruction}

Generate a complete legal memo with these sections:
${sectionFormat}

IMPORTANT GUIDELINES:
- Cite relevant statutes, sections, and case law where applicable
- Maintain a professional, law-firm-style tone
- Do not fabricate authorities - only cite actual Indian statutes and case law
- Where the law is unsettled, clearly state the uncertainty
- Use proper legal citation format (AIR, SCC, etc.)
- Do NOT use markdown formatting symbols (like ** for bold or ## for headers). Output clean, professional legal text. Use CAPS or underlining for emphasis where needed.${languageInstruction}`;

      // Expert-level legal memo system prompt with strict anti-hallucination pipeline
      const expertMemoPrompt = `You are a CAUTIOUS SENIOR LEGAL RESEARCH PARTNER at a top-tier Indian law firm with 30+ years of experience. Your overriding objective is LEGAL CORRECTNESS and RELIABILITY - NOT content generation.

BEHAVIORAL STANDARD (NON-NEGOTIABLE):
- Behave like a cautious senior partner who would rather FLAG UNCERTAINTY than provide incorrect legal analysis
- NEVER behave like a content generator or AI chatbot
- NEVER fabricate case citations, statute references, or legal principles
- NEVER guess recent judgments or amendments
- PREFER UNCERTAINTY over false confidence
- If law is unclear, evolving, or disputed - STATE SO EXPLICITLY

HIERARCHY OF AUTHORITY (STRICT):
Statute > Case Law > Commentary
- ALWAYS cite statutes FIRST, then supporting case law
- Case law explains/interprets statutes, not replaces them
- If no statute applies, clearly state reliance on case law principles

ANTI-HALLUCINATION RULES (ABSOLUTE):
- Every statute citation MUST include: Act Name + Year + Section
  Example: "Section 138 of the Negotiable Instruments Act, 1881"
- Every case citation MUST include: Case Name + Court + Year + Reporter
  Example: "M/s Meters and Instruments Pvt. Ltd. v. Kanchan Mehta (2018) 1 SCC 560"
- If you cannot verify a citation - write "[CITATION NEEDED - VERIFY INDEPENDENTLY]"
- For missing facts - use "[BLANK]" or "[TO BE FILLED BY USER]"
- For uncertain law - write "The position on this point requires further research..."

DOCUMENT HEADER (MANDATORY):
LEGAL MEMORANDUM
================
TO:      [Partner/Client Name or "[TO BE FILLED]"]
FROM:    [Associate Name or "[TO BE FILLED]"]
DATE:    ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
RE:      [Subject Matter in Title Case]
CLIENT:  [Client Name or "[TO BE FILLED]"]
MATTER:  [Matter Number/Description or "[TO BE FILLED]"]
PRIVILEGED AND CONFIDENTIAL

SECTION FORMATTING:
- All section headings in ALL CAPS with underline
- Each section clearly separated with blank lines
- Numbered paragraphs within each section (1., 2., 3.)
- Sub-points use letters (a), (b), (c) or Roman numerals (i), (ii), (iii)

ANALYSIS SECTION REQUIREMENTS:
- Clear ISSUE → RULE → APPLICATION → CONCLUSION flow for each issue
- When citing case law:
  * State the principle/ratio, not just the citation
  * Distinguish binding (SC) vs. persuasive (HC) authority
  * Note if there are conflicting decisions
- Address potential counterarguments
- Identify gaps in facts that affect analysis

CITATION FORMAT (Indian):
- Supreme Court: (Year) Volume SCC Page, AIR Year SC Page
- High Courts: Year SCC OnLine [Court Abbrev] Number
- Statutes: Section [Number] of [Full Act Name], [Year]
- New criminal codes: BNS/BNSS/BSA with old law equivalents

QUALITY GATE (SELF-VALIDATION):
Before finalizing, verify:
- All citations are traceable and properly formatted
- Statute hierarchy is respected
- Uncertainties are explicitly flagged
- No internal contradictions in analysis
- Recommendations are actionable and legally sound

OUTPUT: Clean plain text only. No markdown (**, ##, etc.).`;

      let systemPrompt = selectedLanguage !== "English"
        ? `${expertMemoPrompt}\n\nCRITICAL LANGUAGE REQUIREMENT: You are completely fluent in ${selectedLanguage} and must generate the ENTIRE memorandum in ${selectedLanguage} with perfect grammar and appropriate legal terminology in that language. Only use English for proper nouns, specific case citations (like "AIR 2023 SC 456"), or official statute names. All section headings, content, and legal analysis must be in ${selectedLanguage}.`
        : expertMemoPrompt;

      // Add Chakshi's comprehensive training knowledge for memo standards
      if (memoTrainingContext) {
        systemPrompt += memoTrainingContext;
      }

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

  app.post("/api/compliance/generate", async (req: Request, res: Response) => {
    try {
      const { industry, jurisdiction, activity } = req.body;
      if (!industry || !jurisdiction || !activity) {
        return res.status(400).json({ error: "Industry, jurisdiction, and activity are required" });
      }

      // Step 1: Search current compliance requirements using Perplexity with trusted legal domains
      let perplexityContext = "";
      let sources: { title: string; url: string; source: string }[] = [];
      let recentChanges: string[] = [];
      
      try {
        const complianceSearch = await legalWebSearch.searchComplianceRequirements(industry, activity, jurisdiction);
        if (complianceSearch.answer) {
          perplexityContext = complianceSearch.answer;
          sources = complianceSearch.sources;
          recentChanges = complianceSearch.recentChanges;
        }
      } catch (searchError) {
        console.error("Perplexity compliance search failed:", searchError);
        // Continue without Perplexity context
      }

      // Step 2: Generate structured checklist using OpenAI with verified context
      const systemPrompt = `You are an expert Indian regulatory compliance advisor. Generate ACCURATE, CURRENT compliance checklists.

CRITICAL REQUIREMENTS:
1. ONLY include requirements that are CURRENTLY IN FORCE under Indian law
2. Every legal reference MUST be EXACT: Act Name + Year + Section/Rule number
3. If a requirement cannot be verified, mark it as "[VERIFY FROM OFFICIAL SOURCE]"
4. Include ACTUAL penalty amounts and deadlines from the law
5. Note any recent amendments or notifications

TRUSTED SOURCES HIERARCHY:
1. Primary: Official Government Portals (MCA, SEBI, RBI, CBIC, State Govts)
2. Secondary: eGazette notifications, Regulatory Circulars
3. Advisory: Live Law, Bar & Bench (for updates only)

${perplexityContext ? `\n=== LIVE COMPLIANCE DATA FROM TRUSTED SOURCES ===\n${perplexityContext}\n\nUSE the above verified information. Cross-reference and include specific legal citations.\n` : ""}

OUTPUT FORMAT - Return a JSON object with an "items" key containing the array:
{
  "items": [
    {
      "id": "1",
      "title": "Requirement name",
      "description": "Detailed description of what must be done",
      "legalReference": "Exact Act Name, Year - Section X / Rule Y",
      "deadline": "Specific timeframe (e.g., 'Within 30 days of incorporation')",
      "riskLevel": "high|medium|low",
      "penalty": "Actual penalty amount/consequence",
      "recentChange": "Any recent amendment (optional)",
      "completed": false
    }
  ]
}

IMPORTANT: The key MUST be "items" - do not use any other key name like "checklist" or "compliance".`;

      const response = await openai.chat.completions.create({
        model: MODEL_TIERS.standard,
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Generate a compliance checklist for:
Industry: ${industry}
Jurisdiction: ${jurisdiction}
Activity: ${activity}

Generate 8-12 VERIFIED compliance items with exact legal references. Include any recent changes from the last 6 months.`
          },
        ],
        max_completion_tokens: 3000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "";
      const cost = MODEL_COSTS.standard;

      // Parse the JSON response - AI may use various key names
      let items: any[] = [];
      try {
        const parsed = JSON.parse(content);
        // Check all possible key names the AI might use
        items = parsed.items || parsed.checklist || parsed.complianceChecklist || 
                parsed.compliance || parsed.requirements || parsed.checklistItems ||
                (Array.isArray(parsed) ? parsed : []);
        
        // If still empty, try to find any array in the response
        if (items.length === 0 && typeof parsed === 'object') {
          for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
              items = parsed[key];
              break;
            }
          }
        }
      } catch (parseError) {
        console.error("Failed to parse compliance JSON:", parseError);
        // Return content as-is for client-side parsing
      }

      await storage.addCostEntry({
        type: "compliance_checklist",
        description: `Generated checklist for ${industry} - ${activity}`,
        amount: cost,
        modelUsed: "standard",
      });

      res.json({
        content,
        items,
        sources,
        recentChanges,
        modelUsed: "standard",
        cost,
        verifiedFromPerplexity: !!perplexityContext,
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

  app.patch("/api/research/notes/:id", async (req: Request, res: Response) => {
    try {
      const { name, content } = req.body;
      if (!name && !content) {
        return res.status(400).json({ error: "Name or content is required" });
      }
      const note = await storage.updateResearchNote(req.params.id, { name, content });
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error updating research note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.get("/api/cnr/notes", async (req: Request, res: Response) => {
    try {
      const notes = await storage.getCnrNotes();
      res.json(notes);
    } catch (error) {
      console.error("Error fetching CNR notes:", error);
      res.status(500).json({ error: "Failed to fetch CNR notes" });
    }
  });

  app.post("/api/cnr/notes", async (req: Request, res: Response) => {
    try {
      const parsed = insertCnrNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const note = await storage.createCnrNote(parsed.data);
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating CNR note:", error);
      res.status(500).json({ error: "Failed to create CNR note" });
    }
  });

  app.patch("/api/cnr/notes/:id", async (req: Request, res: Response) => {
    try {
      const partialSchema = insertCnrNoteSchema.partial();
      const parsed = partialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const note = await storage.updateCnrNote(req.params.id, parsed.data);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error updating CNR note:", error);
      res.status(500).json({ error: "Failed to update CNR note" });
    }
  });

  app.delete("/api/cnr/notes/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteCnrNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CNR note:", error);
      res.status(500).json({ error: "Failed to delete CNR note" });
    }
  });

  app.get("/api/cnr/saved-cases", async (req: Request, res: Response) => {
    try {
      const cases = await db.select().from(savedCases).orderBy(desc(savedCases.savedAt));
      res.json(cases);
    } catch (error) {
      console.error("Error fetching saved cases:", error);
      res.status(500).json({ error: "Failed to fetch saved cases" });
    }
  });

  app.post("/api/cnr/saved-cases", async (req: Request, res: Response) => {
    try {
      const parsed = insertSavedCaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const existing = await db.select().from(savedCases).where(eq(savedCases.cnrNumber, parsed.data.cnrNumber));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Case already saved", existingCase: existing[0] });
      }
      const [newCase] = await db.insert(savedCases).values(parsed.data).returning();
      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error saving case:", error);
      res.status(500).json({ error: "Failed to save case" });
    }
  });

  app.delete("/api/cnr/saved-cases/:id", async (req: Request, res: Response) => {
    try {
      await db.delete(savedCases).where(eq(savedCases.id, req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved case:", error);
      res.status(500).json({ error: "Failed to delete saved case" });
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

  app.post("/api/refine", async (req: Request, res: Response) => {
    try {
      const { text, action, customPrompt } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      let refinementInstruction = "";
      switch (action) {
        case "concise":
          refinementInstruction = "Make the text more concise while preserving all legal meaning. Remove redundancy and tighten the language.";
          break;
        case "formal":
          refinementInstruction = "Make the text more formal and professional. Use elevated legal register appropriate for court filings.";
          break;
        case "persuasive":
          refinementInstruction = "Make the text more persuasive and compelling while maintaining legal accuracy. Strengthen the argumentation.";
          break;
        case "judicial":
          refinementInstruction = "Rewrite the text in a judicial tone, as if written by a judge in a court order or judgment. Use measured, authoritative language.";
          break;
        case "custom":
          refinementInstruction = customPrompt || "Improve clarity and legal precision.";
          break;
        default:
          refinementInstruction = "Improve clarity, structure, and professional tone.";
      }

      const systemPrompt = `You are a senior Indian legal drafting assistant.

Task:
Refine the selected text provided by the user.

Rules:
- Do not change legal meaning.
- Improve clarity, structure, and professional tone.
- Use formal, court-appropriate Indian legal language.
- Do not add new facts or law.
- Do not hallucinate statutes or cases.
- Preserve the original document structure, headings, and sequence if the text is a full document.
- Do not use markdown formatting - output clean text without ** symbols or # headers.

Specific refinement instruction: ${refinementInstruction}

Output format:
Return ONLY a JSON object with exactly these two fields:
{
  "refined": "The refined version of the text here",
  "note": "Brief 1-2 line note explaining the improvement"
}

Do not include any other text outside the JSON object.`;

      const response = await openai.chat.completions.create({
        model: MODEL_TIERS.mini,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      });

      const raw = response.choices[0]?.message?.content || "";

      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.json({
            refined: parsed.refined || raw,
            note: parsed.note || "",
          });
        }
      } catch {
        // If JSON parsing fails, return raw text
      }

      res.json({ refined: raw, note: "" });
    } catch (error) {
      console.error("Error refining text:", error);
      res.status(500).json({ error: "Failed to refine text" });
    }
  });

  app.post("/api/voice/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      const result = await elevenLabsTranscribe(req.file.buffer, req.file.originalname || "recording.webm");
      res.json({ text: result.text, language_code: result.language_code });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.post("/api/voice/speak", async (req: Request, res: Response) => {
    try {
      const { text, voiceId } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const client = await getUncachableElevenLabsClient();
      const audioStream = await client.textToSpeech.convert(voiceId || DEFAULT_VOICE_ID, {
        text: text.substring(0, 5000),
        model_id: TTS_MODEL,
        output_format: "mp3_44100_128",
      });

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of audioStream) {
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      console.error("Error generating speech:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  const EMBED_DAILY_LIMIT = 5;
  const { createHash, randomBytes } = await import("crypto");

  function getISTDateString(): string {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split("T")[0];
  }

  function getEmbedVisitorId(req: Request, res: Response): string {
    const ip = req.socket.remoteAddress || "unknown";

    let cookieId = "";
    const cookies = req.headers.cookie?.split(";") || [];
    for (const c of cookies) {
      const [key, val] = c.trim().split("=");
      if (key === "chakshi_embed_vid") {
        cookieId = val || "";
        break;
      }
    }

    if (!cookieId) {
      cookieId = "vid_" + randomBytes(16).toString("hex");
      res.setHeader("Set-Cookie", `chakshi_embed_vid=${cookieId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
    }

    const combined = `${cookieId}_${ip}`;
    return createHash("sha256").update(combined).digest("hex").substring(0, 40);
  }

  app.get("/api/embed/usage", async (req: Request, res: Response) => {
    try {
      const visitorId = getEmbedVisitorId(req, res);
      const today = getISTDateString();

      const existing = await db
        .select()
        .from(embedUsage)
        .where(and(eq(embedUsage.visitorFingerprint, visitorId), eq(embedUsage.usageDate, today)))
        .limit(1);

      const usageCount = existing.length > 0 ? existing[0].usageCount : 0;
      res.json({ used: usageCount, limit: EMBED_DAILY_LIMIT, remaining: Math.max(0, EMBED_DAILY_LIMIT - usageCount) });
    } catch (error) {
      console.error("Error checking embed usage:", error);
      res.json({ used: 0, limit: EMBED_DAILY_LIMIT, remaining: EMBED_DAILY_LIMIT });
    }
  });

  app.post("/api/embed/chat", async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const visitorId = getEmbedVisitorId(req, res);
      const ip = req.socket.remoteAddress || "unknown";
      const today = getISTDateString();

      const existing = await db
        .select()
        .from(embedUsage)
        .where(and(eq(embedUsage.visitorFingerprint, visitorId), eq(embedUsage.usageDate, today)))
        .limit(1);

      const currentCount = existing.length > 0 ? existing[0].usageCount : 0;

      if (currentCount >= EMBED_DAILY_LIMIT) {
        return res.status(429).json({
          error: "Daily usage limit reached",
          message: `You have used all ${EMBED_DAILY_LIMIT} free queries for today. Please try again tomorrow.`,
          used: currentCount,
          limit: EMBED_DAILY_LIMIT,
          remaining: 0,
        });
      }

      if (existing.length > 0) {
        await db
          .update(embedUsage)
          .set({ usageCount: currentCount + 1, updatedAt: new Date() })
          .where(eq(embedUsage.id, existing[0].id));
      } else {
        await db.insert(embedUsage).values({
          visitorFingerprint: visitorId,
          ipAddress: ip,
          usageCount: 1,
          usageDate: today,
        });
      }

      const tier = determineModelTier(message);
      const model = MODEL_TIERS[tier];
      const cost = MODEL_COSTS[tier];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      let kanoonContext = "";
      try {
        const searchResults = await indianKanoon.search(message);
        if (searchResults && searchResults.length > 0) {
          const top5 = searchResults.slice(0, 5);
          kanoonContext = "\n\n--- VERIFIED LEGAL SOURCES (Indian Kanoon) ---\n" +
            top5.map((r: any, i: number) => `[${i + 1}] DocID: ${r.tid || r.docId || "N/A"} | ${r.title}\n${(r.headline || "").replace(/<[^>]*>/g, "").substring(0, 200)}`).join("\n\n");
        }
      } catch (e) {
        console.error("Indian Kanoon search failed for embed:", e);
      }

      const systemPrompt = `You are Nyaya AI, Chakshi's legal research assistant for Indian law. You provide accurate, citation-backed answers about Indian legal matters.

IMPORTANT RULES:
- Provide clear, well-structured answers about Indian law
- Cite specific statutes (Act Name + Year + Section) and case law when relevant
- Only cite from verified sources provided below. Mark any unverified citation as [CITATION NEEDED - VERIFY]
- Use [BLANK] or [TO BE FILLED BY USER] for missing information instead of making up details
- Add this disclaimer where appropriate: "This is legal research information only. No legal opinion or advice is provided. Consult a qualified legal professional."
${kanoonContext}`;

      const openai = new OpenAI();
      const stream = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
        max_tokens: 2000,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      const newUsed = currentCount + 1;
      const citations = kanoonContext
        ? (await indianKanoon.search(message))?.slice(0, 3).map((r: any, i: number) => ({
            id: `embed-cite-${i}`,
            source: r.title || "Indian Kanoon",
            text: (r.headline || "").replace(/<[^>]*>/g, "").substring(0, 200),
          })) || []
        : [];

      res.write(`data: ${JSON.stringify({
        done: true,
        modelUsed: tier,
        confidence: tier === "pro" ? 0.92 : tier === "standard" ? 0.85 : 0.78,
        cost,
        citations,
        usage: { used: newUsed, limit: EMBED_DAILY_LIMIT, remaining: EMBED_DAILY_LIMIT - newUsed },
      })}\n\n`);

      res.end();

      try {
        await storage.addCostEntry({
          type: "embed_chat",
          description: `Embed Nyaya AI chat query`,
          amount: cost,
          modelUsed: model,
        });
      } catch (e) {
        console.error("Failed to log embed cost:", e);
      }
    } catch (error) {
      console.error("Embed chat error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process query" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "An error occurred while processing your query." })}\n\n`);
        res.end();
      }
    }
  });

  return httpServer;
}
