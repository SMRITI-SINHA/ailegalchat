import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { requireAuth } from "./middleware/auth";
import multer from "multer";
import OpenAI from "openai";
import mammoth from "mammoth";
import sanitizeHtmlLib from "sanitize-html";
import { z } from "zod";
import { checkAIUsage, recordAIUsage, getTodayUsage, AI_DAILY_LIMIT, getISTDateString } from "./middleware/aiUsage";
import { logAudit } from "./audit";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, stat } from "fs/promises";
import { createReadStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const execFileAsync = promisify(execFile);

import { storage } from "./storage";
import { insertDocumentSchema, insertDraftSchema, draftTypes, insertResearchNoteSchema, insertCalendarEventSchema, insertCnrNoteSchema, insertSavedCaseSchema, savedCases, embedUsage, type IndianKanoonResult } from "@shared/schema";
import { db, getDb, withUserContext } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { indianKanoon } from "./indian-kanoon";
import { legalWebSearch } from "./legal-web-search";
import { GoogleCalendarService } from "./google-calendar";
import { trainingDataLoader } from "./training-data-loader";
import { inLegalBERT } from "./huggingface";
import { transcribeAudio as openaiTranscribe, generateSpeech as openaiTTS, DEFAULT_VOICE as OPENAI_DEFAULT_VOICE } from "./voice-service";
import * as supabaseStorage from "./supabase-storage";
import { callAI, callAIStream } from "./ai-queue";
import { aiCache } from "./ai-cache";

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
  // Convert table cells to paragraphs BEFORE sanitisation so the text is preserved
  // (legal documents never need real HTML tables; AI sometimes outputs <table> for party sections)
  let preprocessed = html
    .replace(/<t[hd][^>]*>\s*/gi, '<p>')   // open <td>/<th>  → <p>
    .replace(/\s*<\/t[hd]>/gi, '</p>')     // close </td></th> → </p>
    .replace(/<\/?(table|thead|tbody|tfoot|tr|colgroup|col|caption)[^>]*>/gi, ''); // strip wrappers

  // Use sanitize-html with whitelist of safe tags for legal documents
  let sanitized = sanitizeHtmlLib(preprocessed, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'ul', 'ol', 'li', 'div', 'span', 'hr'],
    allowedAttributes: {
      'p': ['style'],
      'div': ['style'],
      'span': ['style'],
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
    
    // Empty line — collapse ALL consecutive blank lines into a single small spacer
    if (trimmedLine === '') {
      while (i + 1 < lines.length && lines[i + 1].trim() === '') {
        i++;
      }
      htmlParts.push('<p style="margin:0;line-height:0.8em;">&nbsp;</p>');
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

// ---------------------------------------------------------------------------
// Fast PDF extraction using the native pdftotext binary (poppler-utils).
// ---------------------------------------------------------------------------
const EXTRACT_TIMEOUT_MS = 25_000; // 25 s hard cap per file
const MAX_TEXT_CHARS = 400_000;    // ~100 k tokens — plenty for AI context

async function extractPdfWithNativeTool(buffer: Buffer, maxPages?: number): Promise<string> {
  const tmpPath = join(tmpdir(), `chakshi-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    await writeFile(tmpPath, buffer);
    const args: string[] = ["-layout", "-nopgbrk", "-q"];
    if (maxPages) { args.push("-l", String(maxPages)); }
    args.push(tmpPath, "-");
    const { stdout } = await execFileAsync("pdftotext", args, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: EXTRACT_TIMEOUT_MS,
    });
    return stdout;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Structured HTML from PDF using pdftohtml -xml (poppler-utils).
// Preserves bold, italic, font-size-based headings — critical for firm style
// training, format templates, and document structure analysis.
// Runs in parallel with extractPdfWithNativeTool (no extra latency).
// Falls back to textToLegalHtml(text) if pdftohtml fails.
// ---------------------------------------------------------------------------
async function extractPdfStructuredHtml(buffer: Buffer, maxPages?: number): Promise<string> {
  const tmpPath = join(tmpdir(), `chakshi-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    await writeFile(tmpPath, buffer);
    const args: string[] = ["-xml", "-stdout", "-q"];
    if (maxPages) { args.push("-l", String(maxPages)); }
    args.push(tmpPath);
    const { stdout: xml } = await execFileAsync("pdftohtml", args, {
      maxBuffer: 30 * 1024 * 1024,
      timeout: EXTRACT_TIMEOUT_MS,
    });
    return xmlToSemanticHtml(xml);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

function xmlToSemanticHtml(xml: string): string {
  // ── 1. Parse <fontspec> entries ───────────────────────────────────────────
  // <fontspec id="0" size="16" family="HELVETICA-Bold" color="#000000"/>
  const fontSizes   = new Map<string, number>();
  const fontIsBold  = new Map<string, boolean>();
  const fontIsItalic = new Map<string, boolean>();

  const fontSpecRe = /<fontspec\s+id="([^"]+)"\s+size="([^"]+)"\s+family="([^"]*)"[^/]*/g;
  let m: RegExpExecArray | null;
  while ((m = fontSpecRe.exec(xml)) !== null) {
    const [, id, size, family] = m;
    fontSizes.set(id,   parseInt(size, 10));
    fontIsBold.set(id,  /bold/i.test(family));
    fontIsItalic.set(id, /italic|oblique/i.test(family));
  }

  // ── 2. Find body font size (most frequent) ────────────────────────────────
  const sizeFreq = new Map<number, number>();
  for (const sz of fontSizes.values()) {
    sizeFreq.set(sz, (sizeFreq.get(sz) || 0) + 1);
  }
  let bodySize = 12;
  let maxFreq = 0;
  for (const [sz, freq] of sizeFreq) {
    if (freq > maxFreq) { maxFreq = freq; bodySize = sz; }
  }
  const h1Threshold = bodySize * 1.45;
  const h2Threshold = bodySize * 1.2;
  const h3Threshold = bodySize * 1.05;

  // ── 3. Parse <text> elements ──────────────────────────────────────────────
  // <text top="100" left="50" width="300" height="14" font="0">Content</text>
  interface Elem {
    top: number; left: number; content: string;
    size: number; bold: boolean; italic: boolean;
  }
  const elems: Elem[] = [];
  const textRe = /<text\s+top="([^"]+)"\s+left="([^"]+)"\s+width="[^"]+"\s+height="[^"]+"\s+font="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = textRe.exec(xml)) !== null) {
    const [, top, left, fontId, rawContent] = m;
    const content = rawContent.replace(/<[^>]+>/g, "").trim();
    if (!content) continue;
    elems.push({
      top:    parseInt(top, 10),
      left:   parseInt(left, 10),
      content,
      size:   fontSizes.get(fontId)   ?? bodySize,
      bold:   fontIsBold.get(fontId)  ?? false,
      italic: fontIsItalic.get(fontId) ?? false,
    });
  }
  if (elems.length === 0) return "";

  // ── 4. Group elements into lines by top position (±4 px tolerance) ────────
  const lines: Elem[][] = [];
  let curLine: Elem[] = [];
  let curTop = -999;
  for (const el of elems) {
    if (Math.abs(el.top - curTop) > 4) {
      if (curLine.length) lines.push(curLine);
      curLine = [el];
      curTop  = el.top;
    } else {
      curLine.push(el);
    }
  }
  if (curLine.length) lines.push(curLine);

  // ── 5. Convert lines to semantic HTML ─────────────────────────────────────
  const CLAUSE_RE = /^(\d+[\.\)]|(?:\d+\.)+\d*|[IVXLCDM]+[\.\)]|\([ivxlcdm]+\)|\([a-z]\)|[a-z][\.\)]|[\-\*\•])\s+/i;

  const htmlParts: string[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);

    const maxSize  = Math.max(...line.map(e => e.size));
    const anyBold  = line.some(e => e.bold);
    const lineText = line.map(e => e.content).join(" ").trim();
    if (!lineText) continue;

    const isUpperCase = lineText === lineText.toUpperCase() && /[A-Z]/.test(lineText);
    const isShortLine = lineText.length > 2 && lineText.length < 90;

    // Build inline content preserving bold/italic per element
    const inline = line.map(e => {
      const t = escapeHtml(e.content);
      if (e.bold && e.italic) return `<strong><em>${t}</em></strong>`;
      if (e.bold)             return `<strong>${t}</strong>`;
      if (e.italic)           return `<em>${t}</em>`;
      return t;
    }).join(" ");

    let tag: string;
    if (maxSize >= h1Threshold && isShortLine) {
      tag = `<h1>${inline}</h1>`;
    } else if (maxSize >= h2Threshold && isShortLine) {
      tag = `<h2>${inline}</h2>`;
    } else if (maxSize >= h3Threshold && anyBold && isShortLine) {
      tag = `<h3>${inline}</h3>`;
    } else if (isUpperCase && anyBold && isShortLine) {
      tag = `<h2>${inline}</h2>`;
    } else if (isUpperCase && isShortLine && maxSize >= bodySize) {
      tag = `<h3>${inline}</h3>`;
    } else if (CLAUSE_RE.test(lineText)) {
      tag = `<p class="clause">${inline}</p>`;
    } else {
      tag = `<p>${inline}</p>`;
    }
    htmlParts.push(tag);
  }
  return htmlParts.join("\n");
}

