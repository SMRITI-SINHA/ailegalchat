import * as ort from "onnxruntime-node";
import { join, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODEL_DIR = join(__dirname, "models", "inlegalbert");
const ONNX_PATH = join(MODEL_DIR, "model_quantized.onnx");
const VOCAB_PATH = join(MODEL_DIR, "vocab.txt");

// ── Minimal BERT WordPiece Tokenizer ─────────────────────────────────────────

const CLS_ID = 101;
const SEP_ID = 102;
const UNK_ID = 100;
const MAX_SEQ = 512;

function loadVocab(vocabPath: string): Map<string, number> {
  const lines = readFileSync(vocabPath, "utf-8").split("\n");
  const vocab = new Map<string, number>();
  lines.forEach((line, idx) => {
    const token = line.trim();
    if (token) vocab.set(token, idx);
  });
  return vocab;
}

function basicTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, (ch) => ` ${ch} `)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function wordpieceTokenize(word: string, vocab: Map<string, number>): number[] {
  const ids: number[] = [];
  if (vocab.has(word)) return [vocab.get(word)!];

  let start = 0;
  while (start < word.length) {
    let end = word.length;
    let found = false;
    while (start < end) {
      const substr = (start === 0 ? "" : "##") + word.slice(start, end);
      if (vocab.has(substr)) {
        ids.push(vocab.get(substr)!);
        start = end;
        found = true;
        break;
      }
      end--;
    }
    if (!found) {
      return [UNK_ID];
    }
  }
  return ids;
}

function bertTokenize(
  text: string,
  vocab: Map<string, number>
): { ids: number[]; mask: number[] } {
  const words = basicTokenize(text.substring(0, 2048));
  let tokenIds: number[] = [CLS_ID];

  for (const word of words) {
    const wpIds = wordpieceTokenize(word, vocab);
    for (const id of wpIds) {
      tokenIds.push(id);
      if (tokenIds.length >= MAX_SEQ - 1) break;
    }
    if (tokenIds.length >= MAX_SEQ - 1) break;
  }

  tokenIds.push(SEP_ID);

  const mask = new Array(tokenIds.length).fill(1);
  return { ids: tokenIds, mask };
}

// ── Statute & Segment Labels ──────────────────────────────────────────────────

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

// ── InLegalBERT Service ───────────────────────────────────────────────────────

