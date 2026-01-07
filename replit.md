# Chakshi - Legal AI Platform

## Overview
Chakshi is an AI-powered legal assistant platform for Indian legal professionals. It provides document processing, intelligent chat with multi-layer RAG reasoning, legal drafting capabilities, and cost-optimized model selection.

## Features
- **Document Processing**: Upload PDFs, Word docs, and scanned images with OCR support
- **AI Chat**: Multi-layer RAG with GPT-4o-mini (fast), GPT-4.1 (standard), and o3 (pro) model tiers
- **Legal Drafting**: Generate petitions, notices, contracts, and other legal documents
- **Voice Input**: Speech-to-text for hands-free chat interaction
- **Cost Tracking**: Real-time cost monitoring and transparency
- **Citations**: Inline source citations with confidence scores

## Tech Stack
- **Frontend**: React with TypeScript, Vite, TailwindCSS, shadcn/ui components
- **Backend**: Node.js with Express
- **AI**: OpenAI via Replit AI Integrations (no API key required)
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
│   │   ├── document-status-badge.tsx
│   │   ├── upload-dropzone.tsx
│   │   ├── citation-card.tsx
│   │   ├── voice-recorder.tsx
│   │   ├── streaming-text.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── pages/           # Page components
│   │   ├── landing.tsx  # Public landing page
│   │   ├── dashboard.tsx
│   │   ├── documents.tsx
│   │   ├── chat.tsx
│   │   ├── drafting.tsx
│   │   └── settings.tsx
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and query client
│   └── App.tsx          # Main app with routing
├── server/
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # In-memory storage layer
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

### Stats
- `GET /api/stats` - Get dashboard statistics
- `GET /api/costs` - Get cost ledger

## Model Tiers
| Tier | Model | Cost/Query | Use Case |
|------|-------|------------|----------|
| Mini | gpt-4o-mini | ~₹0.15 | Simple queries, quick answers |
| Standard | gpt-4.1 | ~₹0.40 | Case analysis, contract review |
| Pro | o3 | ~₹2.00 | Complex legal interpretation |

## Running the Project
The application runs via `npm run dev` which starts both the Express backend and Vite frontend on port 5000.

## Recent Changes
- Initial implementation of Chakshi legal AI platform
- Landing page with features, pricing, and security sections
- Dashboard with stats, activity feed, and cost breakdown
- Document library with upload, processing status, and management
- AI chat with streaming responses, citations, and voice input
- Legal drafting workspace with template selection and editor
- Settings page with theme, AI preferences, and privacy controls
- Dark mode support with system preference detection
