import fs from "fs";
import path from "path";

interface DocumentCategory {
  name: string;
  normalizedName: string;
  count: number;
  sampleFiles: string[];
  description: string;
}

interface TrainingDataIndex {
  totalDocuments: number;
  categories: DocumentCategory[];
  lastIndexed: string;
}

// Map folder names to clean category names and descriptions
const CATEGORY_MAPPINGS: Record<string, { name: string; description: string }> = {
  "additional written statement": { 
    name: "Additional Written Statement", 
    description: "Supplementary written statements filed after the initial pleadings to introduce new facts or arguments" 
  },
  "adjournment petition": { 
    name: "Adjournment Petition", 
    description: "Applications seeking postponement of court hearings with valid grounds" 
  },
  "commercial court": { 
    name: "Commercial Court Filings", 
    description: "Plaints, written statements, and applications for commercial disputes under Commercial Courts Act" 
  },
  "compromise petition": { 
    name: "Compromise Petition", 
    description: "Settlement agreements and compromise applications for court approval" 
  },
  "consumer cases": { 
    name: "Consumer Cases", 
    description: "Consumer complaints and responses under Consumer Protection Act" 
  },
  "counter statement": { 
    name: "Counter Statement", 
    description: "Defensive pleadings filed in response to petitions and applications" 
  },
  "deeds and agreements": { 
    name: "Deeds and Agreements", 
    description: "Sale deeds, lease deeds, partnership deeds, MOUs, and commercial agreements" 
  },
  "drt": { 
    name: "DRT Proceedings", 
    description: "Debt Recovery Tribunal applications and proceedings under RDDBFI Act" 
  },
  "execution petition": { 
    name: "Execution Petition", 
    description: "Applications for execution of decrees and orders under CPC Order XXI" 
  },
  "family case": { 
    name: "Family Court Matters", 
    description: "Matrimonial petitions, custody matters, maintenance applications under Hindu Marriage Act, Special Marriage Act" 
  },
  "hmgop": { 
    name: "Hindu Minority & Guardianship", 
    description: "Applications under Hindu Minority and Guardianship Act for minor's property" 
  },
  "legal notice": { 
    name: "Legal Notice", 
    description: "Pre-litigation notices for civil matters, cheque dishonour, breach of contract" 
  },
  "legal opinion": { 
    name: "Legal Opinion", 
    description: "Professional legal opinions on matters of law with analysis and recommendations" 
  },
  "mcop": { 
    name: "Motor Accident Claims", 
    description: "Motor Accident Claims Tribunal petitions under Motor Vehicles Act" 
  },
  "mediation": { 
    name: "Mediation Applications", 
    description: "Pre-institution and court-referred mediation applications under Section 89 CPC" 
  },
  "memo": { 
    name: "Court Memos", 
    description: "Memoranda filed in court for procedural matters and document submissions" 
  },
  "notice of hearing": { 
    name: "Notice of Hearing", 
    description: "Notices issued for scheduling court hearings and proceedings" 
  },
  "vakalath": { 
    name: "Vakalath/Vakalatnama", 
    description: "Power of attorney documents authorizing advocates to represent clients" 
  },
  "will": { 
    name: "Wills and Testaments", 
    description: "Last will and testament documents with proper attestation requirements" 
  },
  "writ": { 
    name: "Writ Petitions", 
    description: "Constitutional writ petitions under Article 226/227 or Article 32" 
  },
  "written argument": { 
    name: "Written Arguments", 
    description: "Detailed legal arguments submitted after evidence closure in trials" 
  },
  "written statement": { 
    name: "Written Statement", 
    description: "Defendant's primary pleading in response to plaintiff's plaint under CPC Order VIII" 
  },
};

class TrainingDataLoader {
  private trainingDataPath: string;
  private indexCache: TrainingDataIndex | null = null;
  private lastIndexTime: number = 0;
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

  constructor() {
    this.trainingDataPath = path.join(process.cwd(), "training_data", "documents");
  }

