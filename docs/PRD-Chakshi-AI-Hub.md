# Product Requirements Document
## Chakshi AI Hub — AI-Powered Legal Assistant Platform for Indian Legal Professionals

**Version:** 1.0  
**Status:** Delivered  
**Prepared For:** Client Review / Investor Due Diligence  
**Platform:** Web Application (embedded iframe + standalone)

---

## 1. Product Overview

Chakshi AI Hub is a comprehensive AI-powered legal assistant platform designed exclusively for Indian legal professionals. It provides intelligent tools for legal drafting, research, document analysis, compliance, and practice management — all within a unified interface that embeds into the main Chakshi platform via an iframe.

The platform is built with a zero data retention policy, SOC 2 compliance standards, and a strict anti-hallucination framework to ensure legal accuracy and user trust.

---

## 2. Target Users

| Role | Description | Primary Use |
|---|---|---|
| Advocate | Practising lawyers — district, high court, Supreme Court | Drafting, research, memos, translation |
| Clerk | Legal office clerks and paralegal staff | Document processing, compliance, case tracking |
| Law Student | LLB / LLM students and interns | Research, learning tools, case analysis |

Each role has its own separate 7-day trial plan followed by a role-specific subscription plan.

---

## 3. Problem Statement

Indian legal professionals face the following challenges daily:

- Drafting court-ready documents is time-consuming and requires cross-referencing multiple statutes and precedents
- Legal research across Indian Kanoon, bare acts, and case law is fragmented and manual
- Document translation between English and 22 Indian regional languages lacks legal accuracy
- Tracking recent legal amendments, notifications, and judicial developments is difficult
- Small firms and solo practitioners cannot afford dedicated research staff
- Risk of citation errors and hallucinated legal references in AI-generated content is high

Chakshi AI Hub directly addresses all of the above.

---

## 4. Goals

- Provide court-ready legal document generation with verified Indian statute and case law citations
- Reduce time spent on legal research by 60–70% through an automated multi-layer research pipeline
- Support all 22 Indian official languages for drafting and translation
- Ensure zero hallucinated citations through anti-hallucination safeguards and verified source injection
- Handle 1,000 concurrent users with role-based access, usage quotas, and cost controls
- Embed seamlessly inside the main Chakshi platform at chakshi.in and chakshi.com via iframe

---

## 5. Core Feature Requirements

### 5.1 Drafting

#### 5.1.1 AI Legal Drafting
- User selects document type (Plaint, Written Statement, Petition, Agreement, Notice, Affidavit, etc.)
- User provides facts, parties, jurisdiction, court, and relevant details
- System runs pre-draft validation:
  - Category validation (document type feasibility)
  - Court and jurisdiction check
  - Limitation period check
  - Factual sufficiency check
- System runs three-layer legal research pipeline (see Section 7) before generating content
- GPT-4.1 generates the draft using Document DNA structure enforcement
- Output enforces specific structural blocks: cause of action, prayer clause, verification, etc.
- Self-validation quality gate (Judge Simulator Report) checks the output before delivery
- All citations must follow: Act Name + Year + Section (statutes) or Case Name + Court + Year + Reporter (cases)
- Unverified citations are flagged as `[CITATION NEEDED - VERIFY]`
- Missing information uses placeholders: `[BLANK]` or `[TO BE FILLED BY USER]` — never fabricated
- Output available in any of 22 Indian languages
- Streaming output supported (user sees content generating word by word)

#### 5.1.2 Empty Document
- Opens a rich text editor with a blank document
- User writes their own content from scratch
- AI assist tools available within the editor (refine, polish, analyse risk)

#### 5.1.3 Custom Drafting
- User uploads their own format or template
- AI generates content following the uploaded structure exactly
- Supports PDF, DOCX, DOC formats for template upload

#### 5.1.4 Firm SOP Training
- User uploads firm-specific SOPs, past judgments, or previous drafts
- AI learns the firm's specific drafting style, formatting preferences, and clause language
- Subsequent drafts from that user follow the trained style
- Uploaded training documents stored separately from regular documents

---

### 5.2 AI Chat

#### 5.2.1 Nyaya AI — General Legal Assistant
- Expert legal chatbot trained on Indian law
- Handles queries on statutes, case law, legal procedures, rights, remedies
- Uses gpt-4o-mini for simple queries, gpt-4.1 for complex legal analysis
- Supports 22 Indian languages in both input and output
- Includes real-time cost display per conversation
- Voice input supported via Whisper transcription
- Voice output supported via OpenAI TTS (nova voice)
- Maintains conversation history within a session

#### 5.2.2 DocuChat — Chat with Uploaded Documents
- User uploads PDF, DOCX, or DOC legal documents (up to 100 MB, up to 800 pages)
- System extracts and processes document text:
  - DOCX: converted via mammoth.js preserving structure
  - PDF/TXT: processed via textToLegalHtml preserving clause structure
  - Scanned documents: OCR processing
