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
│   │       └── research-compliance.tsx # Compliance Checklist
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
- `POST /api/drafts/generate` - Generate new draft
- `PATCH /api/drafts/:id` - Update draft
- `DELETE /api/drafts/:id` - Delete draft

### Research
- `POST /api/research/search` - Search Indian Kanoon
- `POST /api/research/statutes` - Search statutes
- `GET /api/research/document/:docId` - Get document from Indian Kanoon

### Memos & Compliance
- `POST /api/memos/generate` - Generate legal memorandum
- `POST /api/compliance/generate` - Generate compliance checklist

### Stats
- `GET /api/stats` - Get dashboard statistics
- `GET /api/costs` - Get cost ledger

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
