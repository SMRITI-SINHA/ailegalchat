# Chakshi - Legal AI Platform

## Overview
Chakshi is a SOC 2-compliant AI-powered legal assistant platform for Indian legal professionals. It provides comprehensive legal AI services including document processing, intelligent chat with multi-layer RAG reasoning, legal drafting with integrated research, legal memo generation, and compliance checklist tools.

## Features

### Chakshi AI Hub
The platform is organized into three main sections:

**Drafting**
- AI Legal Drafting - Draft with AI research panel integration
- Empty Document - Start with a blank canvas
- Custom Drafting - Upload your own format/template
- Train Your Drafts - Upload firm SOPs to train AI on your style

**AI Chat**
- CNR Chatbot - Case status lookup (placeholder for integration)
- Chat with PDF - Upload documents (800+ pages), generate timelines, tag issues, find evidence
- Nyaya AI - General legal assistant trained on 1000+ legal documents

**Research**
- AI Research Assistant - Indian Kanoon API integration for statute/case law search
- Legal Memo Generator - IRAC structured memos with hallucination guard
- Compliance Checklist Generator - Industry-specific checklists with legal references
- Saved Notes - View and manage all research notes

**Study Buddy** (Beta: Coming Soon)
- Case Predict AI - Predict case outcomes using Advanced AI with detailed reasoning
- Counter Argument Generator - Develop opposing viewpoints, rebuttals, and explore multiple angles
- Legal Sandbox - Interactive learning environment for moot courts, entrance prep, and legal simulations

### Core Capabilities
- **Document Processing**: Upload PDFs, Word docs, and scanned images with OCR support
- **Multi-tier AI**: GPT-4o-mini (fast), GPT-4.1 (standard), o3 (pro) model routing
- **22 Indian Languages**: Support for Hindi, Marathi, Gujarati, Bengali, Telugu, Tamil, etc.
- **Cost Tracking**: Real-time cost monitoring and transparency
- **Citations**: Inline source citations with confidence scores
- **Zero Data Retention**: SOC 2 compliant data handling

## Tech Stack
- **Frontend**: React with TypeScript, Vite, TailwindCSS, shadcn/ui components
- **Backend**: Node.js with Express
- **AI**: OpenAI via Replit AI Integrations
- **Legal API**: Indian Kanoon API for statute/case law search
- **State Management**: TanStack Query (React Query)
- **Routing**: wouter

## Project Structure
```
├── client/src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # shadcn/ui base components
│   │   ├── app-sidebar.tsx
│   │   ├── model-badge.tsx
│   │   ├── confidence-indicator.tsx
│   │   ├── cost-display.tsx
│   │   ├── upload-dropzone.tsx
│   │   ├── citation-card.tsx
│   │   ├── streaming-text.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── pages/
│   │   ├── landing.tsx  # Public landing page
│   │   ├── dashboard.tsx
│   │   ├── documents.tsx
│   │   ├── chat.tsx
│   │   ├── drafting.tsx
│   │   ├── settings.tsx
│   │   └── hub/         # Chakshi AI Hub pages
│   │       ├── index.tsx           # Hub home
│   │       ├── drafting-ai.tsx     # AI Legal Drafting
│   │       ├── drafting-empty.tsx  # Empty document
│   │       ├── drafting-custom.tsx # Custom drafting
│   │       ├── drafting-train.tsx  # Train your drafts
│   │       ├── chat-cnr.tsx        # CNR chatbot
│   │       ├── chat-pdf.tsx        # Chat with PDF
│   │       ├── chat-nyaya.tsx      # Nyaya AI
│   │       ├── research-assistant.tsx  # AI Research
│   │       ├── research-memo.tsx       # Legal Memo
│   │       ├── research-compliance.tsx # Compliance Checklist
│   │       ├── research-notes.tsx      # Saved Notes
│   │       ├── study-case-predict.tsx  # Case Predict AI (Beta)
│   │       ├── study-counter-args.tsx  # Counter Arguments (Beta)
│   │       └── study-sandbox.tsx       # Legal Sandbox (Beta)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and query client
│   └── App.tsx          # Main app with routing
├── server/
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # In-memory storage layer
│   ├── indian-kanoon.ts # Indian Kanoon API service
│   └── replit_integrations/  # AI integration modules
├── shared/
│   └── schema.ts        # Shared TypeScript types and schemas
└── design_guidelines.md # UI/UX design guidelines
```

