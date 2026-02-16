const HF_API_BASE = "https://api-inference.huggingface.co";

const INLEGAL_BERT_MODEL = "law-ai/InLegalBERT";

const LEGAL_STATUTE_LABELS = [
  "Indian Penal Code, 1860",
  "Code of Criminal Procedure, 1973",
  "Code of Civil Procedure, 1908",
  "Indian Contract Act, 1872",
  "Indian Evidence Act, 1872",
  "Transfer of Property Act, 1882",
  "Negotiable Instruments Act, 1881",
  "Companies Act, 2013",
  "Arbitration and Conciliation Act, 1996",
  "Consumer Protection Act, 2019",
  "Information Technology Act, 2000",
  "Right to Information Act, 2005",
  "Motor Vehicles Act, 1988",
  "Prevention of Corruption Act, 1988",
  "Specific Relief Act, 1963",
  "Hindu Marriage Act, 1955",
  "Hindu Succession Act, 1956",
  "Indian Succession Act, 1925",
  "Protection of Women from Domestic Violence Act, 2005",
  "Securitisation and Reconstruction of Financial Assets Act, 2002",
  "Insolvency and Bankruptcy Code, 2016",
  "Real Estate (Regulation and Development) Act, 2016",
  "Goods and Services Tax Act, 2017",
  "Income Tax Act, 1961",
  "Labour Laws",
  "Environmental Laws",
  "Intellectual Property Laws",
  "Constitutional Law",
  "Bharatiya Nyaya Sanhita, 2023",
  "Bharatiya Nagarik Suraksha Sanhita, 2023",
  "Bharatiya Sakshya Adhiniyam, 2023",
];

const DOCUMENT_SEGMENT_LABELS = [
  "Facts",
  "Arguments",
  "Ruling/Order",
  "Statute Reference",
  "Case Law Citation",
  "Ratio Decidendi",
  "Obiter Dicta",
  "Prayer/Relief",
  "Procedural History",
];

interface HFClassificationResult {
  label: string;
  score: number;
}

interface HFEmbeddingResult {
  embeddings: number[];
}

export class InLegalBERTService {
  private token: string | null;
  private requestCache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL: number = 5 * 60 * 1000;
  private statuteEmbeddingsCache: Map<string, number[]> = new Map();
  private labelEmbeddingsCache: Map<string, number[]> = new Map();
  private embeddingsCacheLoaded: boolean = false;

  constructor() {
    this.token = process.env.HUGGINGFACE_API_TOKEN || null;
    this.requestCache = new Map();
  }

  private async ensureEmbeddingsCached(): Promise<void> {
    if (this.embeddingsCacheLoaded || !this.token) return;
    this.embeddingsCacheLoaded = true;

    console.log("[InLegalBERT] Pre-computing statute and label embeddings...");
    
    const statutePromises = LEGAL_STATUTE_LABELS.map(async (statute) => {
      const emb = await this.getEmbeddings(statute);
      if (emb) this.statuteEmbeddingsCache.set(statute, emb);
    });

    const labelPromises = DOCUMENT_SEGMENT_LABELS.map(async (label) => {
      const emb = await this.getEmbeddings(label);
      if (emb) this.labelEmbeddingsCache.set(label, emb);
    });

    await Promise.all([...statutePromises, ...labelPromises]);
    console.log(`[InLegalBERT] Cached ${this.statuteEmbeddingsCache.size} statute embeddings and ${this.labelEmbeddingsCache.size} label embeddings`);
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  private getCacheKey(endpoint: string, body: any): string {
    return `${endpoint}:${JSON.stringify(body)}`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.requestCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTTL) {
      return entry.data;
    }
    this.requestCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    if (this.requestCache.size > 200) {
      const oldest = this.requestCache.keys().next().value;
      if (oldest) this.requestCache.delete(oldest);
    }
    this.requestCache.set(key, { data, timestamp: Date.now() });
  }

