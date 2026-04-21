import { aiCache } from "./ai-cache";
import { withRetry } from "./ai-retry";

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface PerplexityResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

// PRIORITY DOMAINS - From urls.json (Chakshi's curated sources)
export const PRIORITY_DOMAINS = [
  // Legal News & Analysis (Priority)
  "livelaw.in",
  "barandbench.com",
  "indialegallive.com",
  "legal.economictimes.indiatimes.com",
  "lawstreet.co",
  "latestlaws.com",
  "aironline.in",
  "indialawlibrary.com",
  "karanjawala.in",
  
  // Supreme Court & Judiciary (Priority)
  "sci.gov.in",
  
  // Government & Regulatory Bodies (Priority)
  "sebi.gov.in",
  "rbi.org.in",
  "mca.gov.in",
  "cbic.gov.in",
  "gst.gov.in",
  "services.gst.gov.in",
  "incometaxindia.gov.in",
  "incometax.gov.in",
  "irdai.gov.in",
  "epfindia.gov.in",
  "esic.gov.in",
  "pfrda.org.in",
  "fssai.gov.in",
  "ibbi.gov.in",
  "cci.gov.in",
  "cciindia.org",
  "labour.gov.in",
  "clc.gov.in",
  "eshram.gov.in",
  "moef.gov.in",
  "cpcb.nic.in",
  "pcbassam.org",
  "cercind.gov.in",
  
  // Trade & Commerce (Priority)
  "dgft.gov.in",
  "icegate.gov.in",
  "commerce.gov.in",
  "dpiit.gov.in",
  "startupindia.gov.in",
  "apeda.gov.in",
  "main.ecgc.in",
  "wto.org",
  
  // Banking & Finance (Priority)
  "nabard.org",
  "sidbi.in",
  "bankofbaroda.bank.in",
  "dea.gov.in",
  
  // Industry & Energy (Priority)
  "steel.gov.in",
  "coal.nic.in",
  "mines.gov.in",
  "dgms.gov.in",
  "powermin.gov.in",
  "petroleum.nic.in",
  "mopng.gov.in",
  
  // Telecom & IT (Priority)
  "trai.gov.in",
  "dot.gov.in",
  
  // Health & Pharma (Priority)
  "cdsco.gov.in",
  
  // Government Gazette & Publications (Priority)
  "egazette.gov.in",
  "pib.gov.in",
  "india.gov.in",
  "indiacode.nic.in",
  "lawcommissionofindia.nic.in",
];

// SECONDARY DOMAINS - Additional legal sources
export const SECONDARY_DOMAINS = [
  // Legal News & Analysis
  "scconline.com",
  "lawctopus.com",
  "legalbites.in",
  "advocatekhoj.com",
  "vakilno1.com",
  "lawyersclubindia.com",
  "indianlawportal.co.in",
  "lawrato.com",
  "legalservicesindia.com",
  "aaptaxlaw.com",
  "taxmann.com",
  "caclubindia.com",
  "icai.org",
  "icsi.edu",
  "itatonline.org",
  "judis.nic.in",
  "casemine.com",
  "indiancaselaws.com",
  "manupatra.com",
  "legitquest.com",
  "lawweb.in",
  "nludelhi.ac.in",
  "nlsiu.ac.in",
  
  // Supreme Court & High Courts
  "main.sci.gov.in",
  "delhihighcourt.nic.in",
  "bombayhighcourt.nic.in",
  "mhc.tn.gov.in",
  "highcourtofkerala.in",
  "karnatakajudiciary.kar.nic.in",
  "ghcl.gujarat.gov.in",
  "hcmadras.tn.gov.in",
  "calcuttahighcourt.gov.in",
  "highcourt.mp.gov.in",
  "highcourtofrajasthan.nic.in",
  "jharkhandhighcourt.nic.in",
  "orissahighcourt.nic.in",
  "phhc.gov.in",
  "allahabadhighcourt.in",
  "hcpatna.nic.in",
  "hcs.gov.in",
  "jkhighcourt.nic.in",
  "hphighcourt.nic.in",
  "gauhati.nic.in",
  "tripurahc.nic.in",
  "cghc.gov.in",
  "hc.ts.nic.in",
  "hc.ap.nic.in",
  "highcourt.manipur.gov.in",
  "sikkimjudiciary.nic.in",
  "meghalayahighcourt.nic.in",
  
  // Additional Government & Regulatory Bodies
  "nclat.nic.in",
  "nclt.gov.in",
  "ncdrc.nic.in",
  "drt.gov.in",
  "drat.gov.in",
  "itat.gov.in",
  "cestat.gov.in",
  "cat.nic.in",
  "nhrc.nic.in",
  "ncw.nic.in",
  "ncbc.nic.in",
  "ncsc.nic.in",
  "ncst.nic.in",
  "shc.nic.in",
  "rera.gov.in",
  "prsindia.org",
  "legislative.gov.in",
  "egazette.nic.in",
  "doj.gov.in",
  "lawmin.gov.in",
  "wcd.nic.in",
  "socialjustice.nic.in",
  "tribal.nic.in",
  "agrimin.gov.in",
  "meity.gov.in",
  "doe.gov.in",
  "mea.gov.in",
  "mha.gov.in",
  "mod.gov.in",
  "mohua.gov.in",
  "msme.gov.in",
  "morth.nic.in",
  "shipmin.gov.in",
  "civilaviation.gov.in",
  "textilesindia.gov.in",
  "tourism.gov.in",
  
  // Legal Research & Education
  "indiankanoon.org",
  "legal500.com",
  "chambers.com",
  "asialaw.com",
  "lexology.com",
  "mondaq.com",
  "conventus.com",
  "iclg.com",
  "globalcompliancenews.com",
  "financiertimes.com",
  "legaleraonline.com",
  "asiantaxbulletin.com",
  "indianbusinesslaw.com"
];

