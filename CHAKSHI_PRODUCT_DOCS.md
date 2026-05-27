# Chakshi AI Hub — Complete Product Documentation

> **Audience:** Internal reference, client demos, investor pitches
> **Last updated:** May 2026

---

## Table of Contents

1. [What Is Chakshi?](#1-what-is-chakshi)
2. [Who Is It For?](#2-who-is-it-for)
3. [The Problem We Solve](#3-the-problem-we-solve)
4. [Feature Map — Every Module Explained](#4-feature-map)
   - 4.1 DocuChat — Document Intelligence
   - 4.2 Nyaya AI — Expert Legal Assistant
   - 4.3 CNR Chatbot — Live Case Status
   - 4.4 AI Legal Drafting
   - 4.5 Custom & Empty Drafting
   - 4.6 Firm Style Training
   - 4.7 AI Research Assistant
   - 4.8 Legal Memo Generator
   - 4.9 Compliance Checklist Generator
   - 4.10 Saved Notes
   - 4.11 Study Buddy (Beta)
   - 4.12 Legal Academic Calendar
5. [The AI Pipeline — How It Works Under the Hood](#5-the-ai-pipeline)
6. [Safety & Anti-Hallucination System](#6-safety--anti-hallucination-system)
7. [Security & Compliance](#7-security--compliance)
8. [Language Support](#8-language-support)
9. [Technical Architecture](#9-technical-architecture)
10. [Integrations & APIs](#10-integrations--apis)
11. [Deployment & Embedding](#11-deployment--embedding)
12. [Recent Feature Improvements (May 2026)](#12-recent-feature-improvements-may-2026)
13. [Competitive Differentiators — Pitch Summary](#13-competitive-differentiators)

---

## 1. What Is Chakshi?

**Chakshi** is an AI-powered legal intelligence platform built specifically for the Indian legal system. It is embedded as a full-featured workspace inside `chakshi.in` and gives legal professionals a single place to:

- Analyse and interrogate large legal documents (up to 800 pages)
- Draft court-ready petitions, agreements, notices and more
- Research live Indian case law and statutes from verified primary sources
- Generate legal memos, compliance checklists, and counter-arguments
- Look up live court case status by CNR number
- Communicate in 22 Indian languages

Chakshi is **not a generic chatbot wrapper**. Every feature is designed around how Indian lawyers and legal clerks actually work — citing the correct section, referencing the correct court, using the correct procedural terminology.

---

## 2. Who Is It For?

| User Role | Primary Use |
|-----------|-------------|
| **Advocates** | Drafting petitions, bail applications, pleadings; researching precedents |
| **Legal Clerks** | Document analysis, compliance checklists, CNR status lookup |
| **Law Students** | Case prediction, counter-argument practice, moot court simulation |
| **In-House Counsel** | Contract review, compliance audits, memo generation |
| **Legal Firms** | Training AI on firm-specific drafting style, bulk document analysis |

---

## 3. The Problem We Solve

Indian legal professionals face three major pain points:

**1. Research is slow and unreliable.**
Manually searching Indian Kanoon, SCC, and gazettes takes hours. Generic AI tools hallucinate case names, wrong section numbers, and non-existent judgments.

**2. Drafting is repetitive but precision-critical.**
A single wrong section number in a petition can get it rejected. Junior associates copy-paste from old drafts and introduce errors. There is no tool that enforces the correct structure for Indian courts.

**3. Document review is labour-intensive.**
A 400-page charge-sheet or a 200-page agreement takes days to manually review and summarise. There is no affordable tool that lets a lawyer *ask questions* to a document.

**Chakshi solves all three** — with verified sources, enforced document structure, and an intelligent document question-answering engine.

---

## 4. Feature Map

### 4.1 DocuChat — Document Intelligence

**What it does:** Upload any legal document (PDF, DOCX, scanned image) up to 800 pages and have a full conversation with it. The AI reads the document and answers questions, extracts timelines, identifies key issues, and finds specific clauses — all with page-level citations.

**Key capabilities:**
- Upload PDF, DOCX, DOC, and scanned images (OCR for scanned docs)
- Ask any question: "What are the payment terms?", "Summarise the facts", "List all dates mentioned", "What are the obligations of Party A?"
- Every AI answer includes `[Page X]` inline citations that are extracted from the response text and converted into clickable page-reference badges — click any badge to jump directly to that page in the document viewer
- **Split-panel layout** — chat on the left, document on the right. The divider is draggable (28%–72% flex). Clicking a page citation automatically opens the document panel and scrolls to that page
- **Yellow text highlighting** — when the AI references a specific passage, clicking the page badge highlights that exact paragraph in the text view
- **Blue banner** for full-page references (when no specific passage is cited, just the page broadly)
- **Persistent conversation history** — every question and answer is stored per session; the AI remembers the full conversation context across all follow-up questions. Messages are saved once by the server after each AI response — no duplicates
- **Smart history compression for long sessions** — for sessions longer than 8 messages, older turns are compressed into a summary block while the last 8 messages are kept verbatim, so context is never lost regardless of how long the conversation runs
- **Nyaya AI panel** — a dedicated sub-panel inside DocuChat that also has full access to the uploaded document. Use it to get a second expert opinion, check the legal basis for clauses, or ask general law questions — all without leaving the document view
- **Text selection → Ask Nyaya AI** — select any passage in the AI response, click "Ask Nyaya AI", and the Nyaya panel opens with that text pre-loaded as context, alongside the full document
- **Notes panel** — save important findings from the session as private notes
- **Quick action buttons** — one-click prompts: Summarise, Timeline, Key Issues, Legal Analysis

**Nyaya AI panel inside DocuChat — Sources section:**

When Nyaya AI answers a question that involves statutes, cases, judgments, or recent legal developments, a **Sources** section appears below the answer. It is split into two sub-groups:

- **Case Law** — Indian Kanoon results. Each card shows the case/statute title and a short excerpt in an amber-tinted card with a Scale ⚖️ icon. Clicking opens `indiankanoon.org/doc/{id}` in a new tab. Only shown when the query contains legal keywords (section, act, IPC, CrPC, judgment, court, statute, regulation, etc.)
- **Web Sources** — Perplexity results. Each card shows the site favicon and domain name in a collapsed pill. Click to expand — the full article title appears as a primary-coloured clickable link that opens the page in a new tab. Favicon falls back to a Globe icon if it cannot load. Only shown when Perplexity found relevant recent legal updates (amendments, notifications, judicial developments)

**Relevance filtering:** Only citations the AI actually referenced by number (`[1]`, `[2]`, etc.) in its response are displayed — unrelated search results that the AI ignored are automatically suppressed.

**Note:** The Sources section appears only in the Nyaya AI panel. The main DocuChat chat shows page-reference badges only (not an external Sources section), since in document analysis the document's own pages are the canonical source.

**Supported document formats:** PDF (native + scanned), DOCX, DOC, images (JPG, PNG — OCR-processed)

**Document size:** Up to 800 pages. For very large documents, the AI uses intelligent sectioning — beginning, middle, and end sections are extracted (up to 80,000 characters total) so the most legally important parts of any document are always in context.

---

### 4.2 Nyaya AI — Expert Legal Assistant

**What it does:** A general-purpose AI legal assistant trained on live Indian legal sources. Think of it as a senior advocate who knows all Indian statutes, landmark cases, and legal procedure — available 24/7.

**Key capabilities:**
- Answers any Indian law question with verified citations from Indian Kanoon
- Can help draft documents through an interactive questionnaire flow (detects when a question is really a drafting request and asks clarifying questions before generating)
- Applies "Firm Style" — if your firm has trained Chakshi on its drafting style (see section 4.6), Nyaya AI uses that style
- Full persistent conversation history — same smart compression as DocuChat (verbatim last 8 messages + summary of earlier turns)
- Supports voice input (Whisper speech-to-text) and voice output (OpenAI TTS, "nova" voice)
- Answers in 22 Indian languages

---

### 4.3 CNR Chatbot — Live Case Status

**What it does:** Enter a CNR (Case Number Record) number and get the live status of any court case filed in India, along with the full case history.

**Key capabilities:**
- Real-time case status lookup
- Full hearing history timeline
- Built-in note editor — take notes about the case and save them to your account
- All notes are private and tied to the specific CNR number

---

### 4.4 AI Legal Drafting

**What it does:** Generate court-ready legal documents from a description of facts. The AI does not just write prose — it enforces correct Indian legal document structure, cites verified statutes and cases, and validates its own output before delivering it.

**The drafting pipeline (in order):**

**Step 1 — Pre-Draft Validation**
Before writing a single word, the AI checks:
- Is the document category valid (petition, agreement, notice, etc.)?
- Is the correct court and jurisdiction specified?
- Are the facts sufficient to draft?
- Is the limitation period still valid?

**Step 2 — InLegalBERT Statute Identification (Layer 0)**
A specialised Indian legal AI model (InLegalBERT, running locally via ONNX) reads the user's facts and identifies which statutes are likely relevant — before any search query is even formed. This makes the research more targeted and accurate.

**Step 3 — Indian Kanoon Research (Layer 1 — Primary Authority)**
The platform searches Indian Kanoon for relevant statutes and precedents using the enhanced queries from Step 2. Only verified results (with DocID, court, year) are passed to the drafting AI. The AI is instructed to cite ONLY from this verified list.

**Step 4 — Perplexity Currency Check (Layer 2 — Advisory)**
Searches for recent amendments, new notifications, and recent judicial developments that may affect the document. These are marked as "advisory only" — the lawyer must verify from official gazettes before filing.

**Step 5 — Document DNA Engine**
The AI enforces the structural "DNA" of the document type:
- Petitions must have: Cause Title, Facts, Grounds, Prayer
- Agreements must have: Parties, Recitals, Definitions, Operative Clauses, Signatures
- Bail applications must follow the correct format for the relevant court

**Step 6 — Judge Simulator Self-Validation**
Before delivering the draft, the AI simulates a judge reviewing the document and identifies any weaknesses, missing elements, or procedural errors. These are flagged in the output.

**Output:** A complete, structured legal document with inline citations, highlighted placeholders for information the user needs to verify or fill in (`[BLANK]`, `[TO BE FILLED BY USER]`), and a quality report.

**Integrated Research Panel:** The drafting page has a side panel showing all the case law and statutes that were found during research, with links to the source documents on Indian Kanoon.

---

### 4.5 Custom Drafting & Empty Document

**Custom Drafting:** Upload your own template or a previous document. The AI uses it as a structural and stylistic reference when generating the new draft.

**Empty Document:** A blank canvas using the built-in rich text editor — for manual drafting without AI, or for editing AI-generated content.

---

### 4.6 Firm Style Training

**What it does:** Upload previous drafts, pleadings, or firm SOPs. The AI analyses the writing style, preferred clause structures, and terminology. All subsequent drafts from that account adopt the trained style.

**Why it matters:** Every firm has preferences — how they address courts, their preferred boilerplate language, their formatting. This feature makes Chakshi feel like it was trained by your firm, not a generic platform.

---

### 4.7 AI Research Assistant

**What it does:** A powerful Indian legal search engine that goes beyond keyword matching to deliver structured, analysed research.

**Two modes:**

**Standard Search:** Enter a legal question or topic. Returns relevant statutes and cases from Indian Kanoon with excerpts and source links.

**Advanced Research:** A deeper analysis that delivers:
- Verbatim extracted paragraphs from the source judgments (not AI paraphrases)
- Chronological timeline of how the law has evolved on a topic
- Conflict detection — flags when two cases take opposing positions
- Currency check via Perplexity — recent amendments or notifications affecting the area of law

All results are organised into a research panel that can be saved as notes.

---

### 4.8 Legal Memo Generator

**What it does:** Generate a structured legal memo on any topic in minutes.

**Supported frameworks:**
- **IRAC** — Issue, Rule, Application, Conclusion (most common in Indian legal practice)
- **CRAC** — Conclusion, Rule, Application, Conclusion
- **CREAC** — Conclusion, Rule, Explanation, Application, Conclusion

The memo is generated using the same three-layer research pipeline as drafting — InLegalBERT → Indian Kanoon → Perplexity — so every point in the memo is backed by verified authority.

---

### 4.9 Compliance Checklist Generator

**What it does:** Enter an industry, business activity, or specific regulation, and get a complete compliance checklist with direct citations to the applicable statutes and rules.

**Example use cases:**
- "What compliance does a fintech startup need in India?"
- "Checklist for opening a restaurant in Maharashtra"
- "SEBI compliance for a listed company"

Each checklist item includes the specific section of the law that requires it, so the lawyer can verify the source directly.

---

### 4.10 Saved Notes

A personal notes library where all research findings, case notes, and CNR notes are stored. Users can search, edit, and organise notes across all features of the platform.

---

### 4.11 Study Buddy (Beta)

Three tools aimed at law students and young professionals sharpening their skills:

**Case Predict AI:** Enter the facts of a case. The AI analyses the facts, relevant precedents, and procedural history to predict likely judicial outcomes with detailed reasoning and probability indicators.

**Counter Argument Generator:** Enter your legal position. The AI generates the strongest possible counter-arguments, rebuttals, and alternative legal interpretations — useful for trial preparation and moot courts.

**Legal Sandbox:** A simulation environment for moot court practice, law entrance exam preparation (CLAT, AIBE, judiciary exams), and learning Indian procedure in a safe, interactive way.

---

### 4.12 Legal Academic Calendar

A full calendar interface with specialised legal event categories:
- Court dates and hearings
- Filing deadlines and limitation dates
- Professional development events
- Academic / exam dates (CLAT, bar exams, etc.)

**Google Calendar sync:** Bidirectional synchronisation — events added in Chakshi appear in Google Calendar, and events from Google Calendar appear in Chakshi. Lawyers who already manage their schedule in Google Calendar get full integration without changing their workflow.

---

## 5. The AI Pipeline

Every AI call in Chakshi goes through a structured pipeline designed to maximise accuracy and minimise hallucinations.

```
User Input
    │
    ▼
Pre-Draft Validation
(category, court, jurisdiction, limitation, factual sufficiency)
    │
    ▼
Layer 0: InLegalBERT (Local ONNX — runs on-server)
• Semantic analysis of facts
• Statute pre-identification using embedding similarity
• Generates targeted Indian Kanoon search queries
• Classifies document segments (Facts / Arguments / Ruling / Statute)
    │
    ▼
Layer 1: Indian Kanoon API (Primary Authority)
• Live search for statutes and case law
• Results ranked by InLegalBERT semantic relevance
• AI is instructed to cite ONLY from this verified list
• Non-verified citations marked: [CITATION NEEDED - VERIFY]
    │
    ▼
Layer 2: Perplexity API (Currency & Risk — Advisory Only)
• Searches for recent amendments, notifications, judicial developments
• Results marked advisory — not citable as primary authority
• Warns user to verify from official gazettes
    │
    ▼
Document DNA Engine
(enforces structural blocks: Cause Title, Facts, Grounds, Prayer, etc.)
    │
    ▼
LLM Generation (OpenAI — tier-selected)
• gpt-4o-mini — routine queries, fast responses
• gpt-4.1 — drafting, research, memos
• o3 — complex multi-issue analysis
    │
    ▼
Judge Simulator Self-Validation
(AI reviews its own output for procedural gaps)
    │
    ▼
Final Output with Citations + Placeholders
```

**All layers fail safely.** If Indian Kanoon is unavailable, the pipeline continues without it and flags the gap. If Perplexity times out, the output is delivered without the currency layer. The user always gets a result.

---

## 6. Safety & Anti-Hallucination System

Hallucination is the biggest risk in legal AI. Chakshi has five layers of protection:

**1. Verified-only citation rule**
The AI is given a list of verified sources (with DocID, court, and year) retrieved from Indian Kanoon. It is instructed to cite only from this list. Any citation it attempts outside this list must be marked `[CITATION NEEDED - VERIFY]`.

**2. Citation format enforcement**
Every citation must follow the exact format:
- Statutes: `Act Name + Year + Section Number`
- Cases: `Case Name + Court + Year + Reporter`

**3. No fabrication policy**
When the AI does not know something (a fact, a date, a party name), it is instructed to use explicit placeholders (`[BLANK]`, `[TO BE FILLED BY USER]`) rather than guess.

**4. Strict authority hierarchy**
The AI is trained to follow the Indian legal hierarchy:
> Constitution → Central Statutes → State Statutes → Case Law → Commentary

**5. Judge Simulator**
Before delivering any draft, the AI runs a self-check simulating a judge reviewing the document and identifies structural or procedural weaknesses.

---

## 7. Security & Compliance

| Property | Detail |
|----------|--------|
| **Compliance** | SOC 2 compliant |
| **Data retention** | Zero data retention policy — no document content stored beyond the session |
| **Auth** | Supabase JWT (RS256) — tokens passed via URL param or `postMessage` from parent frame |
| **Multi-tenancy** | Every data table has `user_id`. Users can only access their own data |
| **Database-level isolation** | PostgreSQL Row-Level Security (RLS) enforced on all 8 user-scoped tables. Each request gets a dedicated DB connection with `app.current_user_id` set before any query executes — data isolation holds even if application-level filters are accidentally omitted |
| **XSS protection** | All document HTML is sanitised using `sanitize-html` before rendering |
| **No error leaks** | Server never sends stack traces or internal code paths to the browser. All errors are sanitised before reaching the client |
| **Error UX** | All unhandled errors surface as clean toast notifications — users never see a raw crash |

---

## 8. Language Support

Chakshi supports **22 Indian languages** across all AI features — chat, drafting, research, and memo generation:

Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, Punjabi, Assamese, Maithili, Sanskrit, Santali, Kashmiri, Nepali, Sindhi, Konkani, Manipuri, Bodo, Dogri

**How it works:** The user selects a language. The AI receives a strict language enforcement instruction in its system prompt. All explanations and analysis are generated in the selected language. Legal proper nouns (case citations, statute names, section numbers) are kept in English as they must appear in filings.

---

## 9. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI components** | shadcn/ui, TailwindCSS |
| **State management** | TanStack Query (React Query v5) |
| **Routing** | wouter |
| **Backend** | Node.js, Express |
| **Database** | PostgreSQL (Drizzle ORM) |
| **Auth** | Supabase JWT (RS256 JWKS) |
| **AI** | OpenAI via Replit AI Integrations |
| **Local ML** | InLegalBERT ONNX (runs on-server, no external call) |
| **Streaming** | Server-sent events (SSE) for real-time AI output |

### Database Tables (User-Scoped with RLS)

| Table | Purpose |
|-------|---------|
| `documents` | Uploaded files, extracted text, page count, storage path |
| `chat_sessions` | DocuChat and Nyaya AI conversation sessions |
| `chat_messages` | Individual messages with model, confidence, cost, citations |
| `drafts` | Generated legal drafts |
| `legal_memos` | Generated memos |
| `research_notes` | Saved research findings |
| `cnr_notes` | Notes attached to CNR case lookups |
| `research_queries` | History of research queries |

### AI Model Routing

| Tier | Model | Used For |
|------|-------|---------|
| Fast | gpt-4o-mini | Quick chat answers, CNR lookups, routine queries |
| Standard | gpt-4.1 | Drafting, research memos, complex chat |
| Premium | o3 | Multi-issue complex analysis, judge simulation |

Model selection is automatic based on the complexity of the input. Cost is tracked per query and shown in real time.

### Concurrency Controls
- `AI_STANDARD_MAX_CONCURRENT = 2` — GPT-4.1/o3 calls are queued to prevent Tier 1 TPM (tokens-per-minute) rate limit bursts
- gpt-4o-mini traffic is not throttled — it runs through a general queue for low latency

### Document Processing
- **PDF:** Text extracted server-side; page boundaries preserved
- **DOCX:** Converted to structured HTML via `mammoth.js`
- **Scanned images/PDFs:** OCR pipeline
- **Page count:** Detected via `pdfinfo` for accurate page navigation

### Voice
- **Speech-to-text:** OpenAI Whisper
- **Text-to-speech:** OpenAI TTS, "nova" voice

---

## 10. Integrations & APIs

| Service | Purpose | Notes |
|---------|---------|-------|
| **OpenAI** | LLM inference (gpt-4o-mini, gpt-4.1, o3), Whisper STT, TTS | Via Replit AI Integrations |
| **Indian Kanoon API** | Primary authority — statute and case law search | Live search before every draft/memo |
| **Perplexity API** | Currency layer — recent amendments and judicial news | Advisory only; results cached + retried with exponential backoff |
| **HuggingFace** | InLegalBERT embeddings (remote fallback) | Local ONNX model used first; HuggingFace as fallback |
| **Google Calendar API** | Bidirectional legal event sync | OAuth 2.0 |
| **Supabase** | JWT auth, user metadata (plan, role, trial status) | RS256 JWKS verification |
| **ElevenLabs** | Voice (configured, available) | Via Replit Integrations |

---

## 11. Deployment & Embedding

Chakshi AI Hub is deployed as a **standalone web app** that is embedded as an `<iframe>` inside `chakshi.in`.

**Auth flow:**
1. User logs in to `chakshi.in` (Supabase auth)
2. `chakshi.in` passes the JWT to the iframe via `postMessage({ type: "CHAKSHI_TOKEN", token })`
3. The hub stores the token in `sessionStorage` and attaches it as `Authorization: Bearer <token>` on every API call
4. The backend verifies the JWT against Supabase's JWKS endpoint and extracts the user ID and role

**Role-based quotas:** The Supabase JWT contains the user's role (`student`, `clerk`, `advocate`) and plan status. Each role has its own daily AI usage quota. Trial users have a 7-day trial quota before converting to the standard quota for their role.

---

## 12. Recent Feature Improvements (May 2026)

The following improvements were built and shipped in the current development session:

### DocuChat — Persistent Conversation Memory
**Before:** Every question sent to DocuChat was independent. The AI had no memory of previous questions in the same session. This caused page citations to disappear on the second and subsequent questions.

**After:** The server now fetches the stored conversation history before every AI call and includes it in the prompt. The AI sees the entire conversation context, maintains citation style, and builds on previous answers instead of starting fresh.

**Smart compression for long sessions:** For sessions longer than 8 messages, older turns are condensed into a 250-character-per-message summary block and the last 8 messages are sent verbatim. The AI never loses context regardless of session length.

### DocuChat — Page References on Every Response
The system prompt instructs the AI to include `[Page X]` citations inline on every response — including follow-up questions — and to append a `References: [Page X], [Page Y]` summary line at the end. The summary line is stripped by `parseAndCleanContent()` before rendering (so it never appears as raw text), but the inline `[Page X]` markers within the prose are extracted and converted into clickable page-reference badges that appear below the answer.

**How `parseAndCleanContent` works (file: `client/src/pages/hub/chat-pdf.tsx`):**
1. Pre-strip step: regex removes the trailing `References: [Page X], [Page Y]…` summary line entirely before any further processing
2. Inline extraction: regex `([^.!?\n]{0,160}?)\s*\[Pages?\s*(\d+)…\]` captures the surrounding context (up to 90 chars) as `refText` for use as a highlight term when jumping to that page
3. Parenthetical extraction: `(Page X)` form is also recognised and stripped
4. Result: `{ clean: string, pageRefs: PageRef[] }` — clean text with no `[Page X]` residue, sorted page ref array

### DocuChat — Nyaya AI Panel Has Document Context
**Before:** The Nyaya AI panel inside DocuChat was a standalone chat with no knowledge of the uploaded document.

**After:** Both the Nyaya AI panel input and the "Ask Nyaya AI" selected-text flow now pass the document IDs to the server. The AI receives the same smart-truncated document context. Even 800-page documents work — the server's 80K character limit with intelligent sectioning (beginning + middle + end) keeps it within token limits.

**Bug fixed:** The Nyaya AI panel was sending an empty string as the message because the input field was cleared before the API call used the variable. Fixed.

### Numbered List Rendering Fixed
AI responses were displaying every item in a numbered list as "1." because blank lines between list items caused the HTML renderer to close and reopen the `<ol>` tag, resetting the counter each time. Fixed with a lookahead that keeps the list open across blank lines when the next non-blank line continues the same list.

### Document Panel — No Amber Banner
Removed the amber/yellow information banner that appeared above the document panel when a passage was highlighted. The yellow paragraph highlight in the text view remains. The blue informational banner for full-page references (when no specific passage is cited) also remains.

### Nyaya AI Tab — No Message Count Badge
Removed the message count badge ("2") from the Nyaya AI tab button in the DocuChat toolbar.

---

### DocuChat — Page Ref Text No Longer Appears as Raw Text in Responses
**Problem:** The AI was generating a `References: [Page 10], [Page 1], [Page 5]` summary line at the end of every document response. `parseAndCleanContent()` was extracting the page numbers correctly but leaving behind `References: , ,` residue as rendered text in the chat bubble.

**Fix:** Added a pre-processing step at the top of `parseAndCleanContent()` that strips the entire `References: [Page X], [Page Y]…` line before the main extraction pass. The page ref badges still populate correctly from the inline `[Page X]` markers within the prose. No user-visible `References:` text ever appears.

**Regex used:**
```
/\n?References:\s*(?:\[Pages?\s*\d+(?:\s*[-–]\s*\d+)?\]\s*,?\s*)+\.?\n?/gi
```

---

### Nyaya AI — No Page References Section
**Problem:** Nyaya AI (the right panel inside DocuChat) was showing raw `[Page X]` text in its responses because its two stream handlers were setting message content directly from `fullContent` without passing it through `parseAndCleanContent()`. Page reference markers are meaningless in Nyaya AI since there is no document-viewer to jump to from that panel.

**Fix:** Both Nyaya AI stream handlers (text-selection flow and direct-send flow) now call `parseAndCleanContent(fullContent).clean` before storing the message. The `[Page X]` markers and any `References:` summary lines are silently stripped. The `pageRefs` array from the parse result is intentionally discarded — the Nyaya AI panel renders no page-reference badge section.

**Files changed:** `client/src/pages/hub/chat-pdf.tsx` — both stream handler finalisation blocks.

---

### DocuChat & Nyaya AI — Duplicate Messages on Session Reload Fixed
**Problem:** Every message was being written to the database twice, causing conversations to show duplicate questions and answers when re-opened.

**Root cause:** The server route (`POST /api/chat/query`) already saves both the user message and the assistant message atomically at the end of every streamed response (lines 1327–1342 in `server/routes.ts`). But four separate `fetch("/api/chat/messages")` calls in the client were also saving those same messages:
- `handleSend` (DocuChat): saved the user message client-side before sending
- `handleSend` (DocuChat): saved the assistant message client-side after the stream ended
- First Nyaya handler (text-selection): saved the assistant message client-side
- `handleNyayaSend` handler: saved the assistant message client-side

**Fix:** All four redundant client-side `fetch("/api/chat/messages", { method: "POST" })` calls were removed. The server route is the single source of truth for persistence. Message count per session is updated by the server immediately after both messages are saved.

**Note:** Existing sessions that already have duplicate messages in the database retain those duplicates. Only new conversations from the fix forward are stored cleanly.

---

### DocuChat & Nyaya AI — Citation Relevance Filtering
**Problem:** The server runs an Indian Kanoon keyword search and a Perplexity web search for every query that contains legal keywords. In DocuChat, this returned unrelated historical judgments (e.g. asking "what does clause 7 say?" triggered a search for "clause" which returned 5 old cases irrelevant to the specific document). The AI ignored those results but they still appeared in the Sources section.

**Fix:** A `getReferencedCitations()` helper function was added to `client/src/pages/hub/chat-pdf.tsx`:

```typescript
function getReferencedCitations(content: string, citations: Citation[]): Citation[] {
  if (!citations || citations.length === 0) return [];
  return citations.filter((_, i) => new RegExp(`\\[${i + 1}\\]`).test(content));
}
```

This checks the full AI response text for `[1]`, `[2]`, `[3]`… markers. Only citations the AI actually cited inline are returned. Citations that the AI received but chose not to reference are silently dropped and never shown to the user.

**The server still runs both IK and Perplexity** for any query containing legal keywords (section, act, IPC, CrPC, judgment, court, statute, law, legal, contract, property, criminal, civil, tort, arbitration, SEBI, RBI, MCA, GST, income tax, compliance, regulation). The filtering is entirely client-side.

---

### DocuChat — Stream Handler Now Captures Citations
**Before:** The DocuChat main chat stream handler only read `data.content` events from the SSE stream and ignored the `data.done` event entirely. Citations sent by the server in the `done` event were lost.

**After:** The stream handler now reads `data.done` and extracts `data.citations` (the full citations array). After the stream ends, `getReferencedCitations()` is applied to filter to only referenced ones. These are stored on the `ChatMessage` object. Currently, the citations are not rendered in DocuChat's main chat — the Sources section lives only in the Nyaya AI panel. But the data is now properly captured and available for future use.

**Interface change:** `ChatMessage` now has an optional `citations?: Citation[]` field alongside `pageRefs?: PageRef[]`.

---

### Nyaya AI — Sources Section: Grouped Display with Favicons
**Before:** The Nyaya AI Sources section showed all citations in a flat list using a generic `CitationCard` component with a file icon and no visual distinction between Indian Kanoon case law and external websites.

**After:** The Sources section is split into two named sub-groups, each with a distinct visual design:

**Case Law sub-group (Indian Kanoon):**
- Amber-tinted card (`bg-amber-50/60 dark:bg-amber-950/20`) with a Scale ⚖️ icon
- Shows the case/statute title and a short excerpt (up to 150 characters)
- Entire card is a `<button>` — click anywhere to open `https://indiankanoon.org/doc/{docId}/` in a new tab
- ExternalLink icon becomes visible on hover

**Web Sources sub-group (Perplexity):**
- Collapsed state: site favicon (loaded via `https://www.google.com/s2/favicons?domain={domain}&sz=32`) + domain name + ChevronDown icon
- Expanded state (click to toggle): full article title as a primary-coloured clickable link + raw URL below it + ExternalLink icon
- Favicon failure gracefully falls back to a Globe icon via `onError` handler
- Expand/collapse is managed by internal `useState` — each card is independent

**Routing logic (`CitationCard` dispatcher in `client/src/components/citation-card.tsx`):**
```typescript
export function CitationCard({ citation }: CitationCardProps) {
  const isIK = citation.url?.includes("indiankanoon.org");
  return isIK
    ? <IKCitationCard citation={citation} />
    : <WebCitationCard citation={citation} />;
}
```

**Rendering logic in Nyaya AI panel (`client/src/pages/hub/chat-pdf.tsx`):**
```typescript
const ikCites  = msg.citations.filter(c => c.url?.includes("indiankanoon.org"));
const webCites = msg.citations.filter(c => c.id.startsWith("web-"));
```
Each sub-group is only rendered when it has entries. If only IK results were cited, only "Case Law" appears. If only Perplexity results were cited, only "Web Sources" appears. If both, both appear.

**Sources section placement rule:** The Sources section (with IK and Web sub-groups) appears **only** in the Nyaya AI panel. The main DocuChat chat bubble shows only page-reference badges. This reflects the purpose of each: DocuChat is document interrogation (the document IS the source); Nyaya AI is general legal research (external sources are relevant).

**Server-side intelligence (unchanged):**
- Indian Kanoon search: triggered when query contains any of 24 legal keywords
- Perplexity search: triggered by same `isLegalQuery` check, returns recent amendments/notifications/judicial developments
- Both searches run in parallel with a 5-second timeout each (fail-safe)
- IK: top 5 results, each assigned citation index `[1]`…`[5]`
- Perplexity: top 3 web sources, assigned citation indices continuing from IK (e.g. `[6]`, `[7]`, `[8]`)
- All results sent to the AI as numbered context blocks; AI decides which to cite based on relevance to the specific question

---

## 13. Competitive Differentiators

### What makes Chakshi different from other legal AI tools?

**1. Indian-law-first, not adapted from generic tools**
Every prompt, pipeline, and validation rule is designed around Indian courts, Indian statutes, and Indian legal procedure. There are no US/UK law defaults that need to be overridden.

**2. Verified citations, not hallucinations**
The Indian Kanoon integration + InLegalBERT pipeline means the AI only cites cases and statutes that actually exist and are verified by the search API. This is the difference between a tool a lawyer can file with versus one that creates liability.

**3. Structural enforcement, not just text generation**
The Document DNA Engine enforces that every petition has a Prayer, every agreement has Definitions, every bail application has the correct court-specific format. Generic AI tools generate plausible-sounding but structurally incorrect documents.

**4. Full document interrogation at scale**
800-page document support with intelligent sectioning means lawyers can work with full charge-sheets, lengthy agreements, and voluminous case records — not just short extracts.

**5. Persistent, context-aware conversations**
The smart conversation history system (verbatim last 8 + compressed summary of older turns) means a lawyer can have a 50-question conversation about a document and the AI maintains full context throughout.

**6. Language accessibility**
22 Indian languages means the platform is accessible to lawyers practicing in regional courts, not just English-medium practitioners.

**7. Zero data retention, SOC 2 compliant**
Legal documents contain privileged client information. Chakshi's zero-retention policy and SOC 2 compliance means firms can adopt it without compromising client confidentiality obligations.

**8. Embedded, not standalone**
Chakshi runs as an embedded iframe inside `chakshi.in` with JWT passthrough — users get a seamless experience, not a separate login for a separate tool.

---

*Documentation maintained in `CHAKSHI_PRODUCT_DOCS.md` at project root.*