  private async hfRequest(endpoint: string, body: any, retries = 2): Promise<any> {
    if (!this.token) return null;

    const cacheKey = this.getCacheKey(endpoint, body);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${HF_API_BASE}${endpoint}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (response.status === 503) {
          const errorData = await response.json().catch(() => ({}));
          const waitTime = (errorData as any)?.estimated_time || 20;
          console.log(`[InLegalBERT] Model loading, waiting ${Math.ceil(waitTime)}s...`);
          await new Promise(r => setTimeout(r, Math.min(waitTime * 1000, 30000)));
          continue;
        }

        if (response.status === 429) {
          console.log(`[InLegalBERT] Rate limited, waiting 5s...`);
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        if (!response.ok) {
          console.error(`[InLegalBERT] Request failed: ${response.status}`);
          return null;
        }

        const data = await response.json();
        this.setCache(cacheKey, data);
        return data;
      } catch (error) {
        console.error(`[InLegalBERT] Request error (attempt ${attempt + 1}):`, error);
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return null;
  }

  async identifyStatutes(facts: string): Promise<{ statute: string; confidence: number }[]> {
    if (!this.token || !facts.trim()) return [];

    const truncatedFacts = facts.substring(0, 1500);

    try {
      await this.ensureEmbeddingsCached();
      
      const factsEmbedding = await this.getEmbeddings(truncatedFacts);
      
      if (!factsEmbedding) {
        return this.fallbackStatuteIdentification(facts);
      }

      const statuteScores: { statute: string; confidence: number }[] = [];
      
      for (const statute of LEGAL_STATUTE_LABELS) {
        const statuteEmbedding = this.statuteEmbeddingsCache.get(statute);
        if (statuteEmbedding) {
          const similarity = this.cosineSimilarity(factsEmbedding, statuteEmbedding);
          const normalized = Math.max(0, Math.min(1, (similarity + 1) / 2));
          statuteScores.push({ statute, confidence: normalized });
        }
      }

      if (statuteScores.length === 0) {
        return this.fallbackStatuteIdentification(facts);
      }

      const results = statuteScores
        .sort((a, b) => b.confidence - a.confidence)
        .filter(s => s.confidence > 0.55)
        .slice(0, 5);

      if (results.length === 0) {
        return this.fallbackStatuteIdentification(facts);
      }

      return results;
    } catch (error) {
      console.error("[InLegalBERT] Statute identification error:", error);
      return this.fallbackStatuteIdentification(facts);
    }
  }

  async classifySegments(text: string): Promise<{ text: string; label: string; confidence: number }[]> {
    if (!this.token || !text.trim()) return [];

    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 30);

    await this.ensureEmbeddingsCached();

    if (this.labelEmbeddingsCache.size === 0) {
      return paragraphs.slice(0, 20).map(p => this.fallbackClassifyParagraph(p));
    }

    const segments: { text: string; label: string; confidence: number }[] = [];

    for (const paragraph of paragraphs.slice(0, 20)) {
      const paraEmbedding = await this.getEmbeddings(paragraph.substring(0, 512));
      
      if (!paraEmbedding) {
        segments.push(this.fallbackClassifyParagraph(paragraph));
        continue;
      }

      let bestLabel = "Facts";
      let bestScore = -1;

      for (const [label, labelEmb] of this.labelEmbeddingsCache.entries()) {
        const sim = this.cosineSimilarity(paraEmbedding, labelEmb);
        const normalized = Math.max(0, Math.min(1, (sim + 1) / 2));
        if (normalized > bestScore) {
          bestScore = normalized;
          bestLabel = label;
        }
      }

      segments.push({
        text: paragraph.substring(0, 300),
        label: bestLabel,
        confidence: bestScore,
      });
    }

    return segments;
  }

