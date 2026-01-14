# Chakshi - Legal AI Platform

### Overview
Chakshi is an AI-powered legal assistant platform specifically designed for Indian legal professionals. It offers a comprehensive suite of legal AI services aimed at streamlining legal workflows, enhancing research capabilities, and improving drafting efficiency. The platform is SOC 2 compliant, ensuring high standards of data security and privacy with a zero data retention policy. Key capabilities include advanced document processing, intelligent chat with multi-layer RAG reasoning, AI-powered legal drafting with integrated research, legal memo generation, and compliance checklist tools. Chakshi supports 22 Indian languages, provides real-time cost tracking, and includes inline source citations with confidence scores, making it a robust and reliable tool for the Indian legal sector. The platform's vision is to empower legal professionals with cutting-edge AI to make informed decisions, draft court-ready documents, and manage their practice more effectively.

### User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
I want to be communicated with simple language.
I like functional programming.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

### System Architecture
The Chakshi platform is built with a modern web stack, featuring a React with TypeScript frontend, a Node.js with Express backend, and leverages OpenAI via Replit AI Integrations for its core AI functionalities.

**UI/UX Decisions:**
The user interface is structured around a central "Chakshi AI Hub" with distinct sections for Drafting, AI Chat, and Research, including a "Study Buddy" for beta features. The design utilizes TailwindCSS and shadcn/ui components for a consistent and responsive user experience. Key UI elements include model badges, confidence indicators, cost displays, and a theme provider for dark/light modes.

**Technical Implementations:**
- **Frontend:** React with TypeScript, Vite, TailwindCSS, shadcn/ui components, TanStack Query (React Query) for state management, and wouter for routing.
- **Backend:** Node.js with Express, providing API endpoints for document management, chat interactions, drafting, research, memo/compliance generation, statistics, and calendar integration.
- **AI Integration:** Multi-tier AI model routing (gpt-4o-mini, gpt-4.1, o3) is implemented to optimize for cost and complexity across different use cases. Strong language instructions are used in AI prompts for precise content generation in selected Indian languages.
- **Document Processing:** Supports PDF, Word (DOCX, DOC), and scanned images with OCR. Uses `mammoth.convertToHtml` for DOCX and `textToLegalHtml` for PDF/TXT to preserve document structure. HTML sanitization is used for XSS protection.
- **Legal Drafting Pipeline:** Implements a "Court-Ready Legal Drafting Pipeline" with layered validation. This includes `PreDraftValidation` (category, court, jurisdiction, limitation, factual sufficiency), `DocumentDNABlock` (enforcing specific structural blocks in legal documents), and `JudgeSimulatorReport` for self-validation.
- **Anti-Hallucination Safeguards:** Ensures citation accuracy (Act Name + Year + Section for statutes, Case Name + Court + Year + Reporter for cases), marks unverified citations, and uses placeholders (`[BLANK]`, `[TO BE FILLED BY USER]`) for missing information instead of fabrication. Enforces a strict hierarchy of authority (Statute > Case Law > Commentary).
- **Localization:** Support for 22 Indian languages in drafting, chat, and other AI-generated content. Includes a document translation API endpoint.
- **Calendar Integration:** Bidirectional Google Calendar synchronization for managing legal academic and professional events.

**Feature Specifications:**
- **Drafting:** AI Legal Drafting with research panel, custom drafting, empty document creation, and firm SOP training for personalized AI style.
- **AI Chat:** Chat with uploaded PDFs (summarization, timelines, issue tagging), Nyaya AI (general legal assistant), and CNR Chatbot (case status lookup).
- **Research:** AI Research Assistant (Indian Kanoon API integration), Legal Memo Generator (IRAC structure), Compliance Checklist Generator (industry-specific with references), and Saved Notes management.
- **Study Buddy (Beta):** Case Predict AI, Counter Argument Generator, and Legal Sandbox for learning and simulation.
- **Security & Compliance:** SOC 2 compliant, zero data retention, and XSS protection.

### External Dependencies
- **OpenAI:** Used for various AI models (gpt-4o-mini, gpt-4.1, o3) via Replit AI Integrations for natural language processing, content generation, and intelligent reasoning.
- **Indian Kanoon API:** Integrated for comprehensive statute and case law search and document retrieval specific to Indian legal contexts.
- **Google Calendar API:** Utilized for bidirectional synchronization of legal events, enabling users to manage their academic and professional schedules within the platform and externally.
- **`mammoth.js`:** Library used for converting `.docx` files to HTML, preserving document structure during upload and processing.
- **`sanitize-html`:** Library used for HTML sanitization to prevent XSS vulnerabilities, particularly with uploaded document content.
- **Perplexity API:** Used for currency and risk signals - recent amendments, notifications, and judicial developments (advisory layer, not primary authority).

### Legal Research Layer (Mandatory Pipeline)
The drafting and memo generation endpoints implement a two-layer research pipeline:

**Layer 1: Indian Kanoon (Primary Authority)**
- Searches for relevant statutes and case law BEFORE drafting
- Returns verified sources with DocID, title, and excerpt
- AI is instructed to ONLY cite from this verified list
- Non-verified citations must be marked as "[CITATION NEEDED - VERIFY]"

**Layer 2: Perplexity (Currency & Risk Signals - Advisory Only)**
- Searches for recent amendments, notifications, and judicial developments
- Results are marked as advisory only - not to be cited as authority
- Warns user to verify from official gazettes

Both layers fail safely - if a search fails, the pipeline continues without that context.

### Pipeline Flow
```
User Input → Pre-Draft Validation (types) → Legal Research Layer (Indian Kanoon + Perplexity)
           → Document DNA Engine (prompts) → Drafting Engine (LLM) → Self-Validation Quality Gate
           → Final Output
```