// Combined domains - Priority first, then secondary (with deduplication)
export const LEGAL_DOMAINS = Array.from(new Set([...PRIORITY_DOMAINS, ...SECONDARY_DOMAINS]));

export class LegalWebSearchService {
  private static requestQueue: Promise<void> = Promise.resolve();
  private static nextAvailableAt = 0;

  private perplexityKey: string | null;
  private readonly perplexityMinIntervalMs: number;

  constructor() {
    this.perplexityKey = process.env.PERPLEXITY_API_KEY || null;
    this.perplexityMinIntervalMs = Number(process.env.PERPLEXITY_MIN_INTERVAL_MS || 1250);
  }

  isConfigured(): boolean {
    return !!this.perplexityKey;
  }

  private async fetchPerplexity(body: Record<string, unknown>, label: string): Promise<PerplexityResponse> {
    await this.waitForPerplexitySlot(label);

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error: Error & { status?: number } = new Error(`${label} failed: ${errorText}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  private async waitForPerplexitySlot(label: string): Promise<void> {
    const previous = LegalWebSearchService.requestQueue;
    LegalWebSearchService.requestQueue = previous
      .catch(() => undefined)
      .then(async () => {
        const now = Date.now();
        const delayMs = Math.max(0, LegalWebSearchService.nextAvailableAt - now);

        if (delayMs > 0) {
          console.log(`[perplexity-rate-limit] pacing ${label} for ${delayMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        LegalWebSearchService.nextAvailableAt = Date.now() + this.perplexityMinIntervalMs;
      });

    await LegalWebSearchService.requestQueue;
  }

  getDomainList(): string[] {
    return LEGAL_DOMAINS;
  }

  getPriorityDomains(): string[] {
    return PRIORITY_DOMAINS;
  }

  getTotalDomainCount(): { priority: number; secondary: number; total: number } {
    return {
      priority: PRIORITY_DOMAINS.length,
      secondary: SECONDARY_DOMAINS.length,
      total: LEGAL_DOMAINS.length,
    };
  }

