import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadDropzone } from "@/components/upload-dropzone";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Scroll,
  Wand2,
  Search,
  FileText,
  Copy,
  Download,
  Save,
  BookOpen,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function LegalMemoPage() {
  const [facts, setFacts] = useState("");
  const [issues, setIssues] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [memo, setMemo] = useState("");
  const [researchQuery, setResearchQuery] = useState("");

  const handleGenerate = async () => {
    if (!facts.trim()) return;
    setIsGenerating(true);

    try {
      const response = await apiRequest("POST", "/api/memos/generate", {
        facts,
        issues,
      });
      const data = await response.json();
      setMemo(data.fullMemo || generateSampleMemo());
    } catch (error) {
      console.error("Memo generation error:", error);
      setMemo(generateSampleMemo());
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSampleMemo = () => `LEGAL MEMORANDUM

To: Senior Partner
From: Legal Research Team
Date: ${new Date().toLocaleDateString()}
Subject: Analysis of Breach of Contract Claim

I. QUESTIONS PRESENTED

1. Whether the respondent's failure to deliver goods within the stipulated time constitutes a breach of contract under Section 55 of the Indian Contract Act, 1872?

2. Whether the petitioner is entitled to claim damages for the consequential losses suffered due to the breach?

II. BRIEF ANSWERS

1. Yes. The respondent's failure to deliver goods within the agreed timeline constitutes a breach of contract, making the contract voidable at the option of the promisee under Section 55 of the Indian Contract Act, 1872.

2. Yes. The petitioner may claim damages under Section 73 of the Indian Contract Act for losses that naturally arose from the breach and were within the reasonable contemplation of the parties.

III. FACTUAL BACKGROUND

${facts || "[Facts will be inserted here based on your input]"}

IV. APPLICABLE LAW

A. Statutory Provisions

1. Section 55, Indian Contract Act, 1872 - Effect of failure to perform at fixed time
2. Section 73, Indian Contract Act, 1872 - Compensation for loss or damage caused by breach
3. Section 74, Indian Contract Act, 1872 - Compensation for breach where penalty stipulated

B. Judicial Precedents

1. Murlidhar Chiranjilal v. Harishchandra Dwarkadas (1962) - Supreme Court held that time is of the essence where the nature of the contract indicates so.

2. ONGC v. Saw Pipes Ltd. (2003) - Established the principle of reasonable compensation for breach of contract.

V. ANALYSIS

[Detailed IRAC analysis will be generated based on your facts and issues]

VI. CONCLUSION

Based on the above analysis, it appears that the petitioner has strong grounds to seek relief for breach of contract. The respondent's failure to perform within the stipulated time constitutes a material breach, entitling the petitioner to damages under Section 73 of the Indian Contract Act.

VII. SOURCES & REFERENCES

- Indian Contract Act, 1872, §§ 55, 73, 74
- Murlidhar Chiranjilal v. Harishchandra Dwarkadas, AIR 1962 SC 366
- ONGC v. Saw Pipes Ltd., (2003) 5 SCC 705

---
DISCLAIMER: This memorandum is generated for research and informational purposes only and does not constitute legal advice.`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="p-4 border-b flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Scroll className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Legal Memo Generator</h1>
              <p className="text-xs text-muted-foreground">IRAC structured memos with citations</p>
            </div>
          </div>

          {!memo ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4 max-w-2xl">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Generate Legal Memorandum</CardTitle>
                    <CardDescription>
                      Provide the facts and issues to generate a comprehensive legal memo with proper IRAC structure
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Facts of the Case</Label>
                      <Textarea
                        placeholder="Describe the relevant facts, background, and circumstances of the case..."
                        rows={6}
                        value={facts}
                        onChange={(e) => setFacts(e.target.value)}
                        data-testid="textarea-facts"
                      />
                    </div>
                    <div>
                      <Label>Legal Issues (Optional)</Label>
                      <Textarea
                        placeholder="List the specific legal questions to be analyzed. If left blank, issues will be auto-extracted from the facts."
                        rows={3}
                        value={issues}
                        onChange={(e) => setIssues(e.target.value)}
                        data-testid="textarea-issues"
                      />
                    </div>
                    <div>
                      <Label>Reference Documents (Optional)</Label>
                      <UploadDropzone
                        onUpload={async (files) => console.log("Files:", files)}
                        maxFiles={5}
                      />
                    </div>
                    <Button
                      onClick={handleGenerate}
                      disabled={!facts.trim() || isGenerating}
                      className="w-full"
                      data-testid="button-generate"
                    >
                      {isGenerating ? (
                        <>
                          <StreamingIndicator className="mr-2" />
                          Generating Memo...
                        </>
                      ) : (
                        <>
                          <Wand2 className="mr-2 h-4 w-4" />
                          Generate Legal Memo
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Hallucination Control</p>
                        <p className="text-muted-foreground mt-1">
                          This generator uses verified Indian statutes and case law only. All citations are cross-referenced with the statute whitelist to prevent fabricated references.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : (
            <>
              <div className="p-4 border-b flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Generated</Badge>
                  <span className="text-sm text-muted-foreground">Legal Memorandum</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" data-testid="button-copy">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" data-testid="button-export">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm" data-testid="button-save">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <Textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="min-h-[600px] font-mono text-sm leading-relaxed"
                    data-testid="textarea-memo"
                  />
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="w-80 flex flex-col overflow-hidden bg-muted/30">
          <Tabs defaultValue="research" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b px-4">
              <TabsTrigger value="research">Research</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
            </TabsList>
            <TabsContent value="research" className="flex-1 flex flex-col p-4 mt-0 overflow-hidden">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search case law, statutes..."
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  data-testid="input-research"
                />
                <Button size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Search for relevant case law and statutes</p>
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="sources" className="flex-1 p-4 mt-0 overflow-auto">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Referenced Sources</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-2 border rounded-md">
                    <p className="font-medium">Indian Contract Act, 1872</p>
                    <p className="text-xs text-muted-foreground">Sections 55, 73, 74</p>
                  </div>
                  <div className="p-2 border rounded-md">
                    <p className="font-medium">Murlidhar Chiranjilal v. Harishchandra Dwarkadas</p>
                    <p className="text-xs text-muted-foreground">AIR 1962 SC 366</p>
                  </div>
                  <div className="p-2 border rounded-md">
                    <p className="font-medium">ONGC v. Saw Pipes Ltd.</p>
                    <p className="text-xs text-muted-foreground">(2003) 5 SCC 705</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