  async getEmbeddings(text: string): Promise<number[] | null> {
    if (!this.token || !text.trim()) return null;

    const truncated = text.substring(0, 512);

    try {
      const result = await this.hfRequest(
        `/pipeline/feature-extraction/${INLEGAL_BERT_MODEL}`,
        {
          inputs: truncated,
          options: { wait_for_model: true },
        }
      );

      if (Array.isArray(result) && result.length > 0) {
        if (Array.isArray(result[0]) && Array.isArray(result[0][0])) {
          const tokens = result[0];
          const dim = tokens[0].length;
          const mean = new Array(dim).fill(0);
          for (const token of tokens) {
            for (let i = 0; i < dim; i++) mean[i] += token[i];
          }
          for (let i = 0; i < dim; i++) mean[i] /= tokens.length;
          return mean;
        }
        if (Array.isArray(result[0]) && typeof result[0][0] === 'number') {
          return result[0];
        }
      }
      return null;
    } catch (error) {
      console.error("[InLegalBERT] Embedding error:", error);
      return null;
    }
  }

  async rankByRelevance(
    query: string,
    documents: { id: string; title: string; text: string }[]
  ): Promise<{ id: string; title: string; text: string; relevanceScore: number }[]> {
    if (!this.token || documents.length === 0) {
      return documents.map(d => ({ ...d, relevanceScore: 0.5 }));
    }

    try {
      const queryEmbedding = await this.getEmbeddings(query);
      if (!queryEmbedding) {
        return documents.map(d => ({ ...d, relevanceScore: 0.5 }));
      }

      const rankedDocs = await Promise.all(
        documents.slice(0, 10).map(async (doc) => {
          const docText = `${doc.title} ${doc.text}`.substring(0, 512);
          const docEmbedding = await this.getEmbeddings(docText);
          
          if (!docEmbedding) return { ...doc, relevanceScore: 0.5 };
          
          const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
          const clamped = Math.max(0, Math.min(1, (similarity + 1) / 2));
          return { ...doc, relevanceScore: clamped };
        })
      );

      return rankedDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error("[InLegalBERT] Ranking error:", error);
      return documents.map(d => ({ ...d, relevanceScore: 0.5 }));
    }
  }