export class InLegalBERTService {
  private session: ort.InferenceSession | null = null;
  private vocab: Map<string, number> | null = null;
  private modelLoaded = false;
  private initPromise: Promise<void>;
  private embeddingCache: Map<string, number[]> = new Map();
  private statuteEmbeddingsCache: Map<string, number[]> = new Map();
  private labelEmbeddingsCache: Map<string, number[]> = new Map();
  private embeddingsCacheLoaded = false;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!existsSync(ONNX_PATH) || !existsSync(VOCAB_PATH)) {
      console.warn(
        "[InLegalBERT] Model files not found at",
        MODEL_DIR,
        "— keyword fallback active. Run GitHub Actions workflow 'Convert InLegalBERT to ONNX' once to enable local inference."
      );
      return;
    }

    try {
      console.log("[InLegalBERT] Loading vocab from", VOCAB_PATH);
      this.vocab = loadVocab(VOCAB_PATH);
      console.log(`[InLegalBERT] Vocab loaded: ${this.vocab.size} tokens`);

      console.log("[InLegalBERT] Loading ONNX model from", ONNX_PATH);
      this.session = await ort.InferenceSession.create(ONNX_PATH, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
        enableCpuMemArena: true,
      });

      this.modelLoaded = true;
      console.log("[InLegalBERT] Ready — local ONNX inference active.");
    } catch (err) {
      console.error("[InLegalBERT] Failed to load model:", err);
      this.session = null;
      this.vocab = null;
      this.modelLoaded = false;
    }
  }

  private async ensureLoaded(): Promise<void> {
    await this.initPromise;
  }

  isConfigured(): boolean {
    return this.modelLoaded;
  }

  private async computeEmbedding(text: string): Promise<number[] | null> {
    if (!this.session || !this.vocab) return null;

    const cacheKey = text.substring(0, 128);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { ids, mask } = bertTokenize(text, this.vocab);
      const typeIds = new Array(ids.length).fill(0);

      const feeds: Record<string, ort.Tensor> = {
        input_ids: new ort.Tensor(
          "int64",
          BigInt64Array.from(ids.map(BigInt)),
          [1, ids.length]
        ),
        attention_mask: new ort.Tensor(
          "int64",
          BigInt64Array.from(mask.map(BigInt)),
          [1, mask.length]
        ),
        token_type_ids: new ort.Tensor(
          "int64",
          BigInt64Array.from(typeIds.map(BigInt)),
          [1, typeIds.length]
        ),
      };

      const output = await this.session.run(feeds);
      const tensor =
        output["last_hidden_state"] ?? output[Object.keys(output)[0]];
      const data = tensor.data as Float32Array;
      const seqLen = ids.length;
      const hiddenSize = data.length / seqLen;

      // Mean pooling over token dimension
      const mean = new Array(hiddenSize).fill(0);
      for (let t = 0; t < seqLen; t++) {
        for (let h = 0; h < hiddenSize; h++) {
          mean[h] += data[t * hiddenSize + h];
        }
      }
      for (let h = 0; h < hiddenSize; h++) mean[h] /= seqLen;

      if (this.embeddingCache.size > 300) {
        const oldest = this.embeddingCache.keys().next().value;
        if (oldest) this.embeddingCache.delete(oldest);
      }
      this.embeddingCache.set(cacheKey, mean);
      return mean;
    } catch (err) {
      console.error("[InLegalBERT] Embedding error:", err);
      return null;
    }
  }

  private async ensureEmbeddingsCached(): Promise<void> {
    await this.ensureLoaded();
    if (this.embeddingsCacheLoaded || !this.modelLoaded) return;
    this.embeddingsCacheLoaded = true;

    console.log("[InLegalBERT] Pre-computing statute and label embeddings...");

    await Promise.all([
      ...LEGAL_STATUTE_LABELS.map(async (statute) => {
        const emb = await this.computeEmbedding(statute);
        if (emb) this.statuteEmbeddingsCache.set(statute, emb);
      }),
      ...DOCUMENT_SEGMENT_LABELS.map(async (label) => {
        const emb = await this.computeEmbedding(label);
        if (emb) this.labelEmbeddingsCache.set(label, emb);
      }),
    ]);

    console.log(
      `[InLegalBERT] Cached ${this.statuteEmbeddingsCache.size} statute + ${this.labelEmbeddingsCache.size} label embeddings`
    );
  }

  async getEmbeddings(text: string): Promise<number[] | null> {
    await this.ensureLoaded();
    if (!this.modelLoaded || !text.trim()) return null;
    return this.computeEmbedding(text.substring(0, 512));
  }

  async identifyStatutes(
    facts: string
  ): Promise<{ statute: string; confidence: number }[]> {
    await this.ensureLoaded();
    if (!this.modelLoaded || !facts.trim())
      return this.fallbackStatuteIdentification(facts);

    try {
      await this.ensureEmbeddingsCached();

      const factsEmbedding = await this.computeEmbedding(
        facts.substring(0, 1500)
      );
      if (!factsEmbedding) return this.fallbackStatuteIdentification(facts);

      const scores: { statute: string; confidence: number }[] = [];
      for (const statute of LEGAL_STATUTE_LABELS) {
        const emb = this.statuteEmbeddingsCache.get(statute);
        if (emb) {
          const sim = this.cosineSimilarity(factsEmbedding, emb);
          scores.push({ statute, confidence: Math.max(0, Math.min(1, (sim + 1) / 2)) });
        }
      }

      if (scores.length === 0) return this.fallbackStatuteIdentification(facts);

      const results = scores
        .sort((a, b) => b.confidence - a.confidence)
        .filter((s) => s.confidence > 0.55)
        .slice(0, 5);

      return results.length > 0
        ? results
        : this.fallbackStatuteIdentification(facts);
    } catch (error) {
      console.error("[InLegalBERT] Statute identification error:", error);
      return this.fallbackStatuteIdentification(facts);
    }
  }

  async classifySegments(
    text: string
  ): Promise<{ text: string; label: string; confidence: number }[]> {
    await this.ensureLoaded();

    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30);

    if (!this.modelLoaded) {
      return paragraphs.slice(0, 20).map((p) => this.fallbackClassifyParagraph(p));
    }

    await this.ensureEmbeddingsCached();

    if (this.labelEmbeddingsCache.size === 0) {
      return paragraphs.slice(0, 20).map((p) => this.fallbackClassifyParagraph(p));
    }

    const segments: { text: string; label: string; confidence: number }[] = [];

    for (const paragraph of paragraphs.slice(0, 20)) {
      const paraEmb = await this.computeEmbedding(paragraph.substring(0, 512));

      if (!paraEmb) {
        segments.push(this.fallbackClassifyParagraph(paragraph));
        continue;
      }

      let bestLabel = "Facts";
      let bestScore = -1;

      for (const [label, labelEmb] of Array.from(
        this.labelEmbeddingsCache.entries()
      )) {
        const sim = this.cosineSimilarity(paraEmb, labelEmb);
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

  async rankByRelevance(
    query: string,
    documents: { id: string; title: string; text: string }[]
  ): Promise<
    { id: string; title: string; text: string; relevanceScore: number }[]
  > {
    await this.ensureLoaded();

    if (!this.modelLoaded || documents.length === 0) {
      return documents.map((d) => ({ ...d, relevanceScore: 0.5 }));
    }

    try {
      const queryEmb = await this.computeEmbedding(query);
      if (!queryEmb) return documents.map((d) => ({ ...d, relevanceScore: 0.5 }));

      const ranked = await Promise.all(
        documents.slice(0, 10).map(async (doc) => {
          const docEmb = await this.computeEmbedding(
            `${doc.title} ${doc.text}`.substring(0, 512)
          );
          if (!docEmb) return { ...doc, relevanceScore: 0.5 };
          const sim = this.cosineSimilarity(queryEmb, docEmb);
          return { ...doc, relevanceScore: Math.max(0, Math.min(1, (sim + 1) / 2)) };
        })
      );

      return ranked.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error("[InLegalBERT] Ranking error:", error);
      return documents.map((d) => ({ ...d, relevanceScore: 0.5 }));
    }
  }

  async enhanceSearchQuery(facts: string): Promise<string[]> {
    const statutes = await this.identifyStatutes(facts);
    const queries: string[] = statutes.slice(0, 3).map((s) => s.statute);
    const keywords = this.extractLegalKeywords(facts);
    if (keywords.length > 0) queries.push(keywords.join(" "));
    return queries;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  private fallbackStatuteIdentification(
    facts: string
  ): { statute: string; confidence: number }[] {
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
      for (const kw of keywords) if (lower.includes(kw)) matchCount++;
      if (matchCount > 0) {
        matches.push({ statute, confidence: Math.min(0.95, 0.3 + matchCount * 0.15) });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private fallbackClassifyParagraph(text: string): {
    text: string;
    label: string;
    confidence: number;
  } {
    const lower = text.toLowerCase();
    if (/\bsection\s+\d+|\bact,?\s*\d{4}|\brule\s+\d+/i.test(text))
      return { text: text.substring(0, 300), label: "Statute Reference", confidence: 0.8 };
    if (/\bv\.?\s|versus|\bair\s+\d{4}|\bscc\s+\d+|\(\d{4}\)\s+\d+\s+scc/i.test(text))
      return { text: text.substring(0, 300), label: "Case Law Citation", confidence: 0.8 };
    if (/\bordered|\bdirected|\bdismissed|\ballowed|\bdecreed|\bheld\b/i.test(lower))
      return { text: text.substring(0, 300), label: "Ruling/Order", confidence: 0.6 };
    if (/\bprayer|\brelief|\bhumbly\s+pray|\bit is prayed/i.test(lower))
      return { text: text.substring(0, 300), label: "Prayer/Relief", confidence: 0.8 };
    if (/\bsubmitted|\bargued|\bcontended|\bpleaded/i.test(lower))
      return { text: text.substring(0, 300), label: "Arguments", confidence: 0.6 };
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
      if (matches) keywords.push(...matches.slice(0, 3));
    }
    return Array.from(new Set(keywords)).slice(0, 5);
  }
}

export const inLegalBERT = new InLegalBERTService();
