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

export class LegalWebSearchService {
  private perplexityKey: string | null;

  constructor() {
    this.perplexityKey = process.env.PERPLEXITY_API_KEY || null;
  }

  isConfigured(): boolean {
    return !!this.perplexityKey;
  }

  async searchLegal(query: string): Promise<{ answer: string; sources: WebSearchResult[] }> {
    if (!this.perplexityKey) {
      console.warn("Perplexity API key not configured, skipping web search");
      return { answer: "", sources: [] };
    }

    try {
      const legalDomains = [
        "livelaw.in",
        "barandbench.com",
        "indiankanoon.org",
        "scconline.com",
        "lawctopus.com",
        "legalbites.in",
        "latestlaws.com",
        "advocatekhoj.com",
        "vakilno1.com",
        "sebi.gov.in",
        "rbi.org.in",
        "mca.gov.in",
        "incometaxindia.gov.in",
        "cbic.gov.in",
        "main.sci.gov.in",
        "delhihighcourt.nic.in",
        "bombayhighcourt.nic.in"
      ];

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
    };
    return sourceMap[domain] || domain;
  }
}

export const legalWebSearch = new LegalWebSearchService();
