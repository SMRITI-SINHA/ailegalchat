import type { IndianKanoonResult, LegalProvision } from "@shared/schema";

const INDIAN_KANOON_API_BASE = "https://api.indiankanoon.org";

interface IKSearchResponse {
  docs?: Array<{
    tid: string;
    title: string;
    headline?: string;
    docsize?: number;
  }>;
  numfound?: number;
}

interface IKDocResponse {
  doc?: string;
  title?: string;
  citeList?: Array<{ tid: string; title: string }>;
  citedbyList?: Array<{ tid: string; title: string }>;
}

export class IndianKanoonService {
  private token: string | null;

  constructor() {
    this.token = process.env.INDIAN_KANOON_API_TOKEN || null;
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  async search(query: string, pageNum: number = 0): Promise<IndianKanoonResult[]> {
    if (!this.token) {
      console.warn("Indian Kanoon API token not configured");
      return this.getMockResults(query);
    }

    try {
      const response = await fetch(`${INDIAN_KANOON_API_BASE}/search/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Token ${this.token}`,
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          formInput: query,
          pagenum: String(pageNum),
        }),
      });

      if (!response.ok) {
        console.error("Indian Kanoon search failed:", response.status);
        return this.getMockResults(query);
      }

      const data: IKSearchResponse = await response.json();
      
      return (data.docs || []).map((doc) => ({
        docId: doc.tid,
        title: doc.title,
        headline: doc.headline,
        docSize: doc.docsize,
      }));
    } catch (error) {
      console.error("Indian Kanoon search error:", error);
      return this.getMockResults(query);
    }
  }

  async getDocument(docId: string): Promise<{ content: string; title: string; citations: string[] } | null> {
    if (!this.token) {
      return this.getMockDocument(docId);
    }

    try {
      const response = await fetch(`${INDIAN_KANOON_API_BASE}/doc/${docId}/`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.token}`,
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          maxcites: "50",
          maxcitedby: "50",
        }),
      });

      if (!response.ok) {
        return this.getMockDocument(docId);
      }

      const data: IKDocResponse = await response.json();
      
      const citations = [
        ...(data.citeList || []).map((c) => c.title),
        ...(data.citedbyList || []).map((c) => c.title),
      ];

      return {
        content: data.doc || "",
        title: data.title || "Untitled Document",
        citations,
      };
    } catch (error) {
      console.error("Indian Kanoon doc fetch error:", error);
      return this.getMockDocument(docId);
    }
  }

  async searchStatutes(query: string): Promise<LegalProvision[]> {
    const results = await this.search(`${query} act section`);
    
    return results.slice(0, 5).map((r, i) => ({
      id: `statute-${i}`,
      source: this.extractActName(r.title),
      section: this.extractSection(r.title),
      text: r.headline || r.title,
      isNewLaw: this.isNewLaw(r.title),
    }));
  }

  async searchCaseLaw(query: string): Promise<IndianKanoonResult[]> {
    return this.search(`${query} judgment`);
  }

  private getMockResults(query: string): IndianKanoonResult[] {
    return [
      {
        docId: "mock-1",
        title: `K.S. Puttaswamy vs Union of India - Privacy Judgment`,
        headline: `The right to privacy is a fundamental right under Article 21...`,
        docSize: 125000,
        court: "Supreme Court of India",
        date: "2017-08-24",
      },
      {
        docId: "mock-2",
        title: `Vishaka vs State of Rajasthan - Sexual Harassment Guidelines`,
        headline: `Guidelines to prevent sexual harassment at workplace...`,
        docSize: 45000,
        court: "Supreme Court of India",
        date: "1997-08-13",
      },
      {
        docId: "mock-3",
        title: `Kesavananda Bharati vs State of Kerala - Basic Structure Doctrine`,
        headline: `The basic structure of the Constitution cannot be amended...`,
        docSize: 250000,
        court: "Supreme Court of India",
        date: "1973-04-24",
      },
    ];
  }

  private getMockDocument(docId: string): { content: string; title: string; citations: string[] } {
    return {
      content: `This is a sample legal document from Indian Kanoon (Document ID: ${docId}). 
      
The judgment discusses important legal principles relevant to the matter at hand. 
The Hon'ble Court held that constitutional rights must be interpreted in light of 
evolving societal values while maintaining the basic structure of the Constitution.

HELD: The petition is allowed. The impugned order is set aside.`,
      title: "Sample Legal Document",
      citations: [
        "Constitution of India, Article 21",
        "Maneka Gandhi vs Union of India (1978) 1 SCC 248",
        "A.K. Gopalan vs State of Madras AIR 1950 SC 27",
      ],
    };
  }

  private extractActName(title: string): string {
    const actMatch = title.match(/(\w+\s+)*Act,?\s*\d{4}/i);
    return actMatch ? actMatch[0] : "Indian Law";
  }

  private extractSection(title: string): string {
    const sectionMatch = title.match(/Section\s+\d+[A-Za-z]?/i);
    return sectionMatch ? sectionMatch[0] : "";
  }

  private isNewLaw(title: string): boolean {
    const yearMatch = title.match(/\d{4}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      return year >= 2020;
    }
    return false;
  }
}

export const indianKanoon = new IndianKanoonService();