  async enhanceSearchQuery(facts: string): Promise<string[]> {
    const statutes = await this.identifyStatutes(facts);
    
    const queries: string[] = [];
    
    for (const s of statutes.slice(0, 3)) {
      queries.push(s.statute);
    }

    const legalKeywords = this.extractLegalKeywords(facts);
    if (legalKeywords.length > 0) {
      queries.push(legalKeywords.join(" "));
    }

    return queries;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private fallbackStatuteIdentification(facts: string): { statute: string; confidence: number }[] {
    const lower = facts.toLowerCase();
    const matches: { statute: string; confidence: number }[] = [];

    const keywordMap: Record<string, string[]> = {
      "Indian Penal Code, 1860": ["murder", "theft", "cheating", "assault", "criminal", "offence", "ipc", "section 420", "section 302", "section 498a"],
      "Bharatiya Nyaya Sanhita, 2023": ["bns", "bharatiya nyaya"],
      "Code of Criminal Procedure, 1973": ["crpc", "bail", "fir", "arrest", "investigation", "charge sheet", "criminal procedure"],
      "Bharatiya Nagarik Suraksha Sanhita, 2023": ["bnss", "nagarik suraksha"],
      "Code of Civil Procedure, 1908": ["cpc", "civil suit", "decree", "plaint", "order vii", "civil procedure"],
      "Indian Contract Act, 1872": ["contract", "agreement", "breach", "consideration", "offer", "acceptance", "damages"],
      "Indian Evidence Act, 1872": ["evidence", "witness", "testimony", "admissibility", "hearsay"],
      "Bharatiya Sakshya Adhiniyam, 2023": ["sakshya", "bharatiya sakshya"],
      "Transfer of Property Act, 1882": ["property", "sale deed", "lease", "mortgage", "transfer", "immovable property"],
      "Negotiable Instruments Act, 1881": ["cheque", "dishonour", "section 138", "negotiable instrument", "promissory note"],
      "Companies Act, 2013": ["company", "director", "shareholder", "board", "agm", "corporate", "winding up"],
      "Arbitration and Conciliation Act, 1996": ["arbitration", "arbitrator", "arbitral", "section 11", "section 34", "section 9"],
      "Consumer Protection Act, 2019": ["consumer", "deficiency", "goods", "service", "complaint", "unfair trade"],
      "Information Technology Act, 2000": ["cyber", "electronic", "data", "hacking", "it act", "digital"],
      "Hindu Marriage Act, 1955": ["divorce", "marriage", "cruelty", "desertion", "maintenance", "hindu marriage"],
      "Protection of Women from Domestic Violence Act, 2005": ["domestic violence", "protection order", "dv act", "shared household"],
      "Insolvency and Bankruptcy Code, 2016": ["insolvency", "bankruptcy", "ibc", "nclt", "cirp", "resolution"],
      "Real Estate (Regulation and Development) Act, 2016": ["rera", "real estate", "builder", "developer", "flat", "apartment"],
      "Goods and Services Tax Act, 2017": ["gst", "goods and services tax", "input tax credit", "igst", "cgst", "sgst"],
      "Income Tax Act, 1961": ["income tax", "assessment", "deduction", "capital gain", "tds", "section 80"],
      "Constitutional Law": ["fundamental rights", "article 14", "article 19", "article 21", "writ", "constitution", "constitutional"],
      "Specific Relief Act, 1963": ["specific performance", "injunction", "declaration"],
      "Labour Laws": ["employee", "employer", "wages", "industrial dispute", "workman", "termination", "labour"],
      "Environmental Laws": ["pollution", "environment", "ngt", "forest", "wildlife", "emission"],
    };

    for (const [statute, keywords] of Object.entries(keywordMap)) {
      let matchCount = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) matchCount++;
      }
      if (matchCount > 0) {
        const confidence = Math.min(0.95, 0.3 + matchCount * 0.15);
        matches.push({ statute, confidence });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private fallbackClassifyParagraph(text: string): { text: string; label: string; confidence: number } {
    const lower = text.toLowerCase();
    
    if (/\bsection\s+\d+|\bact,?\s*\d{4}|\brule\s+\d+/i.test(text)) {
      return { text: text.substring(0, 300), label: "Statute Reference", confidence: 0.8 };
    }
    if (/\bv\.?\s|versus|\bair\s+\d{4}|\bscc\s+\d+|\(\d{4}\)\s+\d+\s+scc/i.test(text)) {
      return { text: text.substring(0, 300), label: "Case Law Citation", confidence: 0.8 };
    }
    if (/\bordered|\bdirected|\bdismissed|\ballowed|\bdecreed|\bheld\b/i.test(lower)) {
      return { text: text.substring(0, 300), label: "Ruling/Order", confidence: 0.6 };
    }
    if (/\bprayer|\brelief|\bhumbly\s+pray|\bit is prayed/i.test(lower)) {
      return { text: text.substring(0, 300), label: "Prayer/Relief", confidence: 0.8 };
    }
    if (/\bsubmitted|\bargued|\bcontended|\bpleaded/i.test(lower)) {
      return { text: text.substring(0, 300), label: "Arguments", confidence: 0.6 };
    }
    
    return { text: text.substring(0, 300), label: "Facts", confidence: 0.5 };
  }

  private extractLegalKeywords(text: string): string[] {
    const keywords: string[] = [];
    
    const patterns = [
      /Section\s+\d+[A-Za-z]?/gi,
      /Article\s+\d+[A-Za-z]?/gi,
      /Order\s+[IVXLC]+\s+Rule\s+\d+/gi,
      /\b\w+\s+Act,?\s*\d{4}/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        keywords.push(...matches.slice(0, 3));
      }
    }

    return Array.from(new Set(keywords)).slice(0, 5);
  }
}

export const inLegalBERT = new InLegalBERTService();
