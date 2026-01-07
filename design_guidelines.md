# Chakshi Legal AI Platform - Design Guidelines

## Design Approach

**Selected Approach**: Design System with Legal Tech Reference

Drawing from Linear's precision, Notion's information architecture, and legal tech platforms like Clio/Lawcourt for domain-specific patterns. This is a professional legal tool requiring clarity, trust, and efficiency over visual flair.

**Core Principles**:
- Professional credibility through restrained, confident design
- Information hierarchy optimized for legal document scanning
- Clear visual separation between AI-generated and source content
- Trust indicators prominently displayed (confidence scores, citations, model transparency)

---

## Typography

**Font Stack**:
- **Primary**: Inter (via Google Fonts) - clean, professional, excellent readability at small sizes for legal text
- **Monospace**: JetBrains Mono - for citations, case numbers, document references

**Type Scale**:
- **Display/Hero**: text-4xl to text-5xl, font-semibold
- **Page Titles**: text-3xl, font-semibold
- **Section Headers**: text-2xl, font-semibold
- **Subsections**: text-xl, font-medium
- **Body Text**: text-base, font-normal, leading-relaxed (legal content needs breathing room)
- **Legal Citations**: text-sm, font-mono
- **Metadata/Labels**: text-sm, font-medium
- **Captions**: text-xs, font-normal

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Tight spacing (2, 4): Form fields, inline elements, button padding
- Medium spacing (6, 8): Card padding, list items, section gaps
- Large spacing (12, 16, 24): Page sections, major separations

**Grid System**:
- **Main Container**: max-w-7xl mx-auto with px-6
- **Two-Panel Layout**: 2/3 content + 1/3 sidebar pattern for document view
- **Chat Interface**: max-w-4xl centered for optimal reading
- **Dashboard**: 12-column grid for analytics cards

---

## Component Library

### Navigation
- **Top Bar**: Fixed header with logo, primary navigation, user profile, cost tracker
- **Sidebar** (Dashboard): Collapsible left nav with document library, chat history, drafting tools
- Keep navigation minimal - primary actions always visible

### Chat Interface
- **Message Bubbles**: 
  - User queries: Right-aligned, subtle background
  - AI responses: Left-aligned, generous padding (p-6), with citation badges inline
  - Streaming indicator: Subtle pulse animation during generation
- **Input Area**: Bottom-fixed with file upload, voice input, send button
- **Citation Cards**: Expandable references showing source paragraph with highlighting

### Document Processing
- **Upload Zone**: Large dropzone with drag-drop, progress bars, batch processing status
- **Document Cards**: Thumbnail preview, metadata (pages, tokens, processing cost), status indicators
- **Viewer**: Split-view with document on left, AI summary/annotations on right

### Legal Drafting
- **Template Selector**: Card grid showing draft types with preview
- **Editor**: Full-width with section numbering, formatting toolbar, citation insertion
- **Review Panel**: Side-by-side comparison for AI revisions

### Data Displays
- **Confidence Indicators**: Progress bars with color semantics (high/medium/low)
- **Model Badge**: Small pill showing which AI tier was used (Mini/4.1/Pro)
- **Cost Tracker**: Dashboard widget with spend breakdown by feature
- **Precedent Comparison**: Table layout with similarity scores, fact matrices

### Forms
- **Input Fields**: Clear labels above, validation states, helper text below
- **Multi-step Wizards**: Progress indicators for document upload → processing → query flow
- **Filters**: Collapsible panels for document search, date ranges, jurisdiction

### Feedback & Status
- **Toast Notifications**: Top-right for processing updates, errors
- **Loading States**: Skeleton screens for document loading, spinner for quick actions
- **Empty States**: Helpful illustrations with clear CTAs when no documents/history

---

## Images

**Hero Section**: 
- **Landing Page**: Full-width (not full-height) hero with abstract legal/AI visualization - think scattered legal documents with glowing AI nodes connecting them, or a courtroom transforming into digital interface
- Overlay with blurred backdrop (backdrop-blur-lg) for text/CTA readability
- Height: ~60vh on desktop, ~50vh mobile

**Dashboard**: No hero - jump straight to functionality

**Product Screenshots**: Use throughout marketing pages showing actual interface (chat, document processing, drafting tools)

**Trust Indicators**: Logos of law firms using platform (if applicable), security badges

---

## Critical Layout Notes

**Chat Interface**: 
- Messages container with max-w-4xl centered
- Bottom input bar with backdrop-blur, sticky positioning
- Right sidebar (collapsible) for document context, citations

**Document Viewer**:
- 60/40 split: PDF viewer left, AI analysis right
- Fixed headers, scrollable content panes independently

**Landing Page Structure** (6-8 sections):
1. Hero with platform demo video/screenshot
2. Key Features (3-column grid): Document Processing, AI Chat, Legal Drafting
3. How It Works (stepped process with visuals)
4. Cost Transparency (pricing calculator widget)
5. Trust & Security (certifications, encryption, audit trails)
6. Integration Showcase (79 legal databases, API capabilities)
7. Testimonials (2-column with lawyer photos)
8. CTA + Footer with comprehensive links

**Multi-column Usage**:
- Features: 3 columns desktop, 1 mobile
- Pricing tiers: 3 columns side-by-side
- Document library: 4-column grid of cards
- Dashboard metrics: 2x2 grid of stat cards

---

## Professional Touches

- **Micro-animations**: Subtle scale on card hover, smooth panel transitions
- **Visual Hierarchy**: Generous whitespace between major sections (py-24 desktop, py-12 mobile)
- **Accessibility**: High contrast text, clear focus states, keyboard navigation for all actions
- **Responsive**: Mobile-first with chat interface optimized for lawyers on-the-go

This design balances professional credibility with modern SaaS usability, ensuring legal professionals trust the AI while efficiently processing their work.