## API Endpoints

### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get single document
- `POST /api/documents/upload` - Upload documents (multipart/form-data)
- `DELETE /api/documents/:id` - Delete document

### Chat
- `GET /api/chat/sessions` - List chat sessions
- `POST /api/chat/sessions` - Create new session
- `POST /api/chat/query` - Send message (SSE streaming response)

### Drafting
- `GET /api/drafts` - List all drafts
- `GET /api/drafts/:id` - Get single draft
- `POST /api/drafts` - Create new draft
- `POST /api/drafts/generate` - Generate new draft with AI
- `PATCH /api/drafts/:id` - Update draft
- `DELETE /api/drafts/:id` - Delete draft

### Research
- `POST /api/research/search` - Search Indian Kanoon
- `POST /api/research/statutes` - Search statutes
- `GET /api/research/document/:docId` - Get document from Indian Kanoon
- `GET /api/research/notes?draftId=` - Get research notes (filtered by draftId)
- `POST /api/research/notes` - Create research note
- `DELETE /api/research/notes/:id` - Delete research note

### Memos & Compliance
- `POST /api/memos/generate` - Generate legal memorandum
- `POST /api/compliance/generate` - Generate compliance checklist

### Stats
- `GET /api/stats` - Get dashboard statistics
- `GET /api/costs` - Get cost ledger

### Calendar (Google Calendar Bidirectional Sync)
- `GET /api/calendar/google/auth-url` - Get Google OAuth authorization URL
- `GET /api/calendar/google/callback` - OAuth callback handler
- `GET /api/calendar/google/status` - Check Google Calendar connection status
- `POST /api/calendar/google/disconnect` - Disconnect Google Calendar
- `POST /api/calendar/google/sync` - Trigger manual sync (bidirectional)
- `GET /api/calendar/events` - List calendar events
- `POST /api/calendar/events` - Create event (syncs to Google if connected)
- `PATCH /api/calendar/events/:id` - Update event
- `DELETE /api/calendar/events/:id` - Delete event

## Model Tiers
| Tier | Model | Cost/Query | Use Case |
|------|-------|------------|----------|
| Mini | gpt-4o-mini | ~₹0.15 | Simple queries, quick answers |
| Standard | gpt-4.1 | ~₹0.40 | Case analysis, contract review |
| Pro | o3 | ~₹2.00 | Complex legal interpretation |

## Environment Variables
- `INDIAN_KANOON_API_TOKEN` - Token for Indian Kanoon API access (optional, uses mock data if not set)

## Running the Project
The application runs via `npm run dev` which starts both the Express backend and Vite frontend on port 5000.