async function extractDocxFast(buffer: Buffer): Promise<{ text: string; html: string }> {
  // Run once for HTML — derive plain text from the HTML output (saves 40-50% time)
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const rawHtml = htmlResult.value || "";
  const html = sanitizeHtml(rawHtml);
  // Strip tags for plain text
  const text = rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { text, html };
}

async function extractTextFromFile(
  file: Express.Multer.File,
  options: { maxPages?: number; skipStructuredHtml?: boolean } = {},
): Promise<{ text: string; html: string }> {
  const mimeType = file.mimetype.toLowerCase();
  const fileName = file.originalname.toLowerCase();

  const withTimeout = <T>(p: Promise<T>, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`[DOC PROCESSING] Timeout extracting ${label}`)), EXTRACT_TIMEOUT_MS)
      ),
    ]);

  try {
    // ── PDF ──────────────────────────────────────────────────────────────────
    // For routes that need structure (training docs, format templates, drafting
    // reference): run pdftotext + pdftohtml -xml in parallel — zero extra
    // latency. HTML preserves bold, italic, and font-size-based headings.
    //
    // For chat-only routes (DocuChat uploads): skipStructuredHtml=true skips
    // pdftohtml entirely. Chat Q&A only needs plain text; this makes uploads
    // respond 2-4x faster and enables Start Chat sooner.
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      if (options.skipStructuredHtml) {
        const raw = await withTimeout(
          extractPdfWithNativeTool(file.buffer, options.maxPages),
          fileName,
        );
        const text = raw.slice(0, MAX_TEXT_CHARS);
        return { text, html: textToLegalHtml(text) };
      }

      const [raw, structuredHtml] = await withTimeout(
        Promise.all([
          extractPdfWithNativeTool(file.buffer, options.maxPages),
          extractPdfStructuredHtml(file.buffer, options.maxPages).catch((err) => {
            console.warn("[DOC PROCESSING] pdftohtml fallback:", err?.message);
            return null;
          }),
        ]),
        fileName,
      );
      const text = raw.slice(0, MAX_TEXT_CHARS);
      const html = structuredHtml && structuredHtml.length > 20
        ? structuredHtml
        : textToLegalHtml(text);
      return { text, html };
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await withTimeout(extractDocxFast(file.buffer), fileName);
      return { text: result.text.slice(0, MAX_TEXT_CHARS), html: result.html };
    }

    // ── DOC (legacy) ─────────────────────────────────────────────────────────
    if (mimeType === "application/msword" || fileName.endsWith(".doc")) {
      const isOldDoc =
        file.buffer.length >= 4 &&
        file.buffer[0] === 0xd0 &&
        file.buffer[1] === 0xcf &&
        file.buffer[2] === 0x11 &&
        file.buffer[3] === 0xe0;

      if (isOldDoc) {
        const msg = `"${file.originalname}" is in the old .doc format (Word 97-2003). Please save it as .docx and try again.`;
        console.warn("[DOC PROCESSING] Old .doc format rejected");
        return { text: msg, html: `<p style="color:#f59e0b">${msg}</p>` };
      }
      try {
        const result = await withTimeout(extractDocxFast(file.buffer), fileName);
        return { text: result.text.slice(0, MAX_TEXT_CHARS), html: result.html };
      } catch {
        const msg = `"${file.originalname}" could not be read. Please convert it to .docx and try again.`;
        return { text: msg, html: `<p style="color:#f59e0b">${msg}</p>` };
      }
    }

    // ── Plain text ───────────────────────────────────────────────────────────
    if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
      const text = file.buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS);
      return { text, html: textToLegalHtml(text) };
    }

    return {
      text: `[Unsupported file format: ${mimeType}]`,
      html: `<p>[Unsupported file format: ${mimeType}]</p>`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DOC PROCESSING] Extraction error:", msg);
    return { text: "[Error extracting text from document]", html: "<p>[Error extracting text from document]</p>" };
  }
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed. Please upload a PDF, Word document, or image.`));
    }
  },
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL }
    : {}),
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

function sendSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function trimPromptText(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}\n[TRUNCATED FOR TOKEN EFFICIENCY]` : value;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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

  const PUBLIC_PATH_PREFIXES = [
    "/embed/",
    "/voice/transcribe",
    "/voice/speak",
    "/calendar/google/callback",
  ];

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const isPublic = PUBLIC_PATH_PREFIXES.some(
      (p) => req.path === p || req.path.startsWith(p)
    );
    if (isPublic) {
      return next();
    }
    return requireAuth(req, res, next);
  });

  // After authentication, bind a dedicated database connection to this request
  // inside an open transaction and set app.current_user_id as a transaction-LOCAL
  // variable (is_local=true / SET LOCAL). The setting is automatically cleared
  // when the transaction commits or rolls back, so a stale user ID can never leak
  // to a later request that reuses the same pooled connection.
  //
  // withUserContext() manages the connection lifecycle (BEGIN → SET LOCAL →
  // callback → COMMIT/ROLLBACK → release). The Promise resolves when the HTTP
  // response finishes, keeping the transaction open for the full request duration.
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    withUserContext(userId, () =>
      new Promise<void>((resolve, reject) => {
        res.on("finish", resolve);
        res.on("close", reject);
        next();
      }),
    ).catch(() => {
      // Errors from route handlers are already handled by Express error middleware.
      // We only suppress the rejection here to avoid an unhandled-promise warning
      // on the withUserContext wrapper itself.
    });
  });

  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const documents = await storage.getDocuments(req.user!.id);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id, req.user!.id);
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

      const userId = req.user!.id;

      // Phase 1: Create DB records immediately with "processing" status.
      // Text extraction (pdftotext) can take 5–30 s for large files and must
      // NOT block the HTTP response — the client polls GET /api/documents/:id
      // until status changes to "completed".
      const uploadsDir = join(process.cwd(), 'uploads');
      await mkdir(uploadsDir, { recursive: true }).catch(() => {});

      const pendingDocs = await Promise.all(
        files.map(async (file) => {
          const decodedName = decodeFilename(file.originalname);
          const doc = await storage.createDocument({
            userId,
            name: decodedName,
            type: file.mimetype,
            size: file.size,
            pages: 0,
            status: "processing",
            processingCost: 0,
            summary: null,
            extractedText: null,
            extractedHtml: null,
            storagePath: null,
            storageUrl: null,
          });
          // Save raw bytes immediately so /api/documents/:id/file works right away
          const localPath = join(uploadsDir, doc.id);
          try {
            await writeFile(localPath, file.buffer);
            await storage.updateDocument(doc.id, { storagePath: localPath });
          } catch (e: any) {
            console.warn(`[DOC] Local file save failed for ${doc.id}: ${e.message}`);
          }
          return { ...doc, storagePath: localPath };
        })
      );

      // Respond immediately — client shows "processing" and polls for completion.
      res.status(201).json(pendingDocs.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        pages: doc.pages,
        status: doc.status,
        processingCost: doc.processingCost,
        uploadedAt: doc.uploadedAt,
      })));

      // Phase 2: Extract text + enrich in background (runs after response is sent).
      for (const [i, doc] of pendingDocs.entries()) {
        const file = files[i];
        (async () => {
          try {
            const extracted = await extractTextFromFile(file, { maxPages: 100, skipStructuredHtml: true });
            // Try to get the real PDF page count via pdfinfo (more accurate than char/3000 estimate)
            let pageCount = Math.max(1, Math.ceil(extracted.text.length / 3000));
            if (file.mimetype === 'application/pdf' && doc.storagePath) {
              try {
                const { stdout } = await execFileAsync('pdfinfo', [doc.storagePath], { timeout: 5000 });
                const m = stdout.match(/Pages:\s+(\d+)/i);
                if (m) pageCount = parseInt(m[1], 10);
              } catch { /* keep text-length estimate */ }
            }
            const cost = 0.50 + (pageCount * 0.01);

            const updates: Record<string, unknown> = {
              extractedText: extracted.text,
              extractedHtml: extracted.html,
              pages: pageCount,
              status: "completed",
              processingCost: parseFloat(cost.toFixed(2)),
            };

            // Supabase cloud backup
            if (supabaseStorage.isSupabaseConfigured()) {
              try {
                const uploaded = await withTimeout(
                  supabaseStorage.uploadDocument(userId, doc.id, file),
                  10000,
                  null,
                );
                if (uploaded) {
                  updates.storagePath = uploaded.path;
                  updates.storageUrl = uploaded.signedUrl;
                }
              } catch (e: any) {
                console.warn(`[DOC BG] Supabase upload failed for doc ${doc.id}: ${e.message}`);
              }
            }

            // InLegalBERT structural classification
            if (inLegalBERT.isConfigured() && extracted.text.length > 100) {
              try {
                const segments = await withTimeout(inLegalBERT.classifySegments(extracted.text), 8000, []);
                if (segments.length > 0) {
                  const segmentSummary = segments.map((s: any) => `[${s.label}] ${s.text.substring(0, 100)}`).join("\n");
                  updates.extractedText = `=== DOCUMENT STRUCTURE (InLegalBERT Analysis) ===\n${segmentSummary}\n=== END STRUCTURE ===\n\n${extracted.text}`;
                  console.log(`[DOC BG] InLegalBERT classified ${segments.length} segments for doc ${doc.id}`);
                }
              } catch (e) {
                console.warn(`[DOC BG] InLegalBERT failed for doc ${doc.id}`);
              }
            }

            await storage.updateDocument(doc.id, updates);
            await storage.addCostEntry({
              type: "document_processing",
              description: `Processed document (${pageCount} pages)`,
              amount: cost,
              modelUsed: "mini",
            });
            console.log(`[DOC] Processed: ${doc.name} (${pageCount} pages)`);

            logAudit(req, {
              action: "document_upload",
              resourceType: "document",
              resourceId: doc.id,
              success: true,
              metadata: { fileType: file.mimetype, sizeBytes: file.size, pages: pageCount },
            });
          } catch (e: any) {
            console.error(`[DOC] Extraction failed for ${doc.name}:`, e.message);
            await storage.updateDocument(doc.id, { status: "failed" }).catch(() => {});
          }
        })().catch(e => console.warn(`[DOC BG] Unhandled error for doc ${doc.id}: ${e.message}`));
      }
    } catch (error) {
      console.error("[AUDIT] Error uploading documents");
      logAudit(req, { action: "document_upload", resourceType: "document", success: false, errorCode: "UPLOAD_FAILED" });
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // Serve the raw uploaded file — used by the doc panel iframe viewer.
  // Priority: local disk (fast, cached) → Supabase signed URL (redirect for production).
  app.get("/api/documents/:id/file", requireAuth, async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(req.params.id, req.user!.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });

      // Try local disk first (always available in dev; may survive short container restarts in prod)
      if (doc.storagePath) {
        const localOk = await stat(doc.storagePath).then(() => true).catch(() => false);
        if (localOk) {
          const safeName = doc.name.replace(/["\\]/g, "_");
          res.setHeader("Content-Type", doc.type || "application/octet-stream");
          res.setHeader("Cache-Control", "private, max-age=3600");
          res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
          return createReadStream(doc.storagePath).pipe(res);
        }
      }

      // Fallback: redirect to Supabase signed URL (production after container restart)
      if (doc.storageUrl) {
        return res.redirect(302, doc.storageUrl);
      }

      return res.status(404).json({ error: "File not available — please re-upload the document" });
    } catch (error) {
      console.error("[DOC FILE] Serve error:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(req.params.id, req.user!.id);
      if (doc?.storagePath && supabaseStorage.isSupabaseConfigured()) {
        try {
          await supabaseStorage.deleteFile(doc.storagePath);
        } catch (e: unknown) {
          console.warn(`[DOC DELETE] Supabase file deletion failed, continuing: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await storage.deleteDocument(req.params.id, req.user!.id);
      logAudit(req, {
        action: "document_delete",
        resourceType: "document",
        resourceId: req.params.id,
        success: true,
      });
      res.status(204).send();
    } catch (error) {
      console.error("[AUDIT] Error deleting document");
      logAudit(req, { action: "document_delete", resourceType: "document", resourceId: req.params.id, success: false, errorCode: "DELETE_FAILED" });
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.get("/api/chat/sessions", async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getChatSessions(req.user!.id);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/chat/sessions", async (req: Request, res: Response) => {
    try {
      // Validate that any provided document IDs belong to this user
      const rawDocumentIds: string[] = req.body.documentIds || [];
      const verifiedDocumentIds: string[] = [];
      for (const docId of rawDocumentIds) {
        const doc = await storage.getDocument(docId, req.user!.id);
        if (doc) verifiedDocumentIds.push(docId);
      }

      const session = await storage.createChatSession({
        userId: req.user!.id,
        title: req.body.title || "New Chat",
        sessionType: req.body.sessionType || "general",
        documentIds: verifiedDocumentIds,
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
      await storage.deleteChatSession(req.params.id, req.user!.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.get("/api/chat/sessions/:id/messages", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getChatMessages(req.params.id, req.user!.id);
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
      const session = await storage.getChatSession(sessionId, req.user!.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const message = await storage.createChatMessage({ userId: req.user!.id, sessionId, role, content });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/chat/query", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const chatQuerySchema = z.object({
        message: z.string().min(1, "Message is required").max(5000, "Input too long — please shorten your text"),
        sessionId: z.string().optional(),
        documentIds: z.array(z.string()).optional(),
        includeSources: z.boolean().optional(),
        voiceLanguage: z.string().optional(),
      });
      const parsed = chatQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { message, sessionId, documentIds, includeSources, voiceLanguage } = parsed.data;

      // Verify session ownership before starting the stream — reject unknown/unowned sessions early
      if (sessionId) {
        const ownedSession = await storage.getChatSession(sessionId, req.user!.id);
        if (!ownedSession) {
          return res.status(403).json({ error: "Session not found or access denied" });
        }
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
          documentIds.map((id: string) => storage.getDocument(id, req.user!.id))
        );
        const validDocs = docs.filter((d) => d !== null && d !== undefined);
        if (validDocs.length > 0) {
          // Build document context with smart truncation for large documents
          const docParts: string[] = [];
          const textDocs = validDocs.filter((d) => d!.extractedText);
          const charsPerDoc = textDocs.length > 0
            ? Math.floor(MAX_DOC_CONTEXT_CHARS / textDocs.length)
            : MAX_DOC_CONTEXT_CHARS;
          
          for (const doc of validDocs) {
            const docText = doc!.extractedText || "";
            const docName = doc!.name;
            const estimatedPages = doc!.pages
              || (docText ? Math.max(1, Math.round(docText.length / 3000)) : 1);

            // Scanned / no-text document — give the AI metadata so it can still cite pages
            if (!docText) {
              docParts.push(
                `=== Document: ${docName} (${estimatedPages} pages — scanned image, text not available) ===\n` +
                `This document could not be parsed as text (likely a scanned image or encrypted PDF).\n` +
                `Total pages: ${estimatedPages}.\n` +
                `When referencing information from this document, cite pages by their likely structural position ` +
                `(e.g., cover page → [Page 1], middle section → [Page ${Math.ceil(estimatedPages / 2)}], ` +
                `conclusion → [Page ${estimatedPages}]) and clearly state that the content is inferred from document structure, not extracted text.`
              );
              continue;
            }
            
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
          withTimeout(indianKanoon.search(message, 0), 5000, []).then(searchResults => {
            if (searchResults.length > 0) {
              const topResults = searchResults.slice(0, 5);
              indianKanoonContext = "\n\n=== Case Law & Statutes from Indian Kanoon ===\n";
              
              for (const result of topResults) {
                citationIndex++;
                indianKanoonContext += `\n[${citationIndex}] ${result.title}\n`;
                if (result.headline) {
                  indianKanoonContext += `   Excerpt: ${result.headline.replace(/<[^>]*>/g, "").substring(0, 120)}...\n`;
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
          withTimeout(legalWebSearch.searchLegal(message), 5000, { answer: null, sources: [] }).then(({ answer, sources }) => {
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
      
      // Load training context in parallel with IK + web searches
      let chakshiTrainingKnowledge = "";
      searchPromises.push(
        withTimeout(trainingDataLoader.getTrainingContext(), 3000, "")
          .then(ctx => { chakshiTrainingKnowledge = ctx; })
          .catch(() => console.log("[NYAYA AI] Training data loader failed, continuing without training context"))
      );
      await Promise.all(searchPromises);

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
        const stream = await callAIStream(openai, {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          stream: true,
          max_completion_tokens: 4096,
        }, "nyaya-chat");

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

        // Save messages to storage if session exists and belongs to this user
        if (sessionId) {
          const ownedSession = await storage.getChatSession(sessionId, req.user!.id);
          if (ownedSession) {
            await storage.createChatMessage({
              userId: req.user!.id,
              sessionId,
              role: "user",
              content: message,
            });
            await storage.createChatMessage({
              userId: req.user!.id,
              sessionId,
              role: "assistant",
              content: fullContent,
              modelUsed: tier,
              confidence: parseFloat(confidence.toFixed(2)),
              cost,
              citations: JSON.stringify(citations),
            });
            const updatedMessages = await storage.getChatMessages(sessionId, req.user!.id);
            await storage.updateChatSession(sessionId, { messageCount: updatedMessages.length });
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

        await recordAIUsage(req);
        res.end();
      } catch (aiError) {
        console.error("[AI] Chat query error occurred");
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

  app.post("/api/nyaya/detect-draft", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ message: z.string().min(1).max(2000) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.json({ isDraft: false, questions: [] });
      const { message } = parsed.data;

      const systemPrompt = `You are a legal AI assistant. Determine if the user's message is asking you to DRAFT/WRITE/PREPARE/CREATE a specific legal document.

Return ONLY a valid JSON object.

If it IS a drafting request:
{
  "isDraft": true,
  "documentType": "e.g. Non-Disclosure Agreement / Legal Notice / Bail Application / Writ Petition",
  "suggestedTitle": "A concise, specific title for this document",
  "questions": [
    {
      "id": "snake_case_id",
      "label": "Question text shown to the user",
      "type": "text | textarea | select | multi_select | radio",
      "options": ["opt1", "opt2"],
      "placeholder": "example placeholder",
      "required": true,
      "hint": "optional helper text"
    }
  ]
}

If NOT a drafting request: { "isDraft": false, "questions": [] }

Question generation rules:
- Always include: parties involved, jurisdiction, key facts, relief/purpose sought
- For jurisdiction use type "select" with options: ["Delhi High Court", "Bombay High Court", "Madras High Court", "Calcutta High Court", "Allahabad High Court", "Karnataka High Court", "Punjab & Haryana High Court", "Gujarat High Court", "Rajasthan High Court", "Supreme Court of India", "NCLT", "Consumer Forum", "Family Court", "District Court", "Any / Not Applicable"]
- For language use type "select" with options: ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi"]
- Use "radio" for 2-5 binary/small choices, "select" for large lists, "textarea" for detailed info, "multi_select" for picking multiple items
- Tailor questions specifically to the document type (e.g. for NDA include confidentiality period, for bail include offence and court)
- Maximum 6 questions — keep it concise and actionable
- Mark all critical fields as required: true`;

      const response = await callAI(openai, {
        model: MODEL_TIERS.mini,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.2,
      }, "detect-draft");

      const raw = response.choices[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        await recordAIUsage(req);
        return res.json(result);
      }
      res.json({ isDraft: false, questions: [] });
    } catch (error) {
      console.error("Error detecting draft intent:", error);
      res.json({ isDraft: false, questions: [] });
    }
  });

  app.get("/api/drafts", async (req: Request, res: Response) => {
    try {
      const drafts = await storage.getDrafts(req.user!.id);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  app.get("/api/drafts/:id", async (req: Request, res: Response) => {
    try {
      const draft = await storage.getDraft(req.params.id, req.user!.id);
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
      const parsed = insertDraftSchema.safeParse({ ...req.body, userId: req.user!.id });
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

  app.post("/api/drafts/generate", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const draftGenerateSchema = z.object({
        type: z.string().min(1, "Type is required"),
        facts: z.string().min(1, "Facts are required").max(10000, "Input too long — please shorten your text"),
        title: z.string().optional(),
        parties: z.string().optional(),
        jurisdiction: z.string().optional(),
        additionalInfo: z.string().optional(),
        language: z.string().optional(),
        additionalPrompts: z.string().optional(),
        formatReference: z.any().optional(),
        formatHtml: z.string().optional(),
        useFirmStyle: z.boolean().optional(),
        documentTypeDetails: z.any().optional(),
        documentSubType: z.string().optional(),
        stream: z.boolean().optional(),
      });
      const parsed = draftGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { type, title, facts, parties, jurisdiction, additionalInfo, language, additionalPrompts, formatReference, formatHtml, useFirmStyle, documentTypeDetails, documentSubType, stream } = parsed.data;

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
      const userId = req.user!.id;

      // When firm style is not enabled, use Chakshi's 2000+ document training data
      let chakshiTrainingContext = "";

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
${trimPromptText(formatHtml, 1800)}
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
      const expertDraftingPrompt = `You are a cautious senior Indian advocate. Prioritize legal correctness, procedural safety, and court survivability.

Core rules:
- Do not fabricate facts, statutes, case names, reporters, dates, or recent judgments.
- Prefer uncertainty over false confidence; flag unclear/evolving law.
- Authority hierarchy: Statute > Case Law > Commentary. Cite statutes first.
- Use [BLANK] or [TO BE FILLED BY USER] for missing facts.
- Unverified authorities must be omitted or marked "[CITATION NEEDED - VERIFY]".

Mandatory document blocks:
1. FORUM / COURT
2. PARTIES & DESCRIPTION
3. JURISDICTION & MAINTAINABILITY
4. FACTS IN CHRONOLOGY, numbered, each pleading paragraph starting with "That"
5. LEGAL BASIS, statutes first and verified case law only
6. RELIEF / PRAYER
7. PROCEDURAL CLOSURE, verification, signatures, place, date

Citation format:
- Statute: Section + Act Name + Year.
- Case: Case Name + Court + Year + Reporter if available.

Self-check before final output: jurisdiction, limitation, maintainability, specific relief, internal consistency, missing facts.
If defects remain, flag them at the end.

Output clean plain text only. No markdown symbols.`;

      // ============================================
      // LEGAL RESEARCH LAYER — ALL STAGES IN PARALLEL
      // ============================================
      // Layer 0: InLegalBERT + Layer 1: Indian Kanoon (base query) +
      // Layer 2: Perplexity + Firm style / training context
      // — launched together, not sequentially
      
      let indianKanoonContext = "";
      let perplexityRiskContext = "";
      let inLegalBERTContext = "";

      const baseSearchTerms = `${type} ${facts.substring(0, 300)} ${jurisdiction || ""} ${documentTypeDetails?.subtypeLabel || ""}`.trim();
      const riskQuery = `Recent amendments, notifications, or judicial developments affecting ${type} in India ${jurisdiction || ""} ${new Date().getFullYear()}`;
      const documentTypeForTraining = documentTypeDetails?.subtypeLabel || type;

      console.log("[DRAFTING PIPELINE] Launching parallel: BERT + IK base + Perplexity + style/training...");

      const [draftBertSettled, draftBaseIKSettled, draftPerplexitySettled, draftStyleSettled] = await Promise.allSettled([
        inLegalBERT.isConfigured()
          ? withTimeout(inLegalBERT.identifyStatutes(facts), 5000, [])          // Layer 0: BERT statute pre-id
          : Promise.resolve([]),
        indianKanoon.isConfigured()
          ? withTimeout(indianKanoon.search(baseSearchTerms, 0), 5000, [])      // Layer 1: primary authority
          : Promise.resolve([]),
        legalWebSearch.isConfigured()
          ? withTimeout(legalWebSearch.searchLegal(riskQuery), 5000, null)      // Layer 2: advisory only
          : Promise.resolve(null),
        useFirmStyle
          ? storage.getTrainingDocs(userId)
          : withTimeout(trainingDataLoader.getDraftingGuidelines(documentTypeForTraining), 3000, ""), // Firm SOP
      ]);

      // Process BERT results (Layer 0)
      const identifiedStatutes = draftBertSettled.status === "fulfilled" ? draftBertSettled.value : [];
      const bertEnhancedQueries = identifiedStatutes.slice(0, 3).map(s => s.statute);
      if (identifiedStatutes.length > 0) {
        inLegalBERTContext = `\n\n=== InLegalBERT STATUTE ANALYSIS (AI Pre-Identification) ===\nThe following statutes were identified as potentially relevant to the facts:\n`;
        identifiedStatutes.forEach((s, i) => {
          inLegalBERTContext += `${i + 1}. ${s.statute} (confidence: ${(s.confidence * 100).toFixed(1)}%)\n`;
        });
        inLegalBERTContext += `\nUse these as guidance for which statutes to cite. All citations must still be verified from Indian Kanoon results below.\n===`;
        console.log(`[DRAFTING PIPELINE] InLegalBERT identified ${identifiedStatutes.length} statutes`);
      }

      // Collect base IK results; fire BERT-enhanced IK queries in parallel if available (Layer 1)
      let allDraftResults: IndianKanoonResult[] = draftBaseIKSettled.status === "fulfilled" ? (draftBaseIKSettled.value || []) : [];
      if (bertEnhancedQueries.length > 0 && indianKanoon.isConfigured()) {
        console.log("[DRAFTING PIPELINE] Running BERT-enhanced IK queries in parallel...");
        const bertIKSettled = await Promise.allSettled(
          bertEnhancedQueries.map(q => withTimeout(indianKanoon.search(q, 0), 3000, []))
        );
        const seenDocIds = new Set(allDraftResults.map(r => r.docId));
        for (const r of bertIKSettled) {
          if (r.status === "fulfilled") {
            for (const doc of r.value) {
              if (!seenDocIds.has(doc.docId)) { seenDocIds.add(doc.docId); allDraftResults.push(doc); }
            }
          }
        }
      }

      if (allDraftResults.length > 0) {
        let rankedResults = allDraftResults;
        if (inLegalBERT.isConfigured() && allDraftResults.length > 3) {
          try {
            const docsToRank = allDraftResults.slice(0, 15).map(r => ({
              id: r.docId, title: r.title, text: r.headline?.replace(/<[^>]*>/g, "") || r.title,
            }));
            const ranked = await withTimeout(inLegalBERT.rankByRelevance(facts.substring(0, 500), docsToRank), 2000, null);
            if (ranked) {
              rankedResults = ranked.map(rd => {
                const original = allDraftResults.find(r => r.docId === rd.id);
                return { ...original!, relevanceScore: rd.relevanceScore };
              });
            }
          } catch {
            console.log("[DRAFTING PIPELINE] InLegalBERT ranking failed, using default order");
          }
        }
        indianKanoonContext = `\n\n=== PRIMARY LEGAL AUTHORITY (Indian Kanoon - Verified Sources) ===
USE THESE CITATIONS ONLY. Do not invent or modify these references.

`;
        rankedResults.slice(0, 5).forEach((result: any, index: number) => {
          const cleanSnippet = result.headline?.replace(/<[^>]*>/g, "").substring(0, 120) || "";
          const relevanceTag = result.relevanceScore ? ` [Relevance: ${(result.relevanceScore * 100).toFixed(0)}%]` : "";
          indianKanoonContext += `[${index + 1}] ${result.title}${relevanceTag}\n   DocID: ${result.docId} | Excerpt: ${cleanSnippet}...\n\n`;
        });
        indianKanoonContext += `\nIMPORTANT: Only cite cases/statutes from the above list. If a case is not listed here, mark it as "[CITATION NEEDED - VERIFY]".`;
        console.log(`[DRAFTING PIPELINE] IK: ${allDraftResults.length} results`);
      }

      // Process Perplexity results (Layer 2)
      const draftPerplexityResult = draftPerplexitySettled.status === "fulfilled" ? draftPerplexitySettled.value : null;
      if (draftPerplexityResult?.answer) {
        const sourcesList = draftPerplexityResult.sources?.length > 0
          ? draftPerplexityResult.sources.slice(0, 3).map((s: any) => s?.source || "Unknown").join(", ")
          : "Web search";
        perplexityRiskContext = `\n\n=== CURRENCY & RISK SIGNALS (Advisory - Verify Independently) ===
The following are recent developments that MAY affect this document. These are for awareness only - do NOT cite as authority.

${draftPerplexityResult.answer.substring(0, 900)}

Sources checked: ${sourcesList}

NOTE: This is advisory information only. Recent amendments/notifications should be verified from official gazettes before relying on them.
===`;
      }

      // Process firm style / training context (fetched in the parallel batch above)
      const draftStyleResult = draftStyleSettled.status === "fulfilled" ? draftStyleSettled.value : null;
      if (useFirmStyle && Array.isArray(draftStyleResult) && draftStyleResult.length > 0) {
        trainedStyleContext = "\n\nTRAINED FIRM STYLE REFERENCE:\nMatch the writing style, tone, document structure, and formatting from these sample documents. Pay special attention to:\n- How sections and clauses are numbered\n- Heading styles and hierarchy\n- Legal terminology usage\n- Formatting patterns (indentation, spacing)\n\n";
        for (const doc of draftStyleResult.slice(0, 2)) {
          const structuredContent = doc.extractedHtml || doc.content;
          if (structuredContent) {
            trainedStyleContext += `=== ${doc.name} (Structure Reference) ===\n${trimPromptText(structuredContent, 1000)}\n\n`;
          }
        }
        trainedStyleContext += "\nAdapt the exact format, structure, and tone from these samples to maintain firm consistency.";
      } else if (!useFirmStyle && typeof draftStyleResult === "string" && draftStyleResult) {
        chakshiTrainingContext = `\n\n=== CHAKSHI TRAINING DATA (2000+ Legal Documents) ===\n${draftStyleResult}\n`;
      }

      // Combine research context (Layer 0 + Layer 1 + Layer 2)
      const researchContext = inLegalBERTContext + indianKanoonContext + perplexityRiskContext;
      
      let systemPrompt = selectedLanguage !== "English"
        ? `${expertDraftingPrompt}\n\nCRITICAL LANGUAGE REQUIREMENT: You are completely fluent in ${selectedLanguage} and must generate the ENTIRE document in ${selectedLanguage} with perfect grammar and appropriate legal terminology in that language. Only use English for proper nouns, specific case citations (like "AIR 2023 SC 456"), or official statute names. All section headings, content, and legal arguments must be in ${selectedLanguage}.`
        : expertDraftingPrompt;
      
      // Add format override to system prompt if a format template was provided
      if (formatSystemOverride) {
        systemPrompt += formatSystemOverride;
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const aiStream = await callAIStream(openai, {
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            { role: "user", content: prompt + researchContext },
          ],
          stream: true,
          max_completion_tokens: 4096,
        }, "draft-generate-stream");

        let content = "";
        for await (const chunk of aiStream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            content += delta;
            sendSse(res, "chunk", { content: delta });
          }
        }

        const cost = tier === "standard" ? 1.50 : 0.80;
        const draft = await storage.createDraft({
          userId: req.user!.id,
          title: draftTitle,
          type,
          content,
          status: "completed",
          modelUsed: tier,
          sessionId: null,
        });

        await storage.addCostEntry({
          type: "draft_generation",
          description: `Generated ${type} draft`,
          amount: cost,
          modelUsed: tier,
        });

        await recordAIUsage(req);
        logAudit(req, {
          action: "draft_generate",
          resourceType: "draft",
          resourceId: draft.id,
          success: true,
          metadata: { draftType: type, modelTier: tier, language: selectedLanguage, streamed: true },
        });

        sendSse(res, "done", { draft });
        res.end();
        return;
      }

      const response = await callAI(openai, {
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt + researchContext },
        ],
        max_completion_tokens: 4096,
      }, "draft-generate");

      const content = response.choices[0]?.message?.content || "";
      const cost = tier === "standard" ? 1.50 : 0.80;

      const draft = await storage.createDraft({
        userId: req.user!.id,
        title: draftTitle,
        type,
        content,
        status: "completed",
        modelUsed: tier,
        sessionId: null,
      });

      await storage.addCostEntry({
        type: "draft_generation",
        description: `Generated ${type} draft`,
        amount: cost,
        modelUsed: tier,
      });

      await recordAIUsage(req);
      logAudit(req, {
        action: "draft_generate",
        resourceType: "draft",
        resourceId: draft.id,
        success: true,
        metadata: { draftType: type, modelTier: tier, language: selectedLanguage },
      });


      res.status(201).json(draft);
    } catch (error) {
      console.error("[AUDIT] Error generating draft");
      logAudit(req, { action: "draft_generate", resourceType: "draft", success: false, errorCode: "GENERATION_FAILED" });
      if (res.headersSent) {
        sendSse(res, "error", { error: "Failed to generate draft" });
        res.end();
        return;
      }
      res.status(500).json({ error: "Failed to generate draft" });
    }
  });

  app.patch("/api/drafts/:id", async (req: Request, res: Response) => {
    try {
      const { content, status } = req.body;
      const draft = await storage.updateDraft(req.params.id, req.user!.id, { content, status });
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
      await storage.deleteDraft(req.params.id, req.user!.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ error: "Failed to delete draft" });
    }
  });

  app.post("/api/drafts/translate", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const translateSchema = z.object({
        content: z.string().min(1, "Content is required").max(80000, "Input too long — please shorten your text"),
        targetLanguage: z.string().min(1, "Target language is required"),
      });
      const parsed = translateSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { content, targetLanguage } = parsed.data;

      const systemPrompt = `You are a professional legal translator fluent in all Indian languages. Translate the following legal document to ${targetLanguage}. 
Maintain the exact structure, formatting, section numbers, and legal terminology.
Only translate the content - do not add explanations or comments.
For proper nouns, case citations, and official statute names, keep them in their original form.
Ensure the translation is accurate and uses appropriate legal terminology in ${targetLanguage}.`;

      const response = await callAI(openai, {
        model: MODEL_TIERS.standard,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Translate this legal document to ${targetLanguage}:\n\n${content}` },
        ],
        max_completion_tokens: 4000,
      }, "draft-translate");

      const translatedContent = response.choices[0]?.message?.content || content;

      await storage.addCostEntry({
        type: "translation",
        description: `Translated document to ${targetLanguage}`,
        amount: MODEL_COSTS.standard,
        modelUsed: "standard",
      });

      await recordAIUsage(req);
      res.json({ translatedContent, language: targetLanguage });
    } catch (error) {
      console.error("Error translating document:", error);
      res.status(500).json({ error: "Failed to translate document" });
    }
  });

  // AI Assistance endpoint for quick legal content generation
  app.post("/api/drafts/assist", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const assistSchema = z.object({
        prompt: z.string().min(1, "Prompt is required").max(10000, "Input too long — please shorten your text"),
        context: z.string().max(80000, "Input too long — please shorten your text").optional(),
      });
      const parsed = assistSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { prompt, context } = parsed.data;

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

      const response = await callAI(openai, {
        model: MODEL_TIERS.mini,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 2000,
      }, "draft-assist");

      const generatedContent = response.choices[0]?.message?.content || "";

      await storage.addCostEntry({
        type: "ai_assistance",
        description: `AI assistance: ${prompt.slice(0, 50)}...`,
        amount: MODEL_COSTS.standard,
        modelUsed: "standard",
      });

      await recordAIUsage(req);
      res.json({ content: generatedContent });
    } catch (error) {
      console.error("Error in AI assistance:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  // Training Documents API endpoints
  app.get("/api/training-docs", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Step 1: Create doc records immediately with "processing" status so the
      // client sees them right away and they survive any request timeout.
      const pendingDocs = await Promise.all(
        files.map(async (file) => {
          const decodedName = decodeFilename(file.originalname);
          return storage.createTrainingDoc({
            userId,
            name: decodedName,
            type: file.mimetype,
            size: file.size,
            content: null,
            extractedHtml: null,
            status: "processing",
            storagePath: null,
            storageUrl: null,
          });
        })
      );

      // Step 2: Respond immediately — the client can start polling.
      res.status(201).json(pendingDocs);

      // Step 3: Process extraction in the background (non-blocking).
      // Errors here only affect the doc's final status, not the HTTP response.
      setImmediate(async () => {
        await Promise.all(
          pendingDocs.map(async (doc, i) => {
            const file = files[i];
            try {
              const extracted = await extractTextFromFile(file, { maxPages: 20 });

              let storagePath: string | null = null;
              let storageUrl: string | null = null;
              if (supabaseStorage.isSupabaseConfigured()) {
                try {
                  const uploaded = await supabaseStorage.uploadTrainingDoc(userId, doc.id, file);
                  storagePath = uploaded.path;
                  storageUrl = uploaded.signedUrl;
                } catch (e: any) {
                  console.warn(`[TRAINING DOC UPLOAD] Supabase upload failed for ${doc.name}: ${e.message}`);
                }
              }

              await storage.updateTrainingDoc(doc.id, {
                content: extracted.text,
                extractedHtml: extracted.html,
                status: "completed",
                storagePath,
                storageUrl,
              });
              console.log(`[TRAINING DOC] Processed: ${doc.name}`);
            } catch (e: any) {
              console.error(`[TRAINING DOC] Extraction failed for ${doc.name}:`, e.message);
              await storage.updateTrainingDoc(doc.id, { status: "pending" }).catch(() => {});
            }
          })
        );
      });
    } catch (error) {
      console.error("Error uploading training docs:", error);
      res.status(500).json({ error: "Failed to upload training documents" });
    }
  });

  app.delete("/api/training-docs/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const doc = await storage.getTrainingDoc(req.params.id);
      if (!doc) return res.status(404).json({ error: "Training document not found" });
      if (doc.userId !== userId) return res.status(403).json({ error: "Forbidden" });
      if (doc.storagePath && supabaseStorage.isSupabaseConfigured()) {
        try {
          await supabaseStorage.deleteFile(doc.storagePath);
        } catch (e: unknown) {
          console.warn(`[TRAINING DOC DELETE] Supabase file deletion failed, continuing: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
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
      const extracted = await extractTextFromFile(file, { maxPages: 50 });
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
      const documents = await storage.getDocuments(req.user!.id);
      const sessions = await storage.getChatSessions(req.user!.id);
      const drafts = await storage.getDrafts(req.user!.id);
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

  app.get("/api/usage/today", async (req: Request, res: Response) => {
    try {
      const result = await getTodayUsage(req);
      res.json(result);
    } catch (error) {
      console.error("Error fetching AI usage:", error);
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  app.post("/api/research/search", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const researchSearchSchema = z.object({
        query: z.string().min(1, "Query is required").max(10000, "Input too long — please shorten your text"),
        page: z.number().optional().default(0),
      });
      const parsed = researchSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { query, page } = parsed.data;

      // Cache Indian Kanoon results for 24h — same query always returns same statutes/cases
      const kanoonCacheKey = { query: query.toLowerCase().trim(), page };
      let results: IndianKanoonResult[] | null = aiCache.get<IndianKanoonResult[]>("kanoon-search", kanoonCacheKey) ?? null;

      // Run IK search + BERT statute identification in parallel (they don't depend on each other)
      let bertStatutes: { statute: string; confidence: number }[] = [];
      if (!results) {
        const [freshResults, bertResult] = await Promise.allSettled([
          withTimeout(indianKanoon.search(query, page), 5000, []),
          inLegalBERT.isConfigured() && page === 0
            ? withTimeout(inLegalBERT.identifyStatutes(query), 3000, [])
            : Promise.resolve([]),
        ]);
        results = freshResults.status === "fulfilled" ? freshResults.value : [];
        bertStatutes = bertResult.status === "fulfilled" ? bertResult.value : [];
        if (results?.length) aiCache.set("kanoon-search", kanoonCacheKey, results);
      } else if (inLegalBERT.isConfigured() && page === 0) {
        // Cache hit — still run BERT identify (fast local ONNX, no network)
        bertStatutes = await withTimeout(inLegalBERT.identifyStatutes(query), 3000, []);
      }

      // Re-rank IK results by BERT semantic relevance
      if (bertStatutes.length > 0 && results.length > 2 && inLegalBERT.isConfigured()) {
        try {
          const docsToRank = results.slice(0, 10).map(r => ({
            id: r.docId,
            title: r.title,
            text: r.headline?.replace(/<[^>]*>/g, "") || r.title,
          }));
          const ranked = await withTimeout(inLegalBERT.rankByRelevance(query, docsToRank), 2000, null);
          if (ranked) {
            results = ranked.map(rd => {
              const original = results!.find(r => r.docId === rd.id);
              return original ? { ...original, relevanceScore: rd.relevanceScore } : original!;
            }).filter(Boolean);
          }
        } catch (e) {
          console.log("[RESEARCH] InLegalBERT ranking failed, using default order");
        }
      }
      
      await recordAIUsage(req);
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

  app.post("/api/research/advanced", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const advancedResearchSchema = z.object({
        query: z.string().min(1, "Query is required").max(10000, "Input too long — please shorten your text"),
      });
      const parsed = advancedResearchSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { query } = parsed.data;

      const [kanoonResults, advancedResults] = await Promise.all([
        indianKanoon.search(query, 0),
        legalWebSearch.advancedSearch(query),
      ]);

      await recordAIUsage(req);
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

  app.post("/api/memos/generate", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const memoGenerateSchema = z.object({
        facts: z.string().min(1, "Facts are required").max(10000, "Input too long — please shorten your text"),
        issues: z.string().max(10000, "Input too long — please shorten your text").optional(),
        documentIds: z.array(z.string()).optional(),
        language: z.string().optional(),
        structure: z.string().optional(),
        jurisdiction: z.string().optional(),
        parties: z.string().optional(),
        title: z.string().optional(),
        stream: z.boolean().optional(),
      });
      const parsed = memoGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { facts, issues, documentIds, language, structure, jurisdiction, parties, title, stream } = parsed.data;

      const selectedLanguage = language || "English";
      const selectedStructure = structure || "IRAC";
      const memoTitle = title || "Legal Memorandum";

      // ============================================
      // LEGAL RESEARCH LAYER — ALL STAGES IN PARALLEL
      // ============================================
      // Layer 0: InLegalBERT + Layer 1: IK (base) +
      // Layer 2: Perplexity + training context — launched together

      let indianKanoonContext = "";
      let perplexityRiskContext = "";
      let inLegalBERTContext = "";

      const memoSearchBase = (issues || facts).substring(0, 300);
      const memoRiskQuery = `Recent amendments, notifications, or judicial developments in India ${jurisdiction || ""} ${new Date().getFullYear()} ${issues?.substring(0, 100) || ""}`;

      console.log("[MEMO PIPELINE] Launching parallel: BERT + IK base + Perplexity + training context...");

      const [memoBertSettled, memoBaseIKSettled, memoPerplexitySettled, memoTrainingSettled] = await Promise.allSettled([
        inLegalBERT.isConfigured()
          ? withTimeout(inLegalBERT.identifyStatutes(facts), 5000, [])   // BERT statute pre-identification
          : Promise.resolve([]),
        indianKanoon.isConfigured()
          ? withTimeout(indianKanoon.search(memoSearchBase, 0), 5000, []) // Primary authority — keep generous
          : Promise.resolve([]),
        legalWebSearch.isConfigured()
          ? withTimeout(legalWebSearch.searchLegal(memoRiskQuery), 5000, null) // Advisory only
          : Promise.resolve(null),
        withTimeout(trainingDataLoader.getTrainingContext(), 3000, ""),   // Firm SOP training context
      ]);

      // Process BERT results (Layer 0)
      const memoIdentifiedStatutes = memoBertSettled.status === "fulfilled" ? memoBertSettled.value : [];
      const memoBertQueries = memoIdentifiedStatutes.slice(0, 3).map(s => s.statute);
      if (memoIdentifiedStatutes.length > 0) {
        inLegalBERTContext = `\n\n=== InLegalBERT STATUTE ANALYSIS (AI Pre-Identification) ===\nThe following statutes were identified as potentially relevant:\n`;
        memoIdentifiedStatutes.forEach((s, i) => {
          inLegalBERTContext += `${i + 1}. ${s.statute} (confidence: ${(s.confidence * 100).toFixed(1)}%)\n`;
        });
        inLegalBERTContext += `\nUse these as guidance. All citations must still be verified from Indian Kanoon results below.\n===`;
        console.log(`[MEMO PIPELINE] InLegalBERT identified ${memoIdentifiedStatutes.length} statutes`);
      }

      // Collect base IK results; fire BERT-enhanced IK queries in parallel (Layer 1)
      let allMemoResults: IndianKanoonResult[] = memoBaseIKSettled.status === "fulfilled" ? (memoBaseIKSettled.value || []) : [];
      if (memoBertQueries.length > 0 && indianKanoon.isConfigured()) {
        console.log("[MEMO PIPELINE] Running BERT-enhanced IK queries in parallel...");
        const memoBertIKSettled = await Promise.allSettled(
          memoBertQueries.map(q => withTimeout(indianKanoon.search(q, 0), 3000, []))
        );
        const seenMemoDocIds = new Set(allMemoResults.map(r => r.docId));
        for (const r of memoBertIKSettled) {
          if (r.status === "fulfilled") {
            for (const doc of r.value) {
              if (!seenMemoDocIds.has(doc.docId)) { seenMemoDocIds.add(doc.docId); allMemoResults.push(doc); }
            }
          }
        }
      }

      if (allMemoResults.length > 0) {
        indianKanoonContext = `\n\n=== PRIMARY LEGAL AUTHORITY (Indian Kanoon - Verified Sources) ===
USE THESE CITATIONS ONLY. Do not invent or modify these references.

`;
        allMemoResults.slice(0, 5).forEach((result, index) => {
          const cleanSnippet = result.headline?.replace(/<[^>]*>/g, "").substring(0, 120) || "";
          indianKanoonContext += `[${index + 1}] ${result.title}\n   DocID: ${result.docId} | Excerpt: ${cleanSnippet}...\n\n`;
        });
        indianKanoonContext += `\nIMPORTANT: Only cite cases/statutes from the above list. If a case is not listed here, mark it as "[CITATION NEEDED - VERIFY]".`;
        console.log(`[MEMO PIPELINE] IK: ${allMemoResults.length} results`);
      }

      // Process Perplexity results (Layer 2)
      const memoPerplexityResult = memoPerplexitySettled.status === "fulfilled" ? memoPerplexitySettled.value : null;
      if (memoPerplexityResult?.answer) {
        const memoSourcesList = memoPerplexityResult.sources?.length > 0
          ? memoPerplexityResult.sources.slice(0, 3).map((s: any) => s?.source || "Unknown").join(", ")
          : "Web search";
        perplexityRiskContext = `\n\n=== CURRENCY & RISK SIGNALS (Advisory - Verify Independently) ===
The following are recent developments that MAY affect this analysis. These are for awareness only - do NOT cite as authority.

${memoPerplexityResult.answer.substring(0, 900)}

Sources checked: ${memoSourcesList}

NOTE: This is advisory information only. Recent amendments/notifications should be verified from official gazettes before relying on them.
===`;
      }

      // Combine research context (Layer 0 + Layer 1 + Layer 2)
      const researchContext = inLegalBERTContext + indianKanoonContext + perplexityRiskContext;

      // Training context (fetched in the parallel batch above)
      let memoTrainingContext = memoTrainingSettled.status === "fulfilled" ? memoTrainingSettled.value : "";

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
      const expertMemoPrompt = `You are a cautious senior Indian legal research partner. Prioritize reliability over volume.

Core rules:
- Never fabricate citations, statutes, reporters, recent cases, or legal principles.
- If a citation is not verified, write "[CITATION NEEDED - VERIFY INDEPENDENTLY]".
- If facts are missing, use "[BLANK]" or "[TO BE FILLED BY USER]".
- If law is unclear/evolving, flag uncertainty explicitly.
- Authority hierarchy: Statute > Case Law > Commentary.

Memo header:
LEGAL MEMORANDUM
TO: [TO BE FILLED]
FROM: [TO BE FILLED]
DATE: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
RE: [Subject]
PRIVILEGED AND CONFIDENTIAL

Analysis requirements:
- Use the requested IRAC/CRAC/CREAC structure.
- Cite statutes first, then verified case law.
- Explain the ratio/principle, not just the citation.
- Distinguish binding Supreme Court authority from persuasive High Court authority.
- Address counterarguments, factual gaps, limitation, and risk.

Citation format:
- Statute: Section + full Act name + year.
- Case: Case name + court + year + reporter where available.

Self-check before final output: traceable citations, statute hierarchy, uncertainty flagged, no contradictions, actionable recommendation.
Output clean plain text only. No markdown symbols.`;

      let systemPrompt = selectedLanguage !== "English"
        ? `${expertMemoPrompt}\n\nCRITICAL LANGUAGE REQUIREMENT: You are completely fluent in ${selectedLanguage} and must generate the ENTIRE memorandum in ${selectedLanguage} with perfect grammar and appropriate legal terminology in that language. Only use English for proper nouns, specific case citations (like "AIR 2023 SC 456"), or official statute names. All section headings, content, and legal analysis must be in ${selectedLanguage}.`
        : expertMemoPrompt;

      // Add Chakshi's comprehensive training knowledge for memo standards
      if (memoTrainingContext) {
        systemPrompt += `\n\n=== CHAKSHI MEMO STYLE REFERENCE ===\n${trimPromptText(memoTrainingContext, 1800)}`;
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const aiStream = await callAIStream(openai, {
          model: MODEL_TIERS.standard,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            { role: "user", content: prompt },
          ],
          stream: true,
          max_completion_tokens: 4096,
        }, "memo-generate-stream");

        let fullMemo = "";
        for await (const chunk of aiStream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            fullMemo += delta;
            sendSse(res, "chunk", { content: delta });
          }
        }

        const cost = MODEL_COSTS.standard;
        await storage.addCostEntry({
          type: "memo_generation",
          description: "Generated legal memorandum",
          amount: cost,
          modelUsed: "standard",
        });

        await recordAIUsage(req);
        sendSse(res, "done", {
          fullMemo,
          modelUsed: "standard",
          cost,
        });
        res.end();
        return;
      }

      const response = await callAI(openai, {
        model: MODEL_TIERS.standard,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 4096,
      }, "memo-generate");

      const fullMemo = response.choices[0]?.message?.content || "";
      const cost = MODEL_COSTS.standard;

      await storage.addCostEntry({
        type: "memo_generation",
        description: "Generated legal memorandum",
        amount: cost,
        modelUsed: "standard",
      });

      await recordAIUsage(req);
      res.json({
        fullMemo,
        modelUsed: "standard",
        cost,
      });
    } catch (error) {
      console.error("Memo generation error:", error);
      if (res.headersSent) {
        sendSse(res, "error", { error: "Failed to generate memo" });
        res.end();
        return;
      }
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

  app.post("/api/compliance/generate", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const complianceGenerateSchema = z.object({
        industry: z.string().min(1, "Industry is required"),
        jurisdiction: z.string().min(1, "Jurisdiction is required"),
        activity: z.string().min(1, "Activity is required").max(10000, "Input too long — please shorten your text"),
      });
      const parsed = complianceGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { industry, jurisdiction, activity } = parsed.data;

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

      const complianceCacheKey = { industry: industry.toLowerCase(), jurisdiction: jurisdiction.toLowerCase(), activity: activity.substring(0, 200).toLowerCase() };
      const cachedCompliance = aiCache.get<string>("compliance", complianceCacheKey);

      let content: string;
      if (cachedCompliance) {
        content = cachedCompliance;
      } else {
        const response = await callAI(openai, {
          model: MODEL_TIERS.mini,
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
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
        }, "compliance-generate");
        content = response.choices[0]?.message?.content || "";
        if (content) aiCache.set("compliance", complianceCacheKey, content);
      }
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

      await recordAIUsage(req);
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
      const notes = await storage.getResearchNotes(req.user!.id);
      const filtered = draftId ? notes.filter(n => n.draftId === draftId) : notes;
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching research notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/research/notes", async (req: Request, res: Response) => {
    try {
      const parsed = insertResearchNoteSchema.safeParse({ ...req.body, userId: req.user!.id });
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
      await storage.deleteResearchNote(req.params.id, req.user!.id);
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
      const note = await storage.updateResearchNote(req.params.id, req.user!.id, { name, content });
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
      const notes = await storage.getCnrNotes(req.user!.id);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching CNR notes:", error);
      res.status(500).json({ error: "Failed to fetch CNR notes" });
    }
  });

  app.post("/api/cnr/notes", async (req: Request, res: Response) => {
    try {
      const parsed = insertCnrNoteSchema.safeParse({ ...req.body, userId: req.user!.id });
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
      const cnrNoteUpdateSchema = z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        cnrNumber: z.string().nullable().optional(),
      });
      const parsed = cnrNoteUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const note = await storage.updateCnrNote(req.params.id, req.user!.id, parsed.data);
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
      await storage.deleteCnrNote(req.params.id, req.user!.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CNR note:", error);
      res.status(500).json({ error: "Failed to delete CNR note" });
    }
  });

  app.get("/api/cnr/saved-cases", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const cases = await getDb().select().from(savedCases).where(eq(savedCases.userId, userId)).orderBy(desc(savedCases.savedAt));
      res.json(cases);
    } catch (error) {
      console.error("Error fetching saved cases:", error);
      res.status(500).json({ error: "Failed to fetch saved cases" });
    }
  });

  app.post("/api/cnr/saved-cases", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const parsed = insertSavedCaseSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const existing = await getDb().select().from(savedCases).where(and(eq(savedCases.userId, userId), eq(savedCases.cnrNumber, parsed.data.cnrNumber)));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Case already saved", existingCase: existing[0] });
      }
      const [newCase] = await getDb().insert(savedCases).values(parsed.data).returning();
      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error saving case:", error);
      res.status(500).json({ error: "Failed to save case" });
    }
  });

  app.delete("/api/cnr/saved-cases/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      await getDb().delete(savedCases).where(and(eq(savedCases.id, req.params.id), eq(savedCases.userId, userId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved case:", error);
      res.status(500).json({ error: "Failed to delete saved case" });
    }
  });

  const oauthStates = new Map<string, { userId: string; expiresAt: number; redirectUri: string }>();

  app.get("/api/calendar/google/auth-url", (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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

      // Wrap credential writes in withUserContext so RLS policies on
      // google_calendar_credentials are satisfied (app.current_user_id must be
      // set even though this is a public OAuth callback route).
      await withUserContext(userId, async () => {
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
      });

      logAudit(req, {
        action: "calendar_connect",
        resourceType: "google_calendar",
        resourceId: userId,
        success: true,
      });

      res.redirect("/hub/calendar?connected=google");
    } catch (error) {
      console.error("[AUDIT] OAuth callback error");
      res.redirect("/hub/calendar?error=oauth_failed");
    }
  });

  app.get("/api/calendar/google/status", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      await storage.deleteGoogleCalendarCredentials(userId);
      logAudit(req, {
        action: "calendar_disconnect",
        resourceType: "google_calendar",
        resourceId: userId,
        success: true,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[AUDIT] Error disconnecting calendar");
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  app.post("/api/calendar/google/sync", async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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

      const userId = req.user!.id;
      const eventData = { ...parsed.data, userId };
      const event = await storage.createCalendarEvent(eventData);

      const creds = await storage.getGoogleCalendarCredentials(userId);
      if (creds) {
        const service = new GoogleCalendarService(userId);
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
      if (event.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
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
      if (event.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
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

  app.post("/api/refine", checkAIUsage, async (req: Request, res: Response) => {
    try {
      const refineSchema = z.object({
        text: z.string().min(1, "Text is required").max(80000, "Input too long — please shorten your text"),
        action: z.string().optional(),
        customPrompt: z.string().optional(),
        selectedHtml: z.string().optional(),
      });
      const parsed = refineSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        if (firstError.message.includes("too long")) {
          return res.status(400).json({ error: "Input too long — please shorten your text" });
        }
        return res.status(400).json({ error: firstError.message });
      }
      const { text, action, customPrompt, selectedHtml } = parsed.data;

      let refinementInstruction = "";
      switch (action) {
        case "concise":
          refinementInstruction = "Make the text more concise while preserving all legal meaning. Remove redundancy and tighten the language. Return plain text (isHtml: false).";
          break;
        case "formal":
          refinementInstruction = "Make the text more formal and professional. Use elevated legal register appropriate for court filings. Return plain text (isHtml: false).";
          break;
        case "persuasive":
          refinementInstruction = "Make the text more persuasive and compelling while maintaining legal accuracy. Strengthen the argumentation. Return plain text (isHtml: false).";
          break;
        case "judicial":
          refinementInstruction = "Rewrite the text in a judicial tone, as if written by a judge in a court order or judgment. Use measured, authoritative language. Return plain text (isHtml: false).";
          break;
        case "custom":
          refinementInstruction = customPrompt || "Improve clarity and legal precision.";
          break;
        default:
          refinementInstruction = "Improve clarity, structure, and professional tone. Return plain text (isHtml: false).";
      }

      const htmlContext = selectedHtml ? `\nCurrent HTML format of the selection:\n${selectedHtml}\n` : "";

      const systemPrompt = `You are an AI writing assistant embedded in a legal document editor. You help users transform and refine selected text — think of yourself as ChatGPT for the selected text.

You can perform ANY transformation requested, including:
- Wording improvements: concise, formal, persuasive, clearer, simpler, expand
- Format changes: convert paragraph to bullet list, numbered list, remove a heading, make text bold/italic, combine or split paragraphs, convert to table
- Structural changes: add/remove headings, convert between formats, reorder content${htmlContext}

Specific instruction: ${refinementInstruction}

Output rules:
- For format/structure changes (bullet points, numbered list, headings, bold, italic, tables, removing heading tags etc.): return valid HTML in "refined", set "isHtml": true. Use proper HTML tags: <ul><li>, <ol><li>, <strong>, <em>, <h2>, <h3>, <p>, <table> etc.
- For wording/tone changes (concise, formal, persuasive, rewording, clarity): return plain text in "refined", set "isHtml": false
- Do NOT use markdown — use proper HTML tags only when isHtml is true
- Do not add new facts or make up legal citations
- Preserve legal meaning unless explicitly asked to change it

Return ONLY a valid JSON object, no other text:
{
  "refined": "the transformed text or HTML here",
  "isHtml": false,
  "note": "Brief 1-2 line explanation of what was done"
}`;

      const response = await callAI(openai, {
        model: MODEL_TIERS.mini,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      }, "refine");

      const raw = response.choices[0]?.message?.content || "";

      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          await recordAIUsage(req);
          return res.json({
            refined: parsed.refined || raw,
            isHtml: parsed.isHtml || false,
            note: parsed.note || "",
          });
        }
      } catch {
        // If JSON parsing fails, return raw text
      }

      await recordAIUsage(req);
      res.json({ refined: raw, isHtml: false, note: "" });
    } catch (error) {
      console.error("Error refining text:", error);
      res.status(500).json({ error: "Failed to refine text" });
    }
  });

  app.post("/api/voice/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
    let audioStoragePath: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      console.log(`[VOICE] Transcription request: file size=${req.file.size} bytes`);

      if (supabaseStorage.isSupabaseConfigured()) {
        try {
          const uploaded = await supabaseStorage.uploadAudio(req.file);
          audioStoragePath = uploaded.path;
        } catch (e: any) {
          console.warn(`[TRANSCRIBE] Supabase audio upload failed, transcribing from buffer: ${e.message}`);
        }
      }


      const result = await openaiTranscribe(req.file.buffer, req.file.originalname || "recording.webm");
      res.json({ text: result.text, language_code: result.language_code });
    } catch (error: any) {
      console.error("Error transcribing audio:", error?.message || error);
      res.status(500).json({ error: "Failed to transcribe audio", detail: error?.message || "Unknown error" });
    } finally {
      if (audioStoragePath) {
        supabaseStorage.deleteFile(audioStoragePath).catch(() => {});
      }
    }
  });

  app.post("/api/voice/speak", async (req: Request, res: Response) => {
    try {
      const { text, voiceId } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const voice = (voiceId && validVoices.includes(voiceId)) ? voiceId : OPENAI_DEFAULT_VOICE;
      const audioBuffer = await openaiTTS(text, voice);

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.end(audioBuffer);
    } catch (error: any) {
      console.error("Error generating speech:", error?.message || error);
      res.status(500).json({ error: "Failed to generate speech", detail: error?.message || "Unknown error" });
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
        logAudit(req, {
          action: "rate_limit_exceeded",
          resourceType: "embed_chat",
          success: false,
          errorCode: "DAILY_LIMIT_REACHED",
          metadata: { used: currentCount, limit: EMBED_DAILY_LIMIT },
        });
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
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Vary", "Origin");

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
      const stream = await callAIStream(openai, {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
        max_tokens: 2000,
      }, "research-chat");

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

  app.get("/api/admin/audit-log", async (req: Request, res: Response) => {
    const adminSecret = req.headers["x-admin-secret"];
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      logAudit(req, {
        action: "admin_audit_access",
        resourceType: "audit_log",
        success: false,
        errorCode: "UNAUTHORIZED",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    logAudit(req, {
      action: "admin_audit_access",
      resourceType: "audit_log",
      success: true,
    });

    try {
      const { userId, action, since } = req.query;
      const filters: { userId?: string; action?: string; since?: Date; limit?: number } = { limit: 100 };
      if (userId) filters.userId = userId as string;
      if (action) filters.action = action as string;
      if (since) {
        const sinceDate = new Date(since as string);
        if (!isNaN(sinceDate.getTime())) filters.since = sinceDate;
      }

      const logs = await storage.getAuditLogs(filters);
      res.json({ logs, count: logs.length });
    } catch (error) {
      console.error("[ADMIN] Error fetching audit logs");
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  return httpServer;
}