  private normalizeCategory(folderName: string): string {
    return folderName
      .toLowerCase()
      .replace(/-\d{8}t\d{6}z-\d+-\d+$/i, "") // Remove timestamp suffixes
      .replace(/[_-]+/g, " ")
      .trim();
  }

  async indexDocuments(): Promise<TrainingDataIndex> {
    // Check cache
    if (this.indexCache && Date.now() - this.lastIndexTime < this.CACHE_TTL) {
      return this.indexCache;
    }

    const categories: Map<string, DocumentCategory> = new Map();
    let totalDocuments = 0;

    try {
      if (!fs.existsSync(this.trainingDataPath)) {
        console.warn("[TRAINING] Training data path does not exist");
        return { totalDocuments: 0, categories: [], lastIndexed: new Date().toISOString() };
      }

      const folders = fs.readdirSync(this.trainingDataPath, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const folder of folders) {
        const normalizedName = this.normalizeCategory(folder.name);
        const folderPath = path.join(this.trainingDataPath, folder.name);
        
        // Count documents recursively
        const files = this.getFilesRecursive(folderPath, [".docx", ".pdf", ".doc"]);
        
        if (files.length === 0) continue;

        totalDocuments += files.length;

        const existing = categories.get(normalizedName);
        if (existing) {
          existing.count += files.length;
          existing.sampleFiles.push(...files.slice(0, 3));
        } else {
          const mapping = CATEGORY_MAPPINGS[normalizedName] || {
            name: this.toTitleCase(normalizedName),
            description: `Legal documents related to ${normalizedName}`
          };
          
          categories.set(normalizedName, {
            name: mapping.name,
            normalizedName,
            count: files.length,
            sampleFiles: files.slice(0, 5),
            description: mapping.description,
          });
        }
      }

      const index: TrainingDataIndex = {
        totalDocuments,
        categories: Array.from(categories.values()).sort((a, b) => b.count - a.count),
        lastIndexed: new Date().toISOString(),
      };

      this.indexCache = index;
      this.lastIndexTime = Date.now();

      return index;
    } catch (error) {
      console.error("Error indexing training data:", error);
      return { totalDocuments: 0, categories: [], lastIndexed: new Date().toISOString() };
    }
  }

  private getFilesRecursive(dirPath: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          files.push(...this.getFilesRecursive(fullPath, extensions));
        } else if (item.isFile()) {
          // Skip temp files starting with ~
          if (item.name.startsWith("~")) continue;
          
          const ext = path.extname(item.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error("Error reading directory:", dirPath, error);
    }
    
    return files;
  }