## Recent Changes
- Implemented Chakshi AI Hub with 3 sections: Drafting, AI Chat, Research
- Added 11 new hub pages for complete legal AI workflow
- Integrated Indian Kanoon API service with search, statutes, and document retrieval
- Added Legal Memo Generator with IRAC structure
- Added Compliance Checklist Generator with industry-specific items
- Updated sidebar navigation with hub structure
- Added SOC 2 compliance badge and zero data retention indicator
- Support for 22 Indian languages in drafting
- Firm style training capability for consistent drafting
- Removed all mock data from Indian Kanoon service - now returns empty when API unavailable
- Added compliance checklist save/load functionality with tabbed interface (Generate/Saved tabs)
- Added research notes save functionality with naming capability
- Removed export button from compliance checklist generator
- Fixed UploadDropzone component prop usage (onUpload instead of onFilesSelected)
- Added HTML sanitization utility (stripHtmlTags) to clean Indian Kanoon search results
- Added Old vs New law categorization (BNS/BNSS/BSA = New Laws 2023+, IPC/CrPC/Evidence Act = Old Laws)
- Added Study Buddy section to hub home page with 3 beta features
- Added Study Buddy navigation group in sidebar with beta badges
- Created 3 Study Buddy placeholder pages (Case Predict AI, Counter Arguments, Legal Sandbox) marked as "Beta: Coming Soon"
- Added persistent research notes storage with backend API (researchNotes table)
- Research notes are scoped by draftId for context-aware persistence
- All editor entry paths (generate, upload, custom) create draft records before opening editor
- Research sidebar uses react-query with proper cache invalidation for notes
- Custom drafting upload view hides firm style/language controls until editor mode
- Redesigned Custom Drafting with multi-step wizard: language selection → format upload (with disclaimer) → case details → review & generate → opens in editor with research sidebar
- Redesigned Legal Memo Generator with language selection, opens generated memo in editor with research sidebar
- Backend endpoints (drafts/generate, memos/generate) now include strong language instructions for non-English content generation
- AI generates content precisely in the selected language (supports all 22 Indian languages)
- Added document translation API endpoint using OpenAI standard tier with legal terminology preservation
- PremiumEditor now has language selector in header with Translate button (appears when different language selected)
- Editor File menu redesigned with: Open (load saved drafts), Make a Copy, Download (txt/doc/pdf), Rename options
- Added Saved Notes page in Hub Research section to view and manage all research notes
- Editor properly syncs language selector with draft's actual language when opening saved drafts
- Added Legal Academic Calendar page with bidirectional Google Calendar sync
- Implemented Google Calendar OAuth flow (connect, disconnect, status endpoints)
- Created Google Calendar API service with token refresh, event CRUD, and bidirectional sync
- Calendar events can be created in Chakshi and automatically sync to Google Calendar
- Events from Google Calendar sync back to Chakshi with conflict handling
- Calendar UI with month navigation, event type filtering, and upcoming events panel
- Support for event types: academic, exam, career, court, professional
- Enhanced document structure preservation for uploaded drafts with extractedHtml field
- Added sanitize-html library for XSS protection on DOCX/DOC uploads
- textToLegalHtml function detects: numbered clauses (1., 2)), decimal numbering (1.1, 2.3.4.5), Roman numerals (I., (iv)), letters ((a), b.), bullets
- DOCX extraction uses mammoth.convertToHtml for structure preservation
- PDF/TXT extraction uses textToLegalHtml for legal formatting detection (court titles, headings, party markers)
- Page markers removed from extracted content (— 1 of 6 —, Page X, etc.)
- Added DetailQualityMeter component to measure input quality (word count, names, dates, legal terms)
- AI Legal Drafting "Type Facts" interface now has quality meter and "Additional Instructions for AI" section
- AI Legal Drafting "Upload Reference Docs" interface now has prompt box with quality meter for additional context
- Reference documents in AI Legal Drafting extract case DETAILS only (plain text), not structure
- Structure extraction is preserved for: Upload your own draft, Custom Draft templates, Train Your Drafts
- Old .doc format (Word 97-2003) detection with user-friendly error message and toast notification
- Toast notifications when files can't be processed, guiding users to convert to .docx format
- Train Your Drafts uses PostgreSQL with per-user isolation (userId field)
- Training docs store extractedHtml for structure preservation when useFirmStyle is enabled
- Enhanced AI Legal Drafting with expert-level Indian legal formatting (section order, heading hierarchy, numbering, verification clauses, proper terminology)
- Enhanced Legal Memo Generator with professional formatting (header template, IRAC/CRAC/CREAC section structure, citation format, anti-fabrication safeguards)
- Both generators now use placeholder markers ([BLANK], [TO BE FILLED]) instead of fabricating missing information
- Expert prompts include 30+ years senior advocate/law firm partner experience context for authentic drafting style
