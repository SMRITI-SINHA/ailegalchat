# DocuChat — Feature & Architecture Reference

> Keep this file updated whenever you add, remove, or change a DocuChat feature.
> Its purpose is to prevent accidentally breaking existing functionality during future changes.

---

## What DocuChat Does

DocuChat lets a user upload a legal PDF (or DOCX/image) and have a focused AI conversation about that specific document. It is entirely separate from the general Nyaya AI chat — every answer is grounded in the uploaded file only.

Key capabilities:
- Upload up to 800-page PDFs (200 MB limit)
- AI answers questions about the document with inline page references
- Clicking a page reference badge jumps to that page in the document panel and highlights the specific quoted text (yellow)
- Nyaya AI side-panel lets users cross-reference Indian law while reading the document
- Notes panel for saving observations tied to the session
- All sessions and messages persist in PostgreSQL per user

---

## File Locations

| What | Where |
|---|---|
| Main page component | `client/src/pages/hub/chat-pdf.tsx` |
| Upload API endpoint | `server/routes.ts` — `POST /api/documents/upload` |
| Chat query endpoint | `server/routes.ts` — `POST /api/chat/query` |
| Document fetch | `server/routes.ts` — `GET /api/documents/:id` |
| Session messages | `server/routes.ts` — `GET /api/chat/sessions/:id/messages` |
| InLegalBERT enrichment | `server/huggingface.ts` |
| DB schema | `shared/schema.ts` — `documents`, `chatSessions`, `chatMessages` tables |

---

## Upload & Processing Pipeline

```
User picks file
    → POST /api/documents/upload
        → DB record created immediately (status: "processing")
        → Server responds with { id, name, status: "processing" } in < 1 s
    → Frontend polls GET /api/documents/:id every 2 s
    → Background IIFE on server:
        1. pdftotext / mammoth extraction → plain text
        2. InLegalBERT analysis prepended as header block
           (=== DOCUMENT STRUCTURE (InLegalBERT Analysis) === ... === END STRUCTURE ===)
        3. DB updated: status → "completed", extractedText, pages
    → Poll detects "completed"
        → uploadedDocs state updated: status "ready", pages, content = extractedText
    → "Start Chat" button enables
```

**Important:** `pollDocumentStatus` (inside `ChatWithPDFPage`) must set `content: doc.extractedText` when it detects completion — otherwise `docPages` is empty and every page shows "No text content". See lines ~613–616.

---

## InLegalBERT Header Stripping

The server prepends a structural analysis block to `extractedText`:

```
=== DOCUMENT STRUCTURE (InLegalBERT Analysis) ===
[Ruling/Order] ...
[Statute Reference] ...
=== END STRUCTURE ===

[actual document text]
```

This block is **useful for the AI** (provides document structure context) but **must be stripped before displaying** in the document panel.

Stripping happens in the `docContent` computed variable (~line 923):
```ts
const docContent = rawDocContent
  .replace(/^=== DOCUMENT STRUCTURE \(InLegalBERT Analysis\) ===[\s\S]*?=== END STRUCTURE ===\n*/m, "")
  .trim();
```

Do **not** strip it from `uploadedDocs[0].content` — that would remove it from the AI's context too. Only strip it at render time.

---

## Page Splitting

`docContent` is split into synthetic "pages" of 3000 characters each:

```ts
const CHARS_PER_PAGE = 3000;
const docPages = docContent
  ? Array.from(
      { length: Math.max(1, Math.ceil(docContent.length / CHARS_PER_PAGE)) },
      (_, i) => docContent.slice(i * CHARS_PER_PAGE, (i + 1) * CHARS_PER_PAGE)
    )
  : Array.from({ length: Math.max(1, docTotalPages) }, () => "");
```

These are **not** the actual PDF pages — they are character-count chunks used for navigation. The page count badge shows `docPages.length`, not the PDF's page count.

---

## Chat Flow

```
User types → handleSend()
    → User message added to local `messages` state
    → POST /api/chat/query { message, sessionId, documentIds }
    → Server streams SSE: data: { content: "chunk" }
    → Frontend accumulates chunks into assistantId message
    → On stream end: parseAndCleanContent(fullContent)
        → strips [Page X] / (Page X) citation markers from text
        → extracts PageRef[] { page: number, refText: string }
        → preserves newlines (only collapses multiple horizontal spaces)
    → Final message stored in DB via POST /api/chat/messages
```