  async searchLegal(query: string): Promise<{ answer: string; sources: WebSearchResult[] }> {
    if (!this.perplexityKey) {
      console.warn("Perplexity API key not configured, skipping web search");
      return { answer: "", sources: [] };
    }

    const cacheKey = { query: query.trim().toLowerCase(), recency: "month", model: "sonar" };
    const cached = aiCache.get<{ answer: string; sources: WebSearchResult[] }>("perplexity:legal", cacheKey);
    if (cached) return cached;

    try {
      const legalDomains = LEGAL_DOMAINS;

      const data = await withRetry(() => this.fetchPerplexity({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: `You are a legal research assistant specializing in Indian law. Search across authoritative Indian legal sources including: Indian Kanoon, Live Law, Bar & Bench, SCC Online, Manupatra, government portals (SEBI, RBI, MCA, CBIC), High Court and Supreme Court websites, and regulatory bodies.

Provide accurate, factual information with citations. Focus on:
- Recent legal developments and amendments
- Case law and precedents from Indian courts
- Regulatory updates from SEBI, RBI, MCA, CBIC, IRDAI, CCI, NCLT
- Legal news from authoritative Indian sources
Be precise and always cite your sources with proper legal citations.`
            },
            {
              role: "user",
              content: `Indian law query: ${query}`
            }
          ],
          max_tokens: 1024,
          temperature: 0.2,
          top_p: 0.9,
          search_domain_filter: PRIORITY_DOMAINS.slice(0, 20),
          return_images: false,
          return_related_questions: false,
          search_recency_filter: "month",
          stream: false,
        }, "perplexity legal search"), 3, "perplexity legal search");
      
      const answer = data.choices?.[0]?.message?.content || "";
      const sources: WebSearchResult[] = (data.citations || []).map((url, index) => ({
        title: this.extractDomainName(url),
        url,
        snippet: "",
        source: this.extractSourceName(url),
      }));