  private toTitleCase(str: string): string {
    return str.split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async getTrainingContext(): Promise<string> {
    const index = await this.indexDocuments();
    
    if (index.totalDocuments === 0) {
      return "";
    }

    // Limit training context to ~15,000 characters (~4K tokens) to leave room for other prompt components
    const MAX_TRAINING_CONTEXT_CHARS = 15000;

    let context = `\n=== CHAKSHI LEGAL TRAINING DATA ===
You have been trained on ${index.totalDocuments}+ authentic Indian legal documents across ${index.categories.length} categories:

`;

    for (const category of index.categories) {
      context += `• ${category.name} (${category.count} documents): ${category.description}\n`;
    }

    context += `
DRAFTING STANDARDS FROM TRAINING DATA:
Based on analysis of 2000+ legal documents, follow these Indian legal drafting conventions:

1. STRUCTURE & FORMATTING:
   - Use proper cause title format with court name, case type, case number
   - Include proper party descriptions (Plaintiff/Petitioner/Appellant vs Defendant/Respondent)
   - Number paragraphs sequentially; use sub-numbering for sub-points (1.1, 1.2, etc.)
   - Include verification/affidavit at the end where required
   - Use formal legal language appropriate to Indian courts

2. CITATION FORMAT (Indian Standard):
   - Case Law: Party Name v. Party Name, (Year) Volume Reporter Page (e.g., AIR 2020 SC 1234)
   - Statutes: Full Act name with year, Section number (e.g., Section 138 of Negotiable Instruments Act, 1881)
   - Rules: Rule number, name of rules (e.g., Rule 1, Order XXI of CPC)

3. PRAYER CLAUSE:
   - Always include specific reliefs sought
   - Use "In the circumstances, it is most humbly prayed that this Hon'ble Court may be pleased to..."
   - List each relief as separate numbered points

4. DOCUMENT-SPECIFIC CONVENTIONS:
`;

    // Add specific conventions for top categories (limit to prevent context overflow)
    for (const category of index.categories.slice(0, 8)) {
      if (context.length >= MAX_TRAINING_CONTEXT_CHARS * 0.9) break;
      const conventions = this.getCategoryConventions(category.normalizedName);
      if (conventions) {
        context += `\n   ${category.name}:\n${conventions}\n`;
      }
    }

    // Ensure we don't exceed the limit
    if (context.length > MAX_TRAINING_CONTEXT_CHARS) {
      context = context.substring(0, MAX_TRAINING_CONTEXT_CHARS);
    }

    return context;
  }

  private getCategoryConventions(category: string): string {
    const conventions: Record<string, string> = {
      "written statement": `   - File within 30/90 days as per CPC Order VIII Rule 1
   - Admit/deny each paragraph of plaint specifically
   - Raise preliminary objections first (limitation, jurisdiction, maintainability)
   - Include counter-claim if applicable under Order VIII Rule 6A`,
      
      "legal notice": `   - Include sender and recipient details with full addresses
   - State facts chronologically with dates
   - Specify the legal provisions violated
   - Give reasonable time (usually 15-30 days) for reply/compliance
   - End with consequences of non-compliance`,
      
      "writ": `   - State fundamental rights violated (Article 14, 19, 21, etc.)
   - Include urgent interim relief prayer if needed
   - Attach all supporting documents as Annexures
   - File affidavit of the petitioner`,
      
      "commercial court": `   - Verify commercial value exceeds specified threshold
   - Include Statement of Truth and Statement of Address
   - Attach pre-institution mediation certificate or exemption grounds
   - Follow strict timelines under Commercial Courts Act`,
      
      "execution petition": `   - Cite decree details: date, case number, court
   - Specify amount due with interest calculation
   - List properties/assets for attachment
   - Include certified copy of decree`,
      
      "family case": `   - Follow procedures under specific personal law
   - Include marriage certificate for matrimonial matters
   - Attach income/property documents for maintenance
   - Consider child's welfare in custody matters`,
    };

    return conventions[category] || "";
  }

  async getDraftingGuidelines(documentType: string): Promise<string> {
    const index = await this.indexDocuments();
    const normalizedType = documentType.toLowerCase();
    
    // Find matching category
    const category = index.categories.find(c => 
      c.normalizedName.includes(normalizedType) || 
      c.name.toLowerCase().includes(normalizedType)
    );

    if (!category) {
      return this.getTrainingContext();
    }

    return `Based on ${category.count} ${category.name} documents in Chakshi's training data:

${category.description}

${this.getCategoryConventions(category.normalizedName) || "Follow standard Indian legal drafting conventions."}`;
  }

  getDocumentTypeCategories(): string[] {
    const categories = [
      "Plaint",
      "Written Statement", 
      "Additional Written Statement",
      "Counter Statement",
      "Legal Notice",
      "Legal Opinion",
      "Writ Petition",
      "Execution Petition",
      "Compromise Petition",
      "Adjournment Petition",
      "Affidavit",
      "Vakalath",
      "Written Arguments",
      "Commercial Court Filing",
      "Consumer Complaint",
      "Family Court Petition",
      "Motor Accident Claim",
      "Mediation Application",
      "DRT Application",
      "Deeds and Agreements",
      "Will",
      "Memo"
    ];
    return categories;
  }
}

export const trainingDataLoader = new TrainingDataLoader();