**Do not** collapse newlines in `parseAndCleanContent` — the regex `[^\S\n]+` (not `\s+`) must be used so numbered lists and paragraph breaks survive into `markdownToHtml`.

---

## Page Reference Badges

When the AI includes `[Page 3]` or `(Page 5–7)` in its response, `parseAndCleanContent` strips those markers from the displayed text and collects them as `PageRef[]`:

```ts
interface PageRef {
  page: number;
  refText?: string;   // up to 90-char excerpt from the sentence before the [Page X] tag
}
```

Clicking a badge:
1. `setActiveDocPage(ref.page)` — navigate to that chunk
2. `setHighlightText(ref.refText || "")` — highlight the specific quote in yellow
3. `setIsFullPageRef(!ref.refText)` — if no specific quote, show blue "full page" banner instead
4. `setRightPanel("doc")` and `setPanelCollapsed(false)` — ensure doc panel is visible

Auto-scroll: a `useEffect` watches `[activeDocPage, highlightText]` and calls `mark.scrollIntoView({ behavior: "smooth", block: "center" })` after 120 ms, targeting the first `<mark>` inside `docPanelRef`.

---

## Document Panel Rendering

Component: `HighlightedPageText({ text, highlight })`

- Splits `text` by `\n\n` → paragraphs rendered as `<p>` tags
- Splits each paragraph by `\n` → `<br>` between lines
- When `highlight` is set, splits each chunk by regex and wraps matches in `<mark className="bg-amber-200 ...">`
- Empty `text` → shows "No text content for this page" placeholder

The `docPanelRef` (`useRef<HTMLDivElement>`) is attached to the wrapper `<div>` around `HighlightedPageText` so the auto-scroll effect can query `mark` elements inside it.

---

## Banners in Document Panel

| Banner | Triggers when | Clears when |
|---|---|---|
| Amber — "Highlighted text referenced in the answer" | `highlightText` is set and page has content | User clicks Clear, navigates pages manually, or a new page ref badge is clicked without refText |
| Blue — "This answer referenced this page broadly" | `isFullPageRef === true` and `highlightText === ""` | User clicks Dismiss, navigates pages manually |

---

## Session Lifecycle

**New session (fresh upload):**
- `handleStartChat()` creates a DB session
- Clears: `messages`, `nyayaMessages`, `nyayaSessionId`, `activeDocPage`, `highlightText`
- Sets `currentSessionId` and switches `viewMode` to `"chat"`

**Reopening a session (Previous Chats list):**
- `handleOpenSession(session)` clears all state first, then fetches messages + nyaya messages + documents from the API

**Why both clear state first:** Without this, messages from a previously open session bleed into the new session view.

---

## Notes

- Notes are saved to `localStorage` keyed by `docuchat-notes-${sessionId}` — they are NOT in the DB
- If a user clears browser storage, their notes are lost (this is by design for zero-data-retention)

---

## Known Limitations

- Page splitting is by character count (3000 chars), not by actual PDF page — so "pg.3" in an AI badge means chunk 3 of the extracted text, not necessarily page 3 of the original PDF
- Tables in PDFs are extracted as plain text and will appear jumbled in the document panel (PDF table → plain text is inherently lossy without a PDF renderer)
- Images in PDFs are not extracted unless OCR is enabled (scanned docs will show "No text content for this page")

---

## Things to Check Before Changing DocuChat

- [ ] Does `pollDocumentStatus` still set `content: doc.extractedText` on completion? (Required for page navigation to work)
- [ ] Does `parseAndCleanContent` use `[^\S\n]+` not `\s+` for whitespace collapsing? (Required for AI reply structure)
- [ ] Does `docContent` still strip the InLegalBERT header before display? (Required so raw tags don't show in doc panel)
- [ ] Does `handleStartChat` still call `setMessages([])` before switching to chat view? (Required to prevent old session messages leaking)
- [ ] Does the page ref badge onclick still set both `highlightText` and `isFullPageRef`? (Required for correct highlight vs full-page banner behaviour)