- HTML sanitisation applied for XSS protection
- User asks questions about the uploaded document
- AI provides answers with inline source references from the document
- Features: summarisation, timeline extraction, issue tagging, clause identification
- Document segments classified by type: Facts / Arguments / Ruling / Statute / etc. (via InLegalBERT)
- Documents auto-deleted after a configured retention period

#### 5.2.3 CNR Chatbot — Case Status Lookup
- User enters CNR number (Case Number Record from eCourts)
- System queries case status from Indian court records
- Returns: case details, next hearing date, orders, disposal status
- Supports saving cases for future reference
- Works across all Indian district and high courts on the eCourts system

---

### 5.3 Research

#### 5.3.1 AI Research Assistant
- Searches Indian Kanoon for relevant statutes and case law
- InLegalBERT (Layer 0) identifies relevant statutes from user's query before searching
- Enhanced search queries generated from InLegalBERT statute identification
- Results ranked by semantic relevance using cosine similarity
- Returns: DocID, title, excerpt, court, year for each result
- Perplexity advisory layer adds recent amendments and judicial developments
- Results displayed with confidence scores and source citations
- Notes can be saved from research results

#### 5.3.2 Legal Memo Generator
- Supports IRAC, CRAC, CREAC, and FIRAC memo structures
- User provides: legal issue, facts, jurisdiction
- System runs full research pipeline before generating memo
- Output follows strict structure: Issue → Rule → Application → Conclusion
- All cited statutes and cases verified against Indian Kanoon results
- Streaming output supported
- Available in 22 Indian languages

#### 5.3.3 Compliance Checklist Generator
- User provides: industry type, business activity, jurisdiction (state/central)
- System identifies applicable regulatory frameworks
- Perplexity advisory layer checks for recent regulatory updates and notifications
- Output: structured checklist with applicable acts, sections, compliance deadlines, and regulatory bodies
- Covers: GST, labour laws, environmental regulations, sector-specific regulations, FEMA, Companies Act, etc.
- Each checklist item includes the specific legal reference

#### 5.3.4 Saved Notes
- Research results, memo excerpts, and case summaries can be saved as notes
- Notes are tied to the user's account
- Notes can be retrieved, edited, and deleted
- Full list view with search functionality

---

### 5.4 Study Buddy (Beta)

#### 5.4.1 Case Predict AI *(Coming Soon)*
- Predicts likely case outcomes based on facts, jurisdiction, and precedents
- Returns probability scores and confidence levels for different outcomes
- Identifies applicable precedents and their influence weight
- Risk assessment for strategic decision-making

#### 5.4.2 Counter Argument Generator *(Coming Soon)*
- User inputs their own legal argument or opposing counsel's argument
- AI generates strongest counter-arguments based on Indian case law and statutes
- Identifies weaknesses in the original argument
- Suggests alternative legal strategies

#### 5.4.3 Legal Sandbox *(Coming Soon)*
- Simulated legal scenario environment for learning and practice
- Law students can test legal arguments in mock scenarios
- Provides feedback on argument quality, citation accuracy, and legal reasoning

---

### 5.5 Voice Assistant — LexAI Robot
- 3D animated robot interface with emotional facial expressions
- Hands-free operation for legal professionals
- Speech-to-text via OpenAI Whisper for voice input transcription
- Text-to-speech via OpenAI TTS (nova voice) for AI response playback
- Integrated with Nyaya AI for voice-based legal queries
- Graceful degradation: if voice fails, text interface remains available

---

### 5.6 Document Translation
- Translates legal documents between English and any of 22 Indian languages
- Uses gpt-4.1 for legal-quality multilingual output
- Preserves legal terminology, formatting, and clause structure
- Output capped at 4,000 tokens to maintain quality
- Supports: Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Assamese, Urdu, and other scheduled Indian languages

---

### 5.7 Google Calendar Integration
- Bidirectional synchronisation with Google Calendar
- Sync legal academic events, court hearings, filing deadlines, and professional events
- Events created in Chakshi appear in Google Calendar and vice versa
- Reminder support for limitation periods and hearing dates

---

### 5.8 Cost Ledger and Usage Tracking
- Real-time per-session AI usage cost display
- Model badge shown on each AI response (gpt-4o-mini / gpt-4.1 / o3)
- Confidence indicators shown on research results
- Daily usage counter shown to user (calls used vs daily limit)
- Admin audit log accessible via secure admin endpoint

---

## 6. User Roles and Access Control

