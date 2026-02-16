# Chakshi - Legal AI Platform
## Technical Documentation & Architecture Guide

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Database Schema & Design](#5-database-schema--design)
6. [Backend Architecture](#6-backend-architecture)
7. [AI Pipeline & Model Routing](#7-ai-pipeline--model-routing)
8. [Legal Research Pipeline](#8-legal-research-pipeline)
9. [Drafting Engine](#9-drafting-engine)
10. [Document Processing](#10-document-processing)
11. [Voice Assistant & LexAI Robot](#11-voice-assistant--lexai-robot)
12. [Chat System](#12-chat-system)
13. [Legal Memo Generator](#13-legal-memo-generator)
14. [Compliance Checklist Generator](#14-compliance-checklist-generator)
15. [CNR Case Tracker](#15-cnr-case-tracker)
16. [Google Calendar Integration](#16-google-calendar-integration)
17. [Frontend Architecture](#17-frontend-architecture)
18. [API Reference](#18-api-reference)
19. [Security & Anti-Hallucination](#19-security--anti-hallucination)
20. [Deployment & Configuration](#20-deployment--configuration)

---

## 1. Project Overview

Chakshi is an AI-powered legal assistant platform built specifically for Indian legal professionals. The platform provides a comprehensive suite of tools designed to streamline legal workflows, including:

- **AI Legal Drafting** with court-ready document generation
- **Intelligent Chat** with document context injection and legal research augmentation
- **Legal Research** with integrated Indian Kanoon statute/case law database
- **Voice Assistant** with an interactive 3D robot avatar (LexAI)
- **Legal Memo Generation** using IRAC/CREAC/FIRAC methodologies
- **Compliance Checklist Generation** with verified legal references
- **CNR Case Tracking** for monitoring court cases
- **Google Calendar Integration** for managing legal events and hearings

The platform supports **22 Indian languages** for AI-generated content (drafting, chat, memos), provides **cost tracking** via a cost ledger, and includes **source citations** in chat and memo responses. Anti-hallucination safeguards ensure citations are verified against Indian Kanoon before being included.

### Key Design Principles

1. **Anti-Hallucination First**: Every citation must be verified. Unverified citations are explicitly marked as `[CITATION NEEDED - VERIFY]`.
2. **Multi-Tier AI Routing**: Queries are automatically routed to the optimal model (gpt-4o-mini, gpt-4.1, or o3) based on complexity.
3. **Three-Layer Legal Research**: InLegalBERT for AI-powered statute identification, Indian Kanoon for primary authority, Perplexity for currency/risk signals.
4. **Fail-Safe Design**: If any research layer fails, the pipeline continues without that context rather than crashing.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  React + TypeScript + Vite + TailwindCSS + shadcn/ui           │
│  Three.js (3D Robot) │ TanStack Query │ wouter (Router)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP/SSE
┌──────────────────────────────▼──────────────────────────────────┐
│                     SERVER (Node.js + Express)                  │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐     │
│  │ routes.ts   │  │ storage.ts   │  │ elevenlabs.ts     │     │
│  │ (API        │  │ (DB access   │  │ (Voice TTS/STT)   │     │
│  │  endpoints) │  │  layer)      │  │                   │     │
│  └──────┬──────┘  └──────┬───────┘  └───────────────────┘     │
│         │                │                                      │
│  ┌──────▼──────┐  ┌──────▼───────┐  ┌───────────────────┐     │
│  │ OpenAI      │  │ PostgreSQL   │  │ google-calendar.ts│     │
│  │ (GPT-4o-    │  │ (Drizzle ORM)│  │ (Cal sync)        │     │
│  │  mini/4.1/  │  │              │  │                   │     │
│  │  o3)        │  │              │  │                   │     │
│  └─────────────┘  └──────────────┘  └───────────────────┘     │
│         │                                                       │
│  ┌──────▼──────────────────────────────────────────────────────┐│
│  │              LEGAL RESEARCH LAYER                           ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐││
│  │  │ InLegalBERT     │  │ Indian Kanoon   │  │ Perplexity  │││
│  │  │ (HuggingFace)   │  │ (Primary Auth)  │  │ (Currency/  │││
│  │  │ - Statute ID    │  │ - Statutes      │  │  Risk)      │││
│  │  │ - Segmentation  │  │ - Case Law      │  │ - Amendments│││
│  │  │ - Relevance     │  │ - Court Orders  │  │ - Notific.  │││
│  │  │   Ranking       │  │                 │  │ - Recent    │││
│  │  │                 │  │                 │  │   judgments  │││
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User submits a request (chat query, draft request, memo request, etc.)
2. Server determines model tier based on query complexity
3. Legal Research Layer activates (Indian Kanoon + Perplexity search in parallel)
4. Research context is injected into the AI prompt
5. AI generates response with verified citations
6. Response is streamed back to client via Server-Sent Events (SSE)
7. Cost is logged to the cost ledger

---

## 3. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool and dev server |
| **TailwindCSS** | Styling framework |
| **shadcn/ui** | Pre-built UI components |
| **TanStack Query v5** | Server state management, caching, and data fetching |
| **wouter** | Lightweight client-side routing |
| **Three.js** (@react-three/fiber) | 3D rendering for the LexAI robot avatar |
| **@react-three/drei** | Three.js helpers and abstractions |
| **Framer Motion** | Animations |
| **Recharts** | Data visualization for statistics |
| **react-dropzone** | File upload with drag-and-drop |
| **jsPDF** | Client-side PDF export |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js** | Runtime environment |
| **Express** | HTTP server framework |
| **TypeScript (tsx)** | Type-safe server code with hot reload |
| **Drizzle ORM** | Database ORM with type-safe queries |
| **PostgreSQL** | Primary database |
| **multer** | File upload handling (up to 100MB) |
| **mammoth** | DOCX to HTML conversion |
| **pdf-parse** | PDF text extraction |
| **sanitize-html** | XSS protection for HTML content |

### AI & External Services
| Service | Purpose |
|---|---|
| **OpenAI GPT-4o-mini** | Fast, cost-effective queries (simple legal questions) |
| **OpenAI GPT-4.1** | Standard complexity (statute analysis, contract review) |
| **OpenAI o3** | Complex reasoning (constitutional law, precedent analysis) |
| **Indian Kanoon API** | Primary legal authority search (statutes, case law) |
| **Perplexity API** | Currency and risk signals (recent amendments, notifications) |
| **HuggingFace Inference API** | InLegalBERT (law-ai/InLegalBERT) for statute identification, document segmentation, and relevance ranking |
| **ElevenLabs** | Text-to-speech and speech-to-text for voice assistant |
| **Google Calendar API** | Bidirectional calendar synchronization |

---

## 4. Project Structure

```
chakshi/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── App.tsx                  # Root component with routing
│   │   ├── main.tsx                 # Entry point
│   │   ├── index.css                # Global styles & theme variables
│   │   ├── pages/
│   │   │   ├── hub/
│   │   │   │   ├── index.tsx        # Main hub page (central dashboard)
│   │   │   │   ├── drafting-ai.tsx  # AI-powered legal drafting
│   │   │   │   ├── drafting-custom.tsx # Custom document drafting
│   │   │   │   ├── drafting-empty.tsx  # Empty document editor
│   │   │   │   ├── drafting-train.tsx  # Firm SOP training uploads
│   │   │   │   ├── chat-nyaya.tsx   # Nyaya AI (general legal chat)
│   │   │   │   ├── chat-pdf.tsx     # Chat with PDF documents
│   │   │   │   ├── chat-cnr.tsx     # CNR case status chatbot
│   │   │   │   ├── research-assistant.tsx  # Legal research tool
│   │   │   │   ├── research-memo.tsx      # Legal memo generator
│   │   │   │   ├── research-compliance.tsx # Compliance checklist
│   │   │   │   ├── research-notes.tsx     # Saved research notes
│   │   │   │   ├── study-case-predict.tsx # Case outcome prediction
│   │   │   │   ├── study-counter-args.tsx # Counter-argument generator
│   │   │   │   └── study-sandbox.tsx      # Legal scenario sandbox
│   │   │   └── not-found.tsx        # 404 page
│   │   ├── components/
│   │   │   ├── voice-assistant.tsx   # Voice assistant panel & controls
│   │   │   ├── LexAIRobot.jsx      # 3D robot avatar (Three.js)
│   │   │   ├── app-sidebar.tsx      # Navigation sidebar
│   │   │   ├── premium-editor.tsx   # Rich text document editor
│   │   │   ├── research-sidebar.tsx # Research panel for drafting
│   │   │   ├── citation-card.tsx    # Citation display component
│   │   │   ├── model-badge.tsx      # AI model tier indicator
│   │   │   ├── confidence-indicator.tsx # Confidence score display
│   │   │   ├── cost-display.tsx     # Real-time cost tracker
│   │   │   ├── upload-dropzone.tsx  # File upload with drag-drop
│   │   │   ├── streaming-text.tsx   # SSE streaming text display
│   │   │   ├── voice-recorder.tsx   # Audio recording component
│   │   │   ├── document-type-selector.tsx # Legal doc type hierarchy
│   │   │   ├── theme-provider.tsx   # Dark/light theme toggle
│   │   │   └── ui/                  # shadcn/ui base components
│   │   ├── hooks/
│   │   │   └── use-mobile.tsx       # Mobile device detection
│   │   └── lib/
│   │       └── queryClient.ts       # TanStack Query configuration
│   └── public/
│       └── robot_avatar/            # LexAI 3D model assets
│           ├── LexAI_Robot_Final.glb # Robot 3D model (GLTF Binary)
│           ├── face_happy.png        # Happy face LED texture
│           ├── face_talking.png      # Talking face LED texture
│           ├── face_thinking.png     # Thinking face LED texture
│           ├── face_excited.png      # Excited face LED texture
│           ├── face_surprised.png    # Surprised face LED texture
│           └── face_serious.png      # Serious face LED texture
├── server/                          # Backend application
│   ├── index.ts                     # Server entry point
│   ├── routes.ts                    # All API route definitions
│   ├── storage.ts                   # Database access layer (IStorage interface)
│   ├── db.ts                        # Database connection setup
│   ├── indian-kanoon.ts             # Indian Kanoon API integration
│   ├── legal-web-search.ts          # Perplexity API integration
│   ├── google-calendar.ts           # Google Calendar sync service
│   ├── elevenlabs.ts                # ElevenLabs voice API integration
│   ├── huggingface.ts               # InLegalBERT via HuggingFace API
│   ├── training-data-loader.ts      # Firm SOP training data loader
│   ├── static.ts                    # Static file serving
│   └── vite.ts                      # Vite dev server integration
├── shared/
│   └── schema.ts                    # Database schema + TypeScript types
├── drizzle.config.ts                # Drizzle ORM configuration
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.ts               # Tailwind CSS configuration
└── vite.config.ts                   # Vite build configuration
```

---

## 5. Database Schema & Design

The database uses **PostgreSQL** with **Drizzle ORM** for type-safe database operations. All IDs use UUIDs generated via `gen_random_uuid()`.

### Entity Relationship Diagram

```
┌───────────────┐     ┌──────────────────┐     ┌────────────────┐
│    users      │     │  chat_sessions   │     │ chat_messages   │
├───────────────┤     ├──────────────────┤     ├────────────────┤
│ id (PK, UUID) │     │ id (PK, UUID)    │◄───┐│ id (PK, UUID)  │
│ username      │     │ title            │    ││ session_id (FK)│
│ password      │     │ session_type     │    │├────────────────┤
└───────────────┘     │ document_ids[]   │    ││ role           │
                      │ model_tier       │    ││ content        │
                      │ total_cost       │    ││ model_used     │
                      │ message_count    │    ││ confidence     │
                      │ created_at       │    ││ cost           │
                      └──────────────────┘    ││ citations      │
                                              │└────────────────┘
┌───────────────┐     ┌──────────────────┐    │
│  documents    │     │     drafts       │    │
├───────────────┤     ├──────────────────┤    │
│ id (PK, UUID) │     │ id (PK, UUID)    │    │
│ name          │     │ title            │    │
│ type          │     │ type             │    │
│ size          │     │ content          │    │
│ pages         │     │ status           │    │
│ status        │     │ model_used       │    │
│ processing_   │     │ language         │    │
│   cost        │     │ use_firm_style   │    │
│ summary       │     │ session_id       │────┘
│ extracted_    │     │ reference_doc_   │
│   text        │     │   ids[]          │
│ extracted_    │     │ risk_analysis    │
│   html        │     │ grammar_errors   │
│ uploaded_at   │     │ created_at       │
└───────────────┘     │ updated_at       │
                      └──────────────────┘

┌───────────────┐     ┌──────────────────┐     ┌────────────────┐
│ legal_memos   │     │  compliance_     │     │ research_      │
│               │     │  checklists      │     │  queries       │
├───────────────┤     ├──────────────────┤     ├────────────────┤
│ id (PK, UUID) │     │ id (PK, UUID)    │     │ id (PK, UUID)  │
│ title         │     │ title            │     │ query          │
│ facts         │     │ industry         │     │ results        │
│ issues        │     │ jurisdiction     │     │ legal_domain   │
│ applicable_   │     │ activity         │     │ statutes       │
│   law         │     │ items (JSON)     │     │ case_law       │
│ analysis      │     │ status           │     │ analysis       │
│ conclusion    │     │ created_at       │     │ sources        │
│ sources       │     │ updated_at       │     │ created_at     │
│ full_memo     │     └──────────────────┘     └────────────────┘
│ document_ids[]│
│ created_at    │     ┌──────────────────┐     ┌────────────────┐
│ updated_at    │     │  saved_cases     │     │  cnr_notes     │
└───────────────┘     ├──────────────────┤     ├────────────────┤
                      │ id (PK, UUID)    │     │ id (PK, UUID)  │
┌───────────────┐     │ cnr_number (UQ)  │     │ title          │
│ training_docs │     │ case_type        │     │ content        │
├───────────────┤     │ filing_number    │     │ cnr_number     │
│ id (PK, UUID) │     │ filing_date      │     │ created_at     │
│ user_id       │     │ registration_    │     │ updated_at     │
│ name          │     │   number         │     └────────────────┘
│ type          │     │ case_status      │
│ size          │     │ next_hearing_    │     ┌────────────────┐
│ content       │     │   date           │     │ cost_ledger    │
│ extracted_    │     │ petitioners      │     ├────────────────┤
│   html        │     │ respondents      │     │ id (PK, UUID)  │
│ status        │     │ acts_and_        │     │ type           │
│ uploaded_at   │     │   sections       │     │ description    │
└───────────────┘     │ case_history     │     │ amount         │
                      │ saved_at         │     │ model_used     │
┌───────────────┐     └──────────────────┘     │ created_at     │
│calendar_events│                               └────────────────┘
├───────────────┤     ┌──────────────────┐
│ id (PK, UUID) │     │ google_calendar_ │
│ user_id       │     │  credentials     │
│ title         │     ├──────────────────┤
│ description   │     │ id (PK, UUID)    │
│ start_time    │     │ user_id          │
│ end_time      │     │ calendar_id      │
│ type          │     │ access_token     │
│ is_high_      │     │ refresh_token    │
│   priority    │     │ token_expiry     │
│ google_       │     │ sync_token       │
│   event_id    │     │ last_sync_at     │
│ sync_status   │     │ created_at       │
│ created_at    │     │ updated_at       │
│ updated_at    │     └──────────────────┘
└───────────────┘

┌───────────────┐
│research_notes │
├───────────────┤
│ id (PK, UUID) │
│ name          │
│ content       │
│ draft_id      │
│ created_at    │
└───────────────┘
```

### Table Summary

| Table | Purpose | Records |
|---|---|---|
| `users` | User accounts | Authentication & identity |
| `documents` | Uploaded legal documents | PDFs, DOCX, TXT files with extracted text |
| `chat_sessions` | Chat conversation threads | Groups messages by topic/document |
| `chat_messages` | Individual chat messages | User queries and AI responses |
| `drafts` | Legal document drafts | AI-generated and manually created documents |
| `training_docs` | Firm SOP training files | Used to match firm's writing style |
| `legal_memos` | Generated legal memorandums | IRAC/CREAC structured memos |
| `compliance_checklists` | Regulatory checklists | Industry-specific compliance items |
| `research_queries` | Saved research queries | Search results and analysis |
| `research_notes` | Saved research notes | Linked to drafts |
| `cnr_notes` | Case-related notes | Notes tied to CNR case numbers |
| `saved_cases` | Tracked court cases | Full case details from CNR lookup |
| `cost_ledger` | AI usage costs | Tracks spending per model per operation |
| `calendar_events` | Legal calendar events | Hearings, deadlines, exams |
| `google_calendar_credentials` | OAuth tokens | Google Calendar sync tokens |

---

## 6. Backend Architecture

### Storage Layer Pattern

The backend uses a **Storage Interface Pattern** (`IStorage`) that abstracts all database operations. This decouples the API routes from the database implementation.

```typescript
// server/storage.ts
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Document operations
  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<void>;

  // Chat operations
  getChatSessions(): Promise<ChatSession[]>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Draft operations
  getDrafts(): Promise<Draft[]>;
  createDraft(draft: InsertDraft): Promise<Draft>;
  updateDraft(id: string, updates: Partial<Draft>): Promise<Draft | undefined>;

  // ... 40+ more operations for memos, compliance, research, calendar, etc.
}
```

The implementation (`DatabaseStorage`) uses **Drizzle ORM** to execute type-safe PostgreSQL queries.

### Route Architecture

All API routes are defined in `server/routes.ts` and organized by feature domain. Each route follows this pattern:

1. **Input Validation** - Request body validated using Zod schemas
2. **Business Logic** - Model tier selection, research pipeline execution
3. **Storage Operations** - CRUD via the IStorage interface
4. **Response** - JSON or Server-Sent Events (SSE) for streaming

---

## 7. AI Pipeline & Model Routing

### Multi-Tier Model System

The platform uses three OpenAI models, automatically selected based on query complexity:

```
┌──────────────────────────────────────────────────────────────┐
│                    MODEL ROUTING ENGINE                       │
│                                                              │
│  User Query ───► Keyword Analysis ───► Tier Selection        │
│                                                              │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ GPT-4o-mini     │  │ GPT-4.1      │  │ o3            │  │
│  │ (Mini Tier)     │  │ (Standard)   │  │ (Pro Tier)    │  │
│  │                 │  │              │  │               │  │
│  │ Cost: $0.15/req │  │ Cost: $0.40  │  │ Cost: $2.00   │  │
│  │                 │  │              │  │               │  │
│  │ Used for:       │  │ Used for:    │  │ Used for:     │  │
│  │ - Simple Q&A    │  │ - Statute    │  │ - Constitu-   │  │
│  │ - Definitions   │  │   analysis   │  │   tional law  │  │
│  │ - Basic legal   │  │ - Case law   │  │ - Precedent   │  │
│  │   questions     │  │ - Contract   │  │   analysis    │  │
│  │ - Drafting      │  │   disputes   │  │ - Novel legal │  │
│  │   (most types)  │  │ - Judgments  │  │   questions   │  │
│  └─────────────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Routing Logic

```typescript
function determineModelTier(query: string): "mini" | "standard" | "pro" {
  // Pro tier keywords - most complex legal analysis
  const complexKeywords = [
    "constitutional", "supreme court", "precedent analysis",
    "conflicting", "interpretation", "jurisdiction", "novel"
  ];

  // Standard tier keywords - moderate complexity
  const standardKeywords = [
    "section", "act", "statute", "case law",
    "judgment", "contract", "dispute"
  ];

  if (complexKeywords.some(kw => query.toLowerCase().includes(kw))) return "pro";
  if (standardKeywords.some(kw => query.toLowerCase().includes(kw))) return "standard";
  return "mini";
}
```

### Cost Tracking

Every AI call is logged to the `cost_ledger` table with:
- Operation type (chat, draft, memo, compliance, research)
- Model used
- Cost amount
- Timestamp

The frontend displays running totals in the `CostDisplay` component.

---

## 8. Legal Research Pipeline

This is the most critical differentiator. Every AI-generated response goes through a **mandatory three-layer research pipeline** before the AI model generates content.

```
┌─────────────────────────────────────────────────────────────────┐
│                 LEGAL RESEARCH PIPELINE                          │
│                                                                  │
│  User Input                                                      │
│      │                                                           │
│      ▼                                                           │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ LAYER 0: InLegalBERT (AI Statute Pre-Identification)  │      │
│  │                                                       │      │
│  │ • Uses law-ai/InLegalBERT model via HuggingFace       │      │
│  │   Inference API                                       │      │
│  │ • Analyzes facts to identify relevant statutes via    │      │
│  │   embedding similarity                                │      │
│  │ • Generates enhanced search queries for Indian Kanoon │      │
│  │ • Classifies document segments (Facts/Arguments/      │      │
│  │   Ruling/Statute/etc.)                                │      │
│  │ • Ranks search results by semantic relevance          │      │
│  │   (cosine similarity)                                 │      │
│  │ • Falls back to keyword-based identification if       │      │
│  │   HuggingFace unavailable                             │      │
│  │ • Pre-computes and caches statute/label embeddings    │      │
│  │   at startup                                          │      │
│  └──────────────────────┬────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ LAYER 1: Indian Kanoon (Primary Authority)            │      │
│  │                                                       │      │
│  │ • Searches both base query AND InLegalBERT-identified │      │
│  │   statutes for comprehensive coverage                 │      │
│  │ • Deduplicates results by docId                       │      │
│  │ • Returns verified sources with DocID, title, excerpt │      │
│  │ • Results ranked by InLegalBERT relevance when        │      │
│  │   available                                           │      │
│  │ • Top 5-8 results injected into AI prompt             │      │
│  │ • AI MUST only cite from this verified list           │      │
│  │ • Non-verified citations marked [CITATION NEEDED]     │      │
│  │                                                       │      │
│  │ API: POST https://api.indiankanoon.org/search/        │      │
│  │ Auth: Token-based (INDIAN_KANOON_API_TOKEN)           │      │
│  └──────────────────────┬────────────────────────────────┘      │
│                         │ (runs in parallel)                     │
│  ┌──────────────────────▼────────────────────────────────┐      │
│  │ LAYER 2: Perplexity (Currency & Risk Signals)         │      │
│  │                                                       │      │
│  │ • Searches for recent amendments, notifications       │      │
│  │ • Results marked as ADVISORY ONLY                     │      │
│  │ • NOT to be cited as primary authority                 │      │
│  │ • Warns user to verify from official gazettes         │      │
│  │ • Searches from curated domain list (sci.gov.in,      │      │
│  │   livelaw.in, barandbench.com, etc.)                  │      │
│  │                                                       │      │
│  │ API: Perplexity API (PERPLEXITY_API_KEY)              │      │
│  └──────────────────────┬────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  Combined Research Context → Injected into AI Prompt             │
│                         │                                        │
│                         ▼                                        │
│  AI Model generates response with verified citations             │
└─────────────────────────────────────────────────────────────────┘
```

### Priority Legal Domains

The Perplexity search layer uses a curated list of trusted Indian legal sources:

**Legal News**: livelaw.in, barandbench.com, indialegallive.com, latestlaws.com
**Judiciary**: sci.gov.in (Supreme Court of India)
**Government**: sebi.gov.in, rbi.org.in, mca.gov.in, cbic.gov.in, gst.gov.in, incometax.gov.in

### Fail-Safe Behavior

All three research layers are wrapped in try-catch blocks. If InLegalBERT is unavailable, the pipeline falls back to keyword-based statute identification. If Indian Kanoon is down, the pipeline continues without primary authority context. If Perplexity fails, it continues without currency signals. The AI will still generate a response but with appropriate warnings about unverified citations.

---

## 9. Drafting Engine

The drafting engine is the most feature-rich component, supporting **15 document types** across **8 legal categories**.

### Drafting Pipeline Flow

```
User Input (type, facts, parties, jurisdiction)
      │
      ▼
┌─────────────────────────────────────┐
│ 1. PRE-DRAFT VALIDATION             │
│    • Validate document category      │
│    • Check court and jurisdiction     │
│    • Verify limitation period         │
│    • Assess factual sufficiency       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 1.5. InLegalBERT ANALYSIS           │
│    • Identify relevant statutes      │
│    • Generate enhanced search queries│
│    • Results feed into Layer 1 search│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. LEGAL RESEARCH LAYER             │
│    • InLegalBERT-enhanced queries    │
│    • Indian Kanoon search            │
│    • Perplexity risk signals         │
│    (Same pipeline as described above)│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. CONTEXT ASSEMBLY                  │
│    • Document type specification     │
│    • Language instruction (22 langs) │
│    • Firm style training data        │
│      OR Chakshi training data        │
│    • Format template (if uploaded)   │
│    • Research results                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. DOCUMENT DNA ENGINE              │
│    • Enforce structural blocks       │
│    • Anti-hallucination rules        │
│    • Citation format enforcement     │
│    • Placeholder rules ([BLANK])     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. AI DRAFTING ENGINE (LLM)          │
│    • Streaming SSE response          │
│    • Model selected by tier          │
│    • System prompt with all context  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. SELF-VALIDATION QUALITY GATE      │
│    • Judge Simulator Report          │
│    • Citation accuracy check         │
│    • Structural completeness check   │
└─────────────────────────────────────┘
```

### Supported Document Categories

| Category | Document Types |
|---|---|
| **Civil Litigation (CPC)** | Plaint, Written Statement, Replication, Interim Application, Affidavit, Execution Petition, Review/Revision, Caveat |
| **Criminal Litigation (CrPC/BNS)** | Bail Application, Anticipatory Bail, Criminal Complaint, Quashing Petition (S.482), Revision/Appeal |
| **Constitutional/Writ** | Writ Petition (Art. 226/32), SLP (Art. 136), Contempt Petition, Review Petition |
| **Notices & Replies** | Legal Notice, Cheque Bounce Notice, Demand Notice, Reply to Notice, Show Cause Reply, Arbitration Notice (S.21) |
| **Contracts & Commercial** | Employment Agreement, NDA, Service Agreement, Shareholders' Agreement, Partnership Deed, Lease/License Agreement |
| **Arbitration (A&C Act)** | Notice of Arbitration, Statement of Claim/Defence, S.9/S.11/S.34/S.36 Applications |
| **Family Law** | Divorce Petition, Maintenance (S.125), DV Complaint, Child Custody, Mutual Consent |
| **Corporate/Regulatory** | Legal Opinion, Board Resolution, Due Diligence Report, SEBI/RBI Reply |

### Firm SOP Training

Users can upload their firm's existing documents to train the AI on their specific writing style:

1. Upload up to 20 documents via `/api/training-docs/upload`
2. Documents are processed (DOCX → HTML structure preserved)
3. When drafting with "Use Firm Style" enabled, the top 2 training docs are injected into the prompt
4. AI matches the numbering style, heading hierarchy, terminology, and formatting patterns

### Language Support

All 22 Indian languages are supported with strong language instructions:

```
Hindi, Marathi, Gujarati, Bengali, Telugu, Tamil, Kannada, Malayalam,
Punjabi, Odia, Assamese, Bhojpuri, Rajasthani, Kashmiri, Konkani,
Manipuri, Sanskrit, Urdu, Sindhi, Nepali, Dogri + English
```

The AI receives explicit instructions: "Write the ENTIRE document in [language]. Every word, every sentence, every section heading must be in [language]. Do not use English except for proper nouns, case citations, or statute names."

---

## 10. Document Processing

### Supported Formats

| Format | Library | Processing |
|---|---|---|
| **PDF** | pdf-parse | Text extraction with page detection |
| **DOCX** | mammoth.js | HTML conversion (structure preserved) |
| **DOC** (legacy) | — | Error message to convert to DOCX |
| **TXT** | Built-in | Direct text read with legal formatting |

### Processing Pipeline

```typescript
async function extractTextFromFile(file): Promise<{ text: string; html: string }> {
  // PDF: Extract text, convert to legal HTML structure
  // DOCX: mammoth.convertToHtml() for structure, extractRawText() for plain text
  // DOC: Detect old format (D0 CF 11 E0 magic bytes), prompt conversion
  // TXT: Read as UTF-8, apply textToLegalHtml() formatting
}
```

### Legal HTML Formatting

The `textToLegalHtml()` function intelligently detects and preserves legal document structure:

- **Centered content**: Court names ("IN THE HIGH COURT OF..."), "VERSUS", section titles
- **Right-aligned**: Party designations ("...Plaintiff", "...Defendant")
- **Numbered clauses**: Decimal (1.1.1), Roman (I, II, III), Lettered ((a), (b), (c))
- **Bullet points**: Standard bullet and dash markers
- **Multi-level nesting**: Recognizes nested clause structures
- **Page marker removal**: Strips "— 1 of 6 —" and "Page 1" markers

### XSS Protection

All HTML from uploaded documents is sanitized using `sanitize-html` with a whitelist of safe tags:

```
Allowed: p, br, strong, b, em, i, u, h1-h6, ul, ol, li, div, span, table, thead, tbody, tr, td, th, hr
Allowed styles: text-align, font-weight only
```

### InLegalBERT Document Segmentation

When documents are uploaded, InLegalBERT classifies paragraphs into semantic categories:

| Segment Type | Description |
|---|---|
| **Facts** | Factual statements and background |
| **Arguments** | Legal arguments and submissions |
| **Ruling/Order** | Court orders, directions, dispositions |
| **Statute Reference** | References to legislative provisions |
| **Case Law Citation** | References to judicial precedents |
| **Ratio Decidendi** | Core legal reasoning of a judgment |
| **Obiter Dicta** | Incidental remarks by the court |
| **Prayer/Relief** | Reliefs sought by the petitioner |
| **Procedural History** | Timeline of procedural events |

This structured classification is prepended to the extracted text, giving the AI better context when the document is used in chat or drafting sessions.

---

## 11. Voice Assistant & LexAI Robot

### Architecture

The voice assistant combines **ElevenLabs** for speech services with a **Three.js 3D robot avatar** for visual engagement.

```
┌─────────────────────────────────────────────────────────┐
│                  VOICE ASSISTANT FLOW                     │
│                                                          │
│  User speaks ──► Mic capture (WebAudio API)              │
│       │                                                  │
│       ▼                                                  │
│  Audio blob ──► POST /api/voice/transcribe               │
│       │         (ElevenLabs STT)                         │
│       ▼                                                  │
│  Transcribed text ──► POST /api/chat/query               │
│       │                (Same chat pipeline)              │
│       ▼                                                  │
│  AI response text ──► POST /api/voice/speak              │
│       │                (ElevenLabs TTS)                   │
│       ▼                                                  │
│  Audio stream ──► Browser playback                       │
│       │           + amplitude analysis                   │
│       ▼                                                  │
│  LexAI Robot ──► Lip-sync + gestures + face expressions  │
└─────────────────────────────────────────────────────────┘
```

### 3D Robot (LexAI)

The robot is a custom GLB model (`LexAI_Robot_Final.glb`) with:

**Skeleton Bones:**
- `Head` - Head movements (nod, tilt)
- `headfront` - Face display anchor point
- `neck` - Neck rotation for look-at
- `Spine`, `Spine01`, `Spine02` - Body sway during speaking
- `Hips` - Base position
- Full arm/leg chains for gesture animations

**Built-in Animations (30 total):**
- `Idle`, `Hover_Float` - Idle/floating state
- `Speaking_Loop` - Speaking with gestures
- `Head_Listen` - Active listening pose
- `Thinking_Pose` - Processing/thinking
- `Wave_Hello` - Greeting animation
- `Excited_Bounce` - Success/excitement
- `Confused_Shrug` - Error/confusion
- `Point_Forward` - Decision/direction
- `Alert` - Alert state
- Plus walking, dancing, combat animations

**Face Expression System:**

A glowing LED plane is attached to the `headfront` bone and displays different face textures:

| State | Face Expression | Behavior |
|---|---|---|
| Idle | Happy | Soft glow, occasional blink |
| Listening | Happy | Pulsing glow synced to mic input |
| Thinking | Thinking | Slow pulse, reduced intensity |
| Speaking | Cycling (talking → happy → excited) | Rapid cycling synced to audio amplitude |
| Success | Excited | Bright glow |
| Alert | Surprised | Flash effect |
| Error | Surprised | Flash effect |
| Greeting | Happy | Warm glow |
| Decision | Serious | Steady glow |

**Interactive Features:**
- **Mouse tracking**: Robot's head and body follow the cursor (Spline-like look-at)
- **Idle behaviors**: Random animations every 2-6 seconds (lookAround, tiltHead, swirl, nod, bounce)
- **Breathing**: Subtle scale oscillation on the body
- **Blinking**: Periodic eyelid squash via headfront bone scaling
- **Speaking gestures**: Random head/body movements synced to audio amplitude

### Voice API Endpoints

**`POST /api/voice/transcribe`**
- Accepts audio file (WebM from browser)
- Uses ElevenLabs Speech-to-Text
- Returns transcribed text

**`POST /api/voice/speak`**
- Accepts text string (max 5000 chars)
- Uses ElevenLabs Text-to-Speech (MP3, 44.1kHz, 128kbps)
- Returns chunked audio stream

---

## 12. Chat System

### Session Types

| Type | Description | Features |
|---|---|---|
| `general` | General legal Q&A | Basic chat with Indian Kanoon search |
| `nyaya` | Nyaya AI assistant | Full RAG pipeline, multi-language |
| `chatwithpdf` | Chat with documents | Document context injection |
| `research` | Research-focused chat | Enhanced search capabilities |

### Chat Query Flow

1. **Receive query** with session ID, document IDs, and message
2. **Determine model tier** based on query complexity keywords
3. **Build document context** (if documents attached):
   - Smart truncation for large documents (80,000 char budget)
   - Three-section extraction: beginning (parties/facts), middle (analysis), end (conclusions)
4. **Run legal research** (Indian Kanoon + Perplexity in parallel)
5. **Build citation list** from research results
6. **Stream AI response** via Server-Sent Events (SSE)
7. **Save message** to database with model, confidence, cost, and citations

### Streaming Response Format

```
data: {"type": "token", "content": "The "}
data: {"type": "token", "content": "applicable "}
data: {"type": "token", "content": "law..."}
data: {"type": "citations", "citations": [...]}
data: {"type": "done", "model": "gpt-4.1", "confidence": 0.85, "cost": 0.40}
```

---

## 13. Legal Memo Generator

Generates structured legal memorandums using three methodology options:

### Supported Structures

| Structure | Sections |
|---|---|
| **IRAC** | Issue → Rule → Application → Conclusion |
| **CREAC** | Conclusion → Rule → Explanation → Application → Conclusion |
| **FIRAC** | Facts → Issue → Rule → Application → Conclusion |

### Generation Pipeline

1. User provides: facts, issues, jurisdiction, parties, title, language
2. Legal Research Layer runs (InLegalBERT statute identification → Indian Kanoon + Perplexity)
3. Chakshi training data injected for memo formatting standards
4. AI generates structured memo with all sections
5. Sources attached with confidence indicators

### Output Sections

- Questions Presented
- Brief Answers
- Factual Background
- Applicable Law (with verified Indian Kanoon citations)
- Analysis (structured per selected methodology)
- Conclusion
- Risk Assessment
- Recommendations

---

## 14. Compliance Checklist Generator

Generates industry-specific regulatory compliance checklists for Indian businesses.

### Generation Flow

```
User Input (industry, jurisdiction, activity)
      │
      ▼
┌─────────────────────────────────────┐
│ Step 1: Perplexity Compliance Search │
│ • Search current regulations         │
│ • Check recent amendments            │
│ • Verify from trusted domains        │
│   (MCA, SEBI, RBI, CBIC, etc.)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Step 2: AI Checklist Generation      │
│ • Generate 8-12 compliance items     │
│ • Exact legal references required    │
│   (Act Name + Year + Section/Rule)  │
│ • Actual penalty amounts             │
│ • Specific deadlines                 │
│ • Risk level classification          │
└──────────────┬──────────────────────┘
               │
               ▼
Each item includes:
• title, description
• legalReference (exact citation)
• deadline
• riskLevel (high/medium/low)
• penalty amount
• recentChange (if any)
```

### Trusted Source Hierarchy

1. **Primary**: Official Government Portals (MCA, SEBI, RBI, CBIC, State Govts)
2. **Secondary**: eGazette notifications, Regulatory Circulars
3. **Advisory**: Live Law, Bar & Bench (for updates only)

---

## 15. CNR Case Tracker

Tracks Indian court cases by **CNR (Case Number Record)** number.

### Features

- Look up case status by CNR number
- Save cases to database for ongoing tracking
- Track: filing details, registration, hearing dates, case stage, judge, parties, acts/sections
- Add notes to cases
- Case history tracking

### Database Design

The `saved_cases` table uses a **unique constraint on `cnr_number`** enabling upsert functionality - if a case is saved again with updated details, it replaces the existing record.

---

## 16. Google Calendar Integration

Bidirectional synchronization between Chakshi and Google Calendar.

### OAuth Flow

```
1. GET /api/calendar/google/auth-url
   → Returns Google OAuth2 consent URL

2. User authorizes in browser
   → Google redirects to /api/calendar/google/callback

3. Callback exchanges code for tokens
   → Stores access_token + refresh_token in database

4. POST /api/calendar/google/sync
   → Syncs events bidirectionally
```

### Event Types

| Type | Description |
|---|---|
| `court` | Court hearings and appearances |
| `professional` | Client meetings, consultations |
| `academic` | Legal education events |
| `exam` | Bar exams, certification tests |
| `career` | Career-related events |

### Sync Status

Events track their sync status: `pending`, `synced`, `failed`, `conflict`

---

## 17. Frontend Architecture

### Routing Structure

```
/                         → Hub (main dashboard)
/hub                      → Hub (main dashboard)
/hub/drafting/ai          → AI Legal Drafting
/hub/drafting/custom      → Custom Document Drafting
/hub/drafting/empty       → Empty Document Editor
/hub/drafting/train       → Firm SOP Training
/hub/chat/nyaya           → Nyaya AI (General Legal Chat + Voice)
/hub/chat/pdf             → Chat with PDF Documents
/hub/chat/cnr             → CNR Case Status Chatbot
/hub/research/assistant   → Legal Research Assistant
/hub/research/memo        → Legal Memo Generator
/hub/research/compliance  → Compliance Checklist Generator
/hub/research/notes       → Saved Research Notes
/hub/study/case-predict   → Case Outcome Prediction (Beta)
/hub/study/counter-args   → Counter-Argument Generator (Beta)
/hub/study/sandbox        → Legal Sandbox (Beta)
```

### State Management

- **TanStack Query v5** for all server state (fetching, caching, invalidation)
- **React Hook Form** + **Zod** for form validation
- **Local state** (useState/useRef) for UI-only state

### Key UI Components

| Component | Purpose |
|---|---|
| `voice-assistant.tsx` | Full voice assistant panel with controls |
| `LexAIRobot.jsx` | Three.js 3D robot with animations |
| `premium-editor.tsx` | Rich text editor for document editing |
| `research-sidebar.tsx` | Side panel showing research results during drafting |
| `citation-card.tsx` | Displays citations with confidence scores |
| `model-badge.tsx` | Shows which AI model was used |
| `confidence-indicator.tsx` | Visual confidence score indicator |
| `cost-display.tsx` | Running cost tracker |
| `document-type-selector.tsx` | 3-level legal document type picker |
| `streaming-text.tsx` | Renders SSE streamed text progressively |

---

## 18. API Reference

### Document Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | List all uploaded documents |
| `GET` | `/api/documents/:id` | Get document by ID |
| `POST` | `/api/documents/upload` | Upload documents (multipart, up to 10 files, 100MB each) |
| `DELETE` | `/api/documents/:id` | Delete a document |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/chat/sessions` | List all chat sessions |
| `POST` | `/api/chat/sessions` | Create a new chat session |
| `DELETE` | `/api/chat/sessions/:id` | Delete a chat session |
| `GET` | `/api/chat/sessions/:id/messages` | Get messages for a session |
| `POST` | `/api/chat/messages` | Save a chat message |
| `POST` | `/api/chat/query` | Send query & get AI response (SSE stream) |

### Drafting

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/drafts` | List all drafts |
| `GET` | `/api/drafts/:id` | Get draft by ID |
| `POST` | `/api/drafts` | Create a new draft |
| `POST` | `/api/drafts/generate` | Generate AI draft (SSE stream) |
| `PATCH` | `/api/drafts/:id` | Update a draft |
| `DELETE` | `/api/drafts/:id` | Delete a draft |
| `POST` | `/api/drafts/translate` | Translate a document |
| `POST` | `/api/drafts/assist` | AI writing assistant |

### Research

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/research/search` | Search Indian Kanoon |
| `POST` | `/api/research/advanced` | Advanced legal research |
| `POST` | `/api/research/statutes` | Search statutes specifically |
| `GET` | `/api/research/document/:docId` | Get Indian Kanoon document |
| `GET` | `/api/research/notes` | List research notes |
| `POST` | `/api/research/notes` | Save a research note |
| `PATCH` | `/api/research/notes/:id` | Update a research note |
| `DELETE` | `/api/research/notes/:id` | Delete a research note |

### Legal Memos

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/memos/generate` | Generate a legal memo (SSE stream) |

### Compliance

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/compliance/checklists` | List all checklists |
| `POST` | `/api/compliance/checklists` | Save a checklist |
| `GET` | `/api/compliance/checklists/:id` | Get checklist by ID |
| `DELETE` | `/api/compliance/checklists/:id` | Delete a checklist |
| `POST` | `/api/compliance/generate` | Generate a compliance checklist |

### CNR Case Tracking

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cnr/notes` | List CNR notes |
| `POST` | `/api/cnr/notes` | Create a CNR note |
| `PATCH` | `/api/cnr/notes/:id` | Update a CNR note |
| `DELETE` | `/api/cnr/notes/:id` | Delete a CNR note |
| `GET` | `/api/cnr/saved-cases` | List saved cases |
| `POST` | `/api/cnr/saved-cases` | Save/upsert a case |
| `DELETE` | `/api/cnr/saved-cases/:id` | Delete a saved case |

### Calendar

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/calendar/google/auth-url` | Get Google OAuth URL |
| `GET` | `/api/calendar/google/callback` | OAuth callback handler |
| `GET` | `/api/calendar/google/status` | Check connection status |
| `POST` | `/api/calendar/google/disconnect` | Disconnect Google Calendar |
| `POST` | `/api/calendar/google/sync` | Sync events with Google |
| `GET` | `/api/calendar/events` | List calendar events |
| `POST` | `/api/calendar/events` | Create a calendar event |
| `PATCH` | `/api/calendar/events/:id` | Update a calendar event |
| `DELETE` | `/api/calendar/events/:id` | Delete a calendar event |

### Voice

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/voice/transcribe` | Transcribe audio to text (ElevenLabs) |
| `POST` | `/api/voice/speak` | Convert text to speech (ElevenLabs) |

### Utility

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/costs` | Get cost ledger entries |
| `GET` | `/api/stats` | Get platform usage statistics |
| `POST` | `/api/refine` | Refine/improve text with AI |
| `POST` | `/api/format/extract` | Extract format from uploaded template |
| `GET` | `/api/training-docs` | List training documents |
| `POST` | `/api/training-docs/upload` | Upload training documents |
| `DELETE` | `/api/training-docs/:id` | Delete a training document |

---

## 19. Security & Anti-Hallucination

### Anti-Hallucination Safeguards

The platform implements strict rules to prevent AI from generating false legal citations:

1. **Citation Format Enforcement**:
   - Statutes: `Act Name + Year + Section` (e.g., "Indian Contract Act, 1872 - Section 73")
   - Cases: `Case Name + Court + Year + Reporter` (e.g., "AIR 2023 SC 456")

2. **Verified Citation List**: AI receives a pre-searched list of verified Indian Kanoon results and is instructed to ONLY cite from that list.

3. **InLegalBERT Advisory Context**: InLegalBERT's statute identification results are presented as guidance only - the AI must still verify all citations against the Indian Kanoon verified list. InLegalBERT never overrides the citation verification requirement.

4. **Unverified Marking**: Any citation not from the verified list must be marked as `[CITATION NEEDED - VERIFY]`.

5. **Missing Information Placeholders**: Instead of fabricating details, the AI uses:
   - `[BLANK]` for missing factual information
   - `[TO BE FILLED BY USER]` for information the user needs to provide

6. **Authority Hierarchy**: Strict ordering enforced:
   - Statute (primary) > Case Law (secondary) > Commentary (tertiary)

### XSS Protection

- All uploaded document HTML is sanitized using `sanitize-html` with a whitelist approach
- Only safe tags (p, strong, em, table, etc.) are allowed
- Script tags, event handlers, and iframe elements are stripped
- Style attributes limited to text-align and font-weight only

### File Upload Security

- Maximum file size: 100MB per file
- Maximum files per upload: 10 (documents) or 20 (training docs)
- Files stored in memory buffer (no disk persistence)
- File type validated by MIME type and extension

---

## 20. Deployment & Configuration

### Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `OPENAI_API_KEY` | OpenAI API access | Yes |
| `INDIAN_KANOON_API_TOKEN` | Indian Kanoon legal database | Yes |
| `PERPLEXITY_API_KEY` | Perplexity web search API | Yes |
| `SESSION_SECRET` | Express session encryption | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth (Calendar) | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (Calendar) | Optional |
| `HUGGINGFACE_API_TOKEN` | HuggingFace API for InLegalBERT | Optional (falls back to keywords) |
| ElevenLabs | Managed via connector integration | Optional |

### Running the Application

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server (frontend + backend on port 5000)
npm run dev
```

### Build for Production

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Database Setup

The application uses **Drizzle ORM** with PostgreSQL. Schema changes are applied using:

```bash
npm run db:push
```

This synchronizes the TypeScript schema definitions in `shared/schema.ts` with the actual database tables without manual migration files.

---

## Appendix: Document Type Hierarchy

The platform supports a comprehensive 3-level document type hierarchy for Indian legal practice:

```
Level 1: Category (e.g., "Civil Litigation (CPC)")
  └── Level 2: Subtype (e.g., "Plaint (Civil Suit)")
        └── Level 3: Statutory Context (e.g., "Order VII Rule 11")
```

This hierarchy drives the AI's document generation, ensuring proper formatting, required sections, and applicable statutory framework for each specific document type.

---

*Documentation last updated: February 2026*
*Platform version: 1.0*
