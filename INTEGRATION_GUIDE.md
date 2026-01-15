# Chakshi Integration Guide for MERN Stack

## Overview

This guide explains how to integrate Chakshi's Legal AI features into your existing MERN stack application. The recommended approach is to run Chakshi as a **microservice** that your MERN app calls via REST API.

```
┌─────────────────────┐         ┌─────────────────────┐
│   YOUR MERN APP     │   API   │   CHAKSHI SERVICE   │
│  (React + MongoDB)  │ ──────> │  (Express + Postgres)│
│                     │         │                     │
│  - Your UI          │         │  - AI Drafting      │
│  - Your MongoDB     │         │  - Legal Research   │
│  - Your Auth        │         │  - Document OCR     │
└─────────────────────┘         └─────────────────────┘
```

---

## Option 1: Microservice Integration (Recommended)

### Step 1: Deploy Chakshi Separately

Deploy Chakshi to any cloud provider:
- **Replit** (already deployed)
- **Railway.app** (free tier, supports PostgreSQL)
- **Render.com** (free tier, supports PostgreSQL)
- **DigitalOcean App Platform**
- **AWS EC2/ECS**

### Step 2: Required Environment Variables for Chakshi

```env
# Database (PostgreSQL required)
DATABASE_URL=postgresql://user:password@host:5432/chakshi

# AI Services
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...

# Legal API
INDIAN_KANOON_API_TOKEN=your-token

# Session
SESSION_SECRET=random-secret-string

# Optional: Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Step 3: Call Chakshi API from Your MERN App

**Example: Legal Document Drafting**
```javascript
// In your MERN backend (Node.js/Express)
const axios = require('axios');

const CHAKSHI_URL = 'https://your-chakshi-deployment.com';

// AI Legal Drafting
app.post('/api/draft', async (req, res) => {
  try {
    const response = await axios.post(`${CHAKSHI_URL}/api/drafts/generate`, {
      type: req.body.documentType,
      caseDescription: req.body.caseDescription,
      jurisdiction: req.body.jurisdiction,
      court: req.body.court,
      language: req.body.language || 'en'
    });
    
    // Save to your MongoDB if needed
    await YourDraftModel.create({
      userId: req.user._id,
      content: response.data.content,
      citations: response.data.citations
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legal Research
app.post('/api/research', async (req, res) => {
  const response = await axios.post(`${CHAKSHI_URL}/api/research`, {
    query: req.body.query,
    type: req.body.type // 'case' or 'statute'
  });
  res.json(response.data);
});

// Legal Memo Generation
app.post('/api/memo', async (req, res) => {
  const response = await axios.post(`${CHAKSHI_URL}/api/legal-memo/generate`, {
    topic: req.body.topic,
    facts: req.body.facts,
    structure: req.body.structure // 'irac', 'crac', or 'creac'
  });
  res.json(response.data);
});

// Compliance Checklist
app.post('/api/compliance', async (req, res) => {
  const response = await axios.post(`${CHAKSHI_URL}/api/compliance/generate`, {
    industry: req.body.industry,
    jurisdiction: req.body.jurisdiction,
    companyType: req.body.companyType
  });
  res.json(response.data);
});
```

---

## Option 2: Extract Core Logic (More Work)

If you must have everything in your MERN codebase, extract these key pieces:

### A. AI Prompts (Easy to Port)

The core AI logic is in `server/routes.ts`. Key prompts you can copy:

1. **Legal Drafting System Prompt** (~line 400-500)
2. **Legal Memo System Prompt** (~line 1200-1300)
3. **Compliance Checklist Prompt** (~line 1400-1500)

### B. Indian Kanoon Integration

```javascript
// indianKanoon.js - Port this to your MERN app
const axios = require('axios');

const INDIAN_KANOON_API = 'https://api.indiankanoon.org';

async function searchCases(query, pagenum = 0) {
  const response = await axios.post(
    `${INDIAN_KANOON_API}/search/`,
    `formInput=${encodeURIComponent(query)}&pagenum=${pagenum}`,
    {
      headers: {
        'Authorization': `Token ${process.env.INDIAN_KANOON_API_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data;
}

async function getDocument(docId) {
  const response = await axios.post(
    `${INDIAN_KANOON_API}/doc/${docId}/`,
    {},
    {
      headers: {
        'Authorization': `Token ${process.env.INDIAN_KANOON_API_TOKEN}`
      }
    }
  );
  return response.data;
}

module.exports = { searchCases, getDocument };
```

### C. Perplexity Legal Search

```javascript
// legalWebSearch.js - Port to your MERN app
const axios = require('axios');

async function searchLegalUpdates(query) {
  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Search for recent legal updates, amendments, and notifications.'
        },
        { role: 'user', content: query }
      ],
      search_domain_filter: [
        'indiankanoon.org',
        'scconline.com',
        'barandbench.com',
        'livelaw.in',
        'legislative.gov.in'
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

module.exports = { searchLegalUpdates };
```

### D. PDF Text Extraction

```javascript
// documentProcessor.js
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractText(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const result = await pdfParse(buffer);
    return result.text;
  }
  
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  
  return buffer.toString('utf-8');
}

module.exports = { extractText };
```

---

## Chakshi API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents` | POST | Upload document for processing |
| `/api/documents/:id` | GET | Get processed document |
| `/api/drafts/generate` | POST | AI legal document drafting |
| `/api/chat/sessions` | POST | Create chat session |
| `/api/chat/sessions/:id/messages` | POST | Send chat message |
| `/api/research` | POST | Search Indian Kanoon |
| `/api/legal-memo/generate` | POST | Generate legal memo |
| `/api/compliance/generate` | POST | Generate compliance checklist |
| `/api/translate` | POST | Translate to Indian languages |

---

## MongoDB Schema Examples

If storing Chakshi responses in your MongoDB:

```javascript
// models/LegalDraft.js
const mongoose = require('mongoose');

const legalDraftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  content: String,
  citations: [{
    text: String,
    source: String,
    confidence: Number
  }],
  jurisdiction: String,
  court: String,
  language: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LegalDraft', legalDraftSchema);
```

```javascript
// models/LegalMemo.js
const legalMemoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  topic: String,
  structure: { type: String, enum: ['irac', 'crac', 'creac'] },
  content: {
    issue: String,
    rule: String,
    application: String,
    conclusion: String
  },
  citations: [String],
  createdAt: { type: Date, default: Date.now }
});
```

---

## Quick Start (Microservice Approach)

1. **Keep Chakshi deployed on Replit** (already working)
2. **In your MERN app, add axios**:
   ```bash
   npm install axios
   ```
3. **Create API proxy routes** that call Chakshi
4. **Store results in MongoDB** if you need persistence

This gives you all Chakshi features without rewriting anything!

---

## Need Help?

The key files to understand:
- `server/routes.ts` - All API logic and AI prompts
- `server/indian-kanoon.ts` - Case law search
- `server/legal-web-search.ts` - Perplexity integration
- `shared/schema.ts` - Data models (adapt for MongoDB)