### 6.1 Authentication
- All API access requires a valid Supabase JWT token
- JWT extracted from `Authorization: Bearer <token>` header
- Role extracted from JWT claims: `chakshi_role`, `user_role`, `app_metadata.role`, or `user_metadata.role`
- Plan extracted from JWT claims: `chakshi_plan`, `plan`, `app_metadata.plan`, or `user_metadata.plan`
- Platform embedded as iframe in chakshi.in and chakshi.com
- `X-Frame-Options` removed; `Content-Security-Policy: frame-ancestors *` set to allow embedding

### 6.2 AI Usage Quotas

| Role | Trial Duration | Trial Daily Limit | Regular Daily Limit |
|---|---|---|---|
| Law Student | 7 days | 25 AI calls/day | 30 AI calls/day |
| Clerk | 7 days | 35 AI calls/day | 50 AI calls/day |
| Advocate | 7 days | 50 AI calls/day | 100 AI calls/day |

- Each user additionally limited to 20 AI requests per minute
- Trial is role-specific — not a shared trial across all roles
- Trial expiry and plan upgrade handled by main Chakshi app / Supabase metadata

---

## 7. Technical Architecture (Summary)

### 7.1 Three-Layer Legal Research Pipeline

Every draft, memo, and research action runs through this pipeline before AI generation:

**Layer 0 — InLegalBERT (Statute Pre-Identification)**
- HuggingFace Inference API using law-ai/InLegalBERT model
- Identifies relevant statutes from user's facts via embedding similarity
- Generates enhanced search queries for Indian Kanoon
- Ranks results by semantic relevance using cosine similarity
- Classifies document segments by type
- Falls back to keyword-based identification if HuggingFace API unavailable

**Layer 1 — Indian Kanoon (Primary Authority)**
- Searches for statutes and case law before any drafting begins
- Returns verified sources: DocID, title, excerpt
- AI instructed to ONLY cite from this verified list
- Non-verified citations flagged as `[CITATION NEEDED - VERIFY]`

**Layer 2 — Perplexity Sonar (Advisory — Currency and Risk)**
- Searches for recent amendments, notifications, judicial developments
- Results marked advisory only — never cited as authority
- User warned to verify from official gazettes
- Cached 24 hours; retried with exponential backoff; burst-safe rate protection

All layers fail safely — pipeline continues without any layer that is unavailable.

### 7.2 Anti-Hallucination Safeguards

- Citation accuracy enforced: Act Name + Year + Section for statutes; Case Name + Court + Year + Reporter for cases
- Unverified citations marked `[CITATION NEEDED - VERIFY]`
- Missing information uses placeholders, never fabricated
- Strict authority hierarchy enforced: Statute > Case Law > Commentary
- Judge Simulator self-validation on all drafts and memos

### 7.3 AI Model Routing

| Task | Model |
|---|---|
| Simple chat, draft assist, compliance, refine | gpt-4o-mini |
| Legal drafting, memo generation, translation, complex research | gpt-4.1 |
| Complex multi-step reasoning (when required) | o3 |
| Voice transcription | Whisper |
| Voice output | OpenAI TTS (nova) |

- GPT-4.1 and o3 routed through separate standard queue (default 2 concurrent) to prevent TPM bursts
- gpt-4o-mini uses general AI queue (default 10 concurrent)
- Exponential backoff retry on all OpenAI calls
- Graceful "AI service busy" response if queue timeout reached

### 7.4 Caching

- In-memory cache for repeated research queries (Indian Kanoon, Perplexity, compliance)
- TTL: 24 hours per entry
- Maximum 500 cache entries; oldest evicted when full
- Hourly sweep removes expired entries
- Cache not applied to personalised calls (chat, drafts) — these depend on per-user context

### 7.5 Document Processing and Storage

- Supported formats: PDF, DOCX, DOC, scanned images (OCR)
- Maximum upload size: 100 MB per file
- Supabase Storage used for document storage (per-user isolation)
- Documents auto-deleted after retention period
- XSS protection via sanitize-html on all processed document content

---

## 8. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Security | SOC 2 compliant standards; zero data retention policy; XSS protection; server-side error sanitisation (no stack traces exposed); React ErrorBoundary for graceful crash handling |
| Authentication | Supabase JWT on all API routes |
| Scalability | Queue-based AI concurrency; caching layer; supports 1,000 registered users |
| Uptime | Graceful degradation on vendor API failures; no single point of failure |
| Language Support | 22 Indian official languages |
| Embedding | iframe-compatible; works inside chakshi.in and chakshi.com |
| Audit | All AI actions logged to audit table with user, action, resource, timestamp |
| Rate Limiting | Global: 60 requests/minute per IP; AI endpoints: 20 requests/minute per user |
| Response Format | JSON for all API responses; SSE streaming supported for drafts and memos |

---

## 9. Supported File Formats

