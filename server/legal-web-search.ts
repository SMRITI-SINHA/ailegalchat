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

export const LEGAL_DOMAINS = [
  // Legal News & Analysis
  "livelaw.in",
  "barandbench.com",
  "scconline.com",
  "lawctopus.com",
  "legalbites.in",
  "latestlaws.com",
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
  "lawstreet.co",
  "itatonline.org",
  "judis.nic.in",
  "casemine.com",
  "indiancaselaws.com",
  "manupatra.com",
  "legitquest.com",
  "lawweb.in",
  "nludelhi.ac.in",
  "nlsiu.ac.in",
  "lawcommissionofindia.nic.in",
  
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
  
  // Government & Regulatory Bodies
  "sebi.gov.in",
  "rbi.org.in",
  "mca.gov.in",
  "incometaxindia.gov.in",
  "cbic.gov.in",
  "gst.gov.in",
  "irdai.gov.in",
  "epfindia.gov.in",
  "esic.nic.in",
  "pfrda.org.in",
  "fssai.gov.in",
  "cpcb.nic.in",
  "cci.gov.in",
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
  "ibbi.gov.in",
  "moef.gov.in",
  "labour.gov.in",
  "pib.gov.in",
  "prsindia.org",
  "indiacode.nic.in",
  "legislative.gov.in",
  "egazette.nic.in",
  "doj.gov.in",
  "lawmin.gov.in",
  "wcd.nic.in",
  "socialjustice.nic.in",
  "tribal.nic.in",
  "agrimin.gov.in",
  "commerce.gov.in",
  "meity.gov.in",
  "doe.gov.in",
  "mea.gov.in",
  "mha.gov.in",
  "mod.gov.in",
  "mohua.gov.in",
  "msme.gov.in",
  "morth.nic.in",
  "petroleum.nic.in",
  "coal.gov.in",
  "mines.gov.in",
  "powermin.gov.in",
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

export class LegalWebSearchService {
  private perplexityKey: string | null;

  constructor() {
    this.perplexityKey = process.env.PERPLEXITY_API_KEY || null;
  }

  isConfigured(): boolean {
    return !!this.perplexityKey;
  }

  getDomainList(): string[] {
    return LEGAL_DOMAINS;
  }

  async searchLegal(query: string): Promise<{ answer: string; sources: WebSearchResult[] }> {
    if (!this.perplexityKey) {
      console.warn("Perplexity API key not configured, skipping web search");
      return { answer: "", sources: [] };
    }

    try {
      const legalDomains = LEGAL_DOMAINS;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: `You are a legal research assistant specializing in Indian law. Provide accurate, factual information with citations. Focus on:
- Recent legal developments and amendments
- Case law and precedents
- Regulatory updates from SEBI, RBI, MCA, CBIC
- Legal news from authoritative sources
Be precise and cite your sources.`
            },
            {
              role: "user",
              content: `Indian law query: ${query}`
            }
          ],
          max_tokens: 1024,
          temperature: 0.2,
          top_p: 0.9,
          search_domain_filter: legalDomains.slice(0, 3),
          return_images: false,
          return_related_questions: false,
          search_recency_filter: "month",
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Perplexity API error:", response.status, errorText);
        return { answer: "", sources: [] };
      }

      const data: PerplexityResponse = await response.json();
      
      const answer = data.choices?.[0]?.message?.content || "";
      const sources: WebSearchResult[] = (data.citations || []).map((url, index) => ({
        title: this.extractDomainName(url),
        url,
        snippet: "",
        source: this.extractSourceName(url),
      }));

      return { answer, sources };
    } catch (error) {
      console.error("Legal web search error:", error);
      return { answer: "", sources: [] };
    }
  }

  async searchRegulatory(query: string, regulator: "sebi" | "rbi" | "mca" | "cbic" | "general"): Promise<{ answer: string; sources: WebSearchResult[] }> {
    if (!this.perplexityKey) {
      return { answer: "", sources: [] };
    }

    const regulatorDomains: Record<string, string[]> = {
      sebi: ["sebi.gov.in", "nseindia.com", "bseindia.com"],
      rbi: ["rbi.org.in", "bankingfrontiers.com"],
      mca: ["mca.gov.in", "companiesact.in"],
      cbic: ["cbic.gov.in", "gst.gov.in", "taxguru.in"],
      general: ["livelaw.in", "barandbench.com", "scconline.com"],
    };

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
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
          search_domain_filter: regulatorDomains[regulator] || regulatorDomains.general,
          search_recency_filter: "week",
          stream: false,
        }),
      });

      if (!response.ok) {
        return { answer: "", sources: [] };
      }

      const data: PerplexityResponse = await response.json();
      
      return {
        answer: data.choices?.[0]?.message?.content || "",
        sources: (data.citations || []).map(url => ({
          title: this.extractDomainName(url),
          url,
          snippet: "",
          source: this.extractSourceName(url),
        })),
      };
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

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-large-128k-online",
          messages: [
            {
              role: "system",
              content: `You are an advanced legal research assistant specializing in Indian law with 25+ years of expertise. 

IMPORTANT: You MUST respond with a valid JSON object only, no markdown formatting, no code blocks.

Your response must be a JSON object with this exact structure:
{
  "analysis": "Detailed legal analysis of the query",
  "extractedParagraphs": [
    {
      "text": "Verbatim quote from legal source",
      "citation": "Full citation (e.g., Case Name, Year, Volume, Page)",
      "sections": ["Section numbers mentioned"],
      "acts": ["Act names mentioned"],
      "court": "Court name if applicable"
    }
  ],
  "timeline": [
    {
      "date": "YYYY-MM-DD or descriptive date",
      "event": "What happened",
      "source": "Source of this information"
    }
  ],
  "conflicts": [
    {
      "issue": "Description of conflicting interpretations",
      "sources": ["Source 1", "Source 2"]
    }
  ],
  "tags": {
    "sections": ["List of all section numbers mentioned"],
    "acts": ["List of all acts mentioned"],
    "courts": ["List of all courts mentioned"]
  }
}

Ensure all extracted paragraphs are VERBATIM quotes with proper citations. Identify chronological developments and any conflicts between judicial interpretations.`
            },
            {
              role: "user",
              content: `Advanced legal research query for Indian law: ${query}`
            }
          ],
          max_tokens: 4096,
          temperature: 0.1,
          search_domain_filter: LEGAL_DOMAINS.slice(0, 3),
          return_images: false,
          search_recency_filter: "month",
          stream: false,
        }),
      });

      if (!response.ok) {
        console.error("Perplexity advanced search error:", response.status);
        return {
          answer: "",
          sources: [],
          extractedParagraphs: [],
          timeline: [],
          conflicts: [],
          tags: { sections: [], acts: [], courts: [] },
        };
      }

      const data: PerplexityResponse = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      
      let parsed: any = {};
      try {
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleanContent);
      } catch (e) {
        parsed = { analysis: content };
      }

      const sources: WebSearchResult[] = (data.citations || []).map(url => ({
        title: this.extractDomainName(url),
        url,
        snippet: "",
        source: this.extractSourceName(url),
      }));

      return {
        answer: parsed.analysis || content,
        sources,
        extractedParagraphs: parsed.extractedParagraphs || [],
        timeline: parsed.timeline || [],
        conflicts: parsed.conflicts || [],
        tags: parsed.tags || { sections: [], acts: [], courts: [] },
      };
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