      const result = { answer, sources };
      if (answer) aiCache.set("perplexity:legal", cacheKey, result);
      return result;
    } catch (error) {
      console.error("Legal web search error:", error);
      return { answer: "", sources: [] };
    }
  }

  async searchComplianceRequirements(industry: string, activity: string, jurisdiction: string): Promise<{
    answer: string;
    sources: WebSearchResult[];
    recentChanges: string[];
  }> {
    if (!this.perplexityKey) {
      console.warn("Perplexity API key not configured for compliance search");
      return { answer: "", sources: [], recentChanges: [] };
    }

    // Industry-specific regulatory domains
    const industryDomains: Record<string, string[]> = {
      "Startup / Tech": ["startupindia.gov.in", "dpiit.gov.in", "mca.gov.in", "meity.gov.in", "livelaw.in"],
      "Fintech": ["rbi.org.in", "sebi.gov.in", "ibbi.gov.in", "mca.gov.in", "barandbench.com"],
      "Edtech": ["mhrd.gov.in", "aicte-india.org", "ugc.ac.in", "mca.gov.in", "livelaw.in"],
      "Healthcare": ["cdsco.gov.in", "fssai.gov.in", "nhm.gov.in", "mohfw.gov.in", "barandbench.com"],
      "E-commerce": ["mca.gov.in", "dpiit.gov.in", "cbic.gov.in", "gst.gov.in", "livelaw.in"],
      "Real Estate": ["rera.gov.in", "mohua.gov.in", "mca.gov.in", "barandbench.com", "latestlaws.com"],
      "Manufacturing": ["moef.gov.in", "cpcb.nic.in", "labour.gov.in", "dgft.gov.in", "livelaw.in"],
      "NBFC": ["rbi.org.in", "mca.gov.in", "sebi.gov.in", "ibbi.gov.in", "barandbench.com"],
      "Banking": ["rbi.org.in", "dea.gov.in", "mca.gov.in", "sebi.gov.in", "latestlaws.com"],
      "Insurance": ["irdai.gov.in", "mca.gov.in", "rbi.org.in", "barandbench.com", "livelaw.in"],
    };

    // Get relevant domains for this industry (with fallbacks)
    const primaryDomains = industryDomains[industry] || PRIORITY_DOMAINS.slice(0, 10);
    const searchDomains = [...primaryDomains, ...PRIORITY_DOMAINS.slice(0, 5)].slice(0, 10);
    const cacheKey = {
      industry: industry.trim().toLowerCase(),
      activity: activity.trim().toLowerCase(),
      jurisdiction: jurisdiction.trim().toLowerCase(),
      domains: searchDomains.join(","),
      model: "sonar",
    };
    const cached = aiCache.get<{
      answer: string;
      sources: WebSearchResult[];
      recentChanges: string[];
    }>("perplexity:compliance", cacheKey);
    if (cached) return cached;

    try {
      const data = await withRetry(() => this.fetchPerplexity({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: `You are an expert Indian regulatory compliance advisor. Your role is to provide CURRENT, ACCURATE compliance requirements for businesses in India.

STRICT VERIFICATION REQUIREMENTS:
1. ONLY cite requirements that are currently in force (not proposed or repealed)
2. Include SPECIFIC legal references: Act name + Year + Section/Rule number
3. Note any recent amendments or notifications (last 6 months)
4. Distinguish between mandatory requirements and best practices
5. Provide actual deadlines and penalty amounts where applicable

TRUSTED SOURCES ONLY - Verify from:
- Government portals: MCA, SEBI, RBI, CBIC, State portals
- Official gazette notifications (egazette.gov.in)
- Regulatory circulars and master directions
- Authoritative legal news: Live Law, Bar & Bench

Mark any unverified items with "[VERIFY FROM OFFICIAL SOURCE]"`
            },
            {
              role: "user",
              content: `Generate a comprehensive compliance checklist for:

Industry: ${industry}
Business Activity: ${activity}
Jurisdiction: ${jurisdiction}

For each compliance requirement, provide:
1. Requirement name
2. What exactly needs to be done
3. EXACT legal reference (Act/Section/Rule)
4. Deadline (specific timeframe from triggering event)
5. Penalty for non-compliance
6. Risk level (HIGH/MEDIUM/LOW based on penalties)
7. Any RECENT CHANGES or amendments in the last 6 months

Focus on requirements that are CURRENTLY APPLICABLE. Include state-specific requirements for ${jurisdiction} if any.`
            }
          ],
          max_tokens: 2048,
          temperature: 0.1,
          top_p: 0.9,
          search_domain_filter: searchDomains,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: "month",
          stream: false,
        }, "perplexity compliance search"), 3, "perplexity compliance search");
      
      const answer = data.choices?.[0]?.message?.content || "";
      const sources: WebSearchResult[] = (data.citations || []).map((url) => ({
        title: this.extractDomainName(url),
        url,
        snippet: "",
        source: this.extractSourceName(url),
      }));

      // Extract recent changes mentioned in the response
      const recentChanges: string[] = [];
      const changePatterns = [
        /(?:recent|new|latest|amended|notification|circular).*?(?:\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /w\.e\.f\.?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
        /effective from\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
      ];
      for (const pattern of changePatterns) {
        const matches = answer.match(pattern);
        if (matches) {
          recentChanges.push(...matches.slice(0, 5));
        }
      }

      const result = { answer, sources, recentChanges: Array.from(new Set(recentChanges)) };
      if (answer) aiCache.set("perplexity:compliance", cacheKey, result);
      return result;
    } catch (error) {
      console.error("Compliance search error:", error);
      return { answer: "", sources: [], recentChanges: [] };
    }
  }

  async searchRegulatory(query: string, regulator: "sebi" | "rbi" | "mca" | "cbic" | "general"): Promise<{ answer: string; sources: WebSearchResult[] }> {
    if (!this.perplexityKey) {
      return { answer: "", sources: [] };
    }

    const regulatorDomains: Record<string, string[]> = {
      sebi: ["sebi.gov.in", "nseindia.com", "bseindia.com", "legal.economictimes.indiatimes.com"],
      rbi: ["rbi.org.in", "nabard.org", "sidbi.in", "dea.gov.in", "bankofbaroda.bank.in"],
      mca: ["mca.gov.in", "ibbi.gov.in", "nclt.gov.in", "nclat.nic.in"],
      cbic: ["cbic.gov.in", "gst.gov.in", "services.gst.gov.in", "icegate.gov.in", "dgft.gov.in"],
      general: ["livelaw.in", "barandbench.com", "scconline.com", "indialegallive.com", "latestlaws.com"],
    };
    const searchDomains = regulatorDomains[regulator] || regulatorDomains.general;
    const cacheKey = {
      query: query.trim().toLowerCase(),
      regulator,
      domains: searchDomains.join(","),
      recency: "week",
      model: "sonar",
    };
    const cached = aiCache.get<{ answer: string; sources: WebSearchResult[] }>("perplexity:regulatory", cacheKey);
    if (cached) return cached;

    try {
      const data = await withRetry(() => this.fetchPerplexity({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: `You are a regulatory compliance expert for Indian ${regulator.toUpperCase()} regulations. Provide accurate, current regulatory information with proper citations.`
            },
            {
              role: "user",
              content: query
            }
          ],
          max_tokens: 1024,
          temperature: 0.1,
          search_domain_filter: searchDomains,
          search_recency_filter: "week",
          stream: false,
        }, "perplexity regulatory search"), 3, "perplexity regulatory search");
      
      const result = {
        answer: data.choices?.[0]?.message?.content || "",
        sources: (data.citations || []).map(url => ({
          title: this.extractDomainName(url),
          url,
          snippet: "",
          source: this.extractSourceName(url),
        })),
      };
      if (result.answer) aiCache.set("perplexity:regulatory", cacheKey, result);
      return result;
    } catch (error) {
      console.error("Regulatory search error:", error);
      return { answer: "", sources: [] };
    }
  }

  private extractDomainName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace("www.", "");
    } catch {
      return url;
    }
  }

  private extractSourceName(url: string): string {
    const domain = this.extractDomainName(url);
    const sourceMap: Record<string, string> = {
      "livelaw.in": "Live Law",
      "barandbench.com": "Bar & Bench",
      "indiankanoon.org": "Indian Kanoon",
      "scconline.com": "SCC Online",
      "lawctopus.com": "Lawctopus",
      "legalbites.in": "Legal Bites",
      "latestlaws.com": "Latest Laws",
      "sebi.gov.in": "SEBI",
      "rbi.org.in": "RBI",
      "mca.gov.in": "MCA",
      "incometaxindia.gov.in": "Income Tax India",
      "cbic.gov.in": "CBIC",
      "gst.gov.in": "GST Portal",
      "main.sci.gov.in": "Supreme Court of India",
      "delhihighcourt.nic.in": "Delhi High Court",
      "bombayhighcourt.nic.in": "Bombay High Court",
      "cci.gov.in": "Competition Commission",
      "nclat.nic.in": "NCLAT",
      "nclt.gov.in": "NCLT",
      "ncdrc.nic.in": "NCDRC",
      "irdai.gov.in": "IRDAI",
      "ibbi.gov.in": "IBBI",
      "rera.gov.in": "RERA",
      "nhrc.nic.in": "NHRC",
      "ncw.nic.in": "NCW",
      "prsindia.org": "PRS India",
      "indiacode.nic.in": "India Code",
      "egazette.nic.in": "E-Gazette",
      "manupatra.com": "Manupatra",
      "casemine.com": "CaseMine",
      "legitquest.com": "LegitQuest",
      "taxmann.com": "Taxmann",
      "icai.org": "ICAI",
      "icsi.edu": "ICSI",
    };
    return sourceMap[domain] || domain;
  }

  async advancedSearch(query: string): Promise<{
    answer: string;
    sources: WebSearchResult[];
    extractedParagraphs: Array<{
      text: string;
      citation: string;
      sections?: string[];
      acts?: string[];
      court?: string;
    }>;
    timeline: Array<{
      date: string;
      event: string;
      source: string;
    }>;
    conflicts: Array<{
      issue: string;
      sources: string[];
    }>;
    tags: {
      sections: string[];
      acts: string[];
      courts: string[];
    };
  }> {
    if (!this.perplexityKey) {
      return {
        answer: "",
        sources: [],
        extractedParagraphs: [],
        timeline: [],
        conflicts: [],
        tags: { sections: [], acts: [], courts: [] },
      };
    }

    const cacheKey = {
      query: query.trim().toLowerCase(),
      recency: "month",
      model: "sonar-pro",
      domains: LEGAL_DOMAINS.length,
    };
    const cached = aiCache.get<any>("perplexity:advanced", cacheKey);
    if (cached) return cached;

    try {
      // Split all domains into chunks of 20 (Perplexity API limit)
      const allDomains = LEGAL_DOMAINS;
      const domainChunks: string[][] = [];
      for (let i = 0; i < allDomains.length; i += 20) {
        domainChunks.push(allDomains.slice(i, i + 20));
      }

      console.log(`Advanced search using ${allDomains.length} domains in ${domainChunks.length} parallel batches`);

      const systemPrompt = `You are an advanced legal research assistant specializing in Indian law. Search across authoritative Indian legal sources.

IMPORTANT: You MUST respond with a valid JSON object only, no markdown formatting, no code blocks.

Your response must be a JSON object with this exact structure:
{
  "analysis": "Detailed legal analysis of the query",
  "extractedParagraphs": [{"text": "Verbatim quote", "citation": "Full citation", "sections": [], "acts": [], "court": ""}],
  "timeline": [{"date": "YYYY-MM-DD", "event": "What happened", "source": "Source"}],
  "conflicts": [{"issue": "Description", "sources": ["Source 1"]}],
  "tags": {"sections": [], "acts": [], "courts": []}
}`;

      // Make parallel API calls for each domain chunk
      const searchPromises = domainChunks.map(async (domains, index) => {
        try {
          const data = await withRetry(() => this.fetchPerplexity({
              model: "sonar-pro",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Advanced legal research query for Indian law: ${query}` }
              ],
              max_tokens: 2048,
              temperature: 0.1,
              search_domain_filter: domains,
              return_images: false,
              search_recency_filter: "month",
              stream: false,
            }, `perplexity advanced search batch ${index + 1}`), 3, `perplexity advanced search batch ${index + 1}`);
          return {
            content: data.choices?.[0]?.message?.content || "{}",
            citations: data.citations || [],
          };
        } catch (error) {
          console.error(`Batch ${index + 1} error:`, error);
          return null;
        }
      });

      // Wait for all parallel searches
      const results = await Promise.all(searchPromises);
      const validResults = results.filter(r => r !== null);

      if (validResults.length === 0) {
        return {
          answer: "",
          sources: [],
          extractedParagraphs: [],
          timeline: [],
          conflicts: [],
          tags: { sections: [], acts: [], courts: [] },
        };
      }

      // Merge results from all batches
      let mergedAnalysis = "";
      const allSources: WebSearchResult[] = [];
      const allParagraphs: any[] = [];
      const allTimeline: any[] = [];
      const allConflicts: any[] = [];
      const allSections = new Set<string>();
      const allActs = new Set<string>();
      const allCourts = new Set<string>();
      const seenUrls = new Set<string>();

      for (const result of validResults) {
        let parsed: any = {};
        try {
          const cleanContent = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(cleanContent);
        } catch (e) {
          parsed = { analysis: result.content };
        }

        if (!mergedAnalysis && parsed.analysis) {
          mergedAnalysis = parsed.analysis;
        }

        for (const url of result.citations) {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            allSources.push({
              title: this.extractDomainName(url),
              url,
              snippet: "",
              source: this.extractSourceName(url),
            });
          }
        }

        if (Array.isArray(parsed.extractedParagraphs)) {
          for (const p of parsed.extractedParagraphs) {
            allParagraphs.push({
              text: p.text || "",
              citation: p.citation || "",
              sections: Array.isArray(p.sections) ? p.sections : [],
              acts: Array.isArray(p.acts) ? p.acts : [],
              court: p.court || "",
            });
          }
        }

        if (Array.isArray(parsed.timeline)) {
          for (const t of parsed.timeline) {
            allTimeline.push({ date: t.date || "", event: t.event || "", source: t.source || "" });
          }
        }

        if (Array.isArray(parsed.conflicts)) {
          for (const c of parsed.conflicts) {
            allConflicts.push({ issue: c.issue || "", sources: Array.isArray(c.sources) ? c.sources : [] });
          }
        }

        if (parsed.tags?.sections) parsed.tags.sections.forEach((s: string) => allSections.add(s));
        if (parsed.tags?.acts) parsed.tags.acts.forEach((a: string) => allActs.add(a));
        if (parsed.tags?.courts) parsed.tags.courts.forEach((c: string) => allCourts.add(c));
      }

      console.log(`Merged: ${allSources.length} sources, ${allParagraphs.length} paragraphs from ${validResults.length}/${domainChunks.length} batches`);

      const result = {
        answer: mergedAnalysis,
        sources: allSources,
        extractedParagraphs: allParagraphs,
        timeline: allTimeline,
        conflicts: allConflicts,
        tags: {
          sections: Array.from(allSections),
          acts: Array.from(allActs),
          courts: Array.from(allCourts),
        },
      };
      if (mergedAnalysis) aiCache.set("perplexity:advanced", cacheKey, result);
      return result;
    } catch (error) {
      console.error("Advanced search error:", error);
      return {
        answer: "",
        sources: [],
        extractedParagraphs: [],
        timeline: [],
        conflicts: [],
        tags: { sections: [], acts: [], courts: [] },
      };
    }
  }
}

export const legalWebSearch = new LegalWebSearchService();