| Format | Use Case | Processing Method |
|---|---|---|
| PDF | Document upload, template, SOP | textToLegalHtml, OCR for scanned |
| DOCX | Document upload, template, SOP | mammoth.js to HTML |
| DOC | Document upload | mammoth.js to HTML |
| Scanned image (PDF) | Scanned legal documents | OCR processing |
| Audio (MP3/WAV) | Voice input via LexAI | OpenAI Whisper transcription |

---

## 10. External Integrations

| Service | Purpose | Fallback |
|---|---|---|
| OpenAI (gpt-4o-mini, gpt-4.1, o3) | Core AI generation | Retry with backoff; queue protection |
| OpenAI Whisper | Voice transcription | Text input remains available |
| OpenAI TTS | Voice output | Text response shown instead |
| Indian Kanoon API | Primary legal authority | Draft continues; citations flagged for verification |
| HuggingFace / InLegalBERT | Statute identification and result ranking | Keyword-based fallback |
| Perplexity Sonar | Recent amendments and advisory signals | Advisory layer skipped; draft continues |
| Supabase | Authentication (JWT), file storage, user metadata | N/A — required |
| Google Calendar API | Bidirectional event sync | Calendar feature unavailable; rest of platform unaffected |

---

## 11. Pages and Navigation

| Section | Page | Path |
|---|---|---|
| Hub | Main Dashboard | /hub |
| Drafting | AI Legal Drafting | /hub/drafting/ai |
| Drafting | Empty Document | /hub/drafting/empty |
| Drafting | Custom Drafting | /hub/drafting/custom |
| Drafting | Train Your Drafts | /hub/drafting/train |
| AI Chat | Nyaya AI | /hub/chat/nyaya |
| AI Chat | DocuChat | /hub/chat/pdf |
| AI Chat | CNR Chatbot | /hub/chat/cnr |
| Research | AI Research Assistant | /hub/research/assistant |
| Research | Legal Memo Generator | /hub/research/memo |
| Research | Compliance Checklist | /hub/research/compliance |
| Research | Saved Notes | /hub/research/notes |
| Study Buddy | Case Predict AI | /hub/study/case-predict |
| Study Buddy | Counter Arguments | /hub/study/counter-args |
| Study Buddy | Legal Sandbox | /hub/study/sandbox |
| Utility | Settings | /settings |
| Utility | Documents | /documents |
| Utility | Dashboard | /dashboard |
| Embed | Nyaya AI Widget | /embed/nyaya |
| Embed | CNR Cases Widget | /embed/cnr-cases |

---

## 12. Out of Scope

The following are not part of the current delivered product:

- Native mobile application (iOS / Android)
- Payment gateway / billing system (handled by main Chakshi platform)
- User registration and login UI (handled by main Chakshi platform via Supabase)
- Automated court filing or e-filing integration
- Real-time video or audio conferencing
- Multi-user collaboration on a single document simultaneously
- White-labelling for third-party law firms (separate engagement)
- Case Predict AI, Counter Arguments, Legal Sandbox — UI placeholder delivered; AI functionality marked Coming Soon

---

## 13. Future Roadmap

| Feature | Priority | Notes |
|---|---|---|
| Case Predict AI | High | AI outcome prediction with probability scoring |
| Counter Argument Generator | High | Strategic legal argument analysis |
| Legal Sandbox | Medium | Learning and simulation environment |
| Self-hosted InLegalBERT | High | Remove HuggingFace rate limits and cold starts |
| Redis cache | Medium | Replace in-memory cache for multi-server scalability |
| Mobile app | Low | Expo-based React Native |
| Offline mode | Low | Basic document access without internet |
| Multi-user document collaboration | Medium | Real-time co-drafting |
| eCourts deep integration | High | Full case tracking beyond CNR lookup |
| White-label for law firms | Medium | Firm-branded deployment |

---

## 14. Glossary

| Term | Meaning |
|---|---|
| CNR | Case Number Record — unique identifier for Indian court cases on the eCourts system |
| InLegalBERT | A BERT-based NLP model fine-tuned on Indian legal text for statute identification and document classification |
| IRAC | Issue, Rule, Application, Conclusion — standard legal memo structure |
| CREAC | Conclusion, Rule, Explanation, Application, Conclusion — variant memo structure |
| Indian Kanoon | India's largest free legal database covering case law and statutes |
| JWT | JSON Web Token — used for secure user authentication |
| SOC 2 | Security compliance standard covering security, availability, and confidentiality |
| TPM | Tokens Per Minute — OpenAI's rate limit measure for AI model usage |
| RAG | Retrieval-Augmented Generation — AI technique that retrieves verified sources before generating content |
| Document DNA | Chakshi's proprietary structural enforcement system ensuring legal documents follow court-ready format |
| LexAI | Chakshi's 3D voice assistant robot interface |

---

*Document prepared based on the fully delivered and deployed Chakshi AI Hub platform.*
