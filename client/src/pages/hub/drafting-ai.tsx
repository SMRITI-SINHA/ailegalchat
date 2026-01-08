import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ModelBadge } from "@/components/model-badge";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Upload,
  FileEdit,
  Send,
  Wand2,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Scale,
  Save,
  Copy,
  Download,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Draft, IndianLanguage } from "@shared/schema";
import { indianLanguages } from "@shared/schema";

type StartOption = "upload_reference" | "type_facts" | "upload_draft" | null;

export default function AIDraftingPage() {
  const [startOption, setStartOption] = useState<StartOption>(null);
  const [useFirmStyle, setUseFirmStyle] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(true);
  const [draftContent, setDraftContent] = useState("");
  const [researchQuery, setResearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [riskItems, setRiskItems] = useState<Array<{ id: string; text: string; severity: string; suggestion: string }>>([]);
  const [grammarErrors, setGrammarErrors] = useState<Array<{ id: string; text: string; correction: string }>>([]);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [formData, setFormData] = useState({
    title: "",
    facts: "",
    parties: "",
    jurisdiction: "Delhi High Court",
    documentType: "petition",
  });

  const handleStartOption = (option: StartOption) => {
    setStartOption(option);
    setShowStartDialog(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/drafts/generate", {
        type: formData.documentType,
        title: formData.title || `${formData.documentType} - Draft`,
        facts: formData.facts,
        parties: formData.parties,
        jurisdiction: formData.jurisdiction,
        language,
        useFirmStyle,
      });
      const draft = await response.json();
      setDraftContent(draft.content || "");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    } catch (error) {
      console.error("Draft generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReviewDraft = async () => {
    setRiskItems([
      { id: "1", text: "Clause 5.2 may expose liability", severity: "high", suggestion: "Add limitation of liability clause" },
      { id: "2", text: "Jurisdiction clause is vague", severity: "medium", suggestion: "Specify exact court jurisdiction" },
    ]);
    setGrammarErrors([
      { id: "1", text: "recieved", correction: "received" },
      { id: "2", text: "occured", correction: "occurred" },
    ]);
  };

  const handleResearch = async () => {
    try {
      const response = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: researchQuery }),
      });
    } catch (error) {
      console.error("Research error:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Generate Arguments and Counter-Arguments by
            </DialogTitle>
            <DialogDescription>
              Choose how you want to start drafting
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Card
              className="hover-elevate cursor-pointer"
              onClick={() => handleStartOption("upload_reference")}
              data-testid="card-upload-reference"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="p-3 rounded-md bg-muted">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Uploading reference documents</h3>
                  <p className="text-sm text-muted-foreground">Upload existing documents to use as reference for your draft</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="hover-elevate cursor-pointer"
              onClick={() => handleStartOption("type_facts")}
              data-testid="card-type-facts"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="p-3 rounded-md bg-muted">
                  <FileEdit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Typing facts of the matter</h3>
                  <p className="text-sm text-muted-foreground">Start fresh by providing the facts and details of your case</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="hover-elevate cursor-pointer"
              onClick={() => handleStartOption("upload_draft")}
              data-testid="card-upload-draft"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="p-3 rounded-md bg-muted">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Upload your own draft</h3>
                  <p className="text-sm text-muted-foreground">Edit your existing draft with AI assistance</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="font-semibold">AI Legal Drafting</h1>
              <Badge variant="outline">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Powered
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="firm-style"
                  checked={useFirmStyle}
                  onCheckedChange={setUseFirmStyle}
                  data-testid="switch-firm-style"
                />
                <Label htmlFor="firm-style" className="text-sm">Use trained firm style</Label>
              </div>
              <Select value={language} onValueChange={(v) => setLanguage(v as IndianLanguage)}>
                <SelectTrigger className="w-32" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {indianLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!startOption ? (
            <div className="flex-1 flex items-center justify-center">
              <Button onClick={() => setShowStartDialog(true)} data-testid="button-start-drafting">
                <Wand2 className="mr-2 h-4 w-4" />
                Start Drafting
              </Button>
            </div>
          ) : startOption === "type_facts" ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileEdit className="h-4 w-4" />
                      Please type the facts and details of the matter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Document Type</Label>
                      <Select value={formData.documentType} onValueChange={(v) => setFormData((p) => ({ ...p, documentType: v }))}>
                        <SelectTrigger data-testid="select-doc-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="petition">Petition</SelectItem>
                          <SelectItem value="written_statement">Written Statement</SelectItem>
                          <SelectItem value="notice">Legal Notice</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="affidavit">Affidavit</SelectItem>
                          <SelectItem value="application">Application</SelectItem>
                          <SelectItem value="reply">Reply/Rejoinder</SelectItem>
                          <SelectItem value="brief">Legal Brief</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        placeholder="e.g., Petition for..."
                        value={formData.title}
                        onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                        data-testid="input-title"
                      />
                    </div>
                    <div>
                      <Label>Parties</Label>
                      <Input
                        placeholder="e.g., ABC Pvt Ltd vs XYZ Corp"
                        value={formData.parties}
                        onChange={(e) => setFormData((p) => ({ ...p, parties: e.target.value }))}
                        data-testid="input-parties"
                      />
                    </div>
                    <div>
                      <Label>Jurisdiction</Label>
                      <Select value={formData.jurisdiction} onValueChange={(v) => setFormData((p) => ({ ...p, jurisdiction: v }))}>
                        <SelectTrigger data-testid="select-jurisdiction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Supreme Court of India">Supreme Court of India</SelectItem>
                          <SelectItem value="Delhi High Court">Delhi High Court</SelectItem>
                          <SelectItem value="Bombay High Court">Bombay High Court</SelectItem>
                          <SelectItem value="Madras High Court">Madras High Court</SelectItem>
                          <SelectItem value="Calcutta High Court">Calcutta High Court</SelectItem>
                          <SelectItem value="District Court">District Court</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Facts of the Case</Label>
                      <Textarea
                        placeholder="e.g., My client is charged under section 7 of the prevention of corruption act but he was not even authorised to carry on the act for which he purportedly..."
                        rows={8}
                        value={formData.facts}
                        onChange={(e) => setFormData((p) => ({ ...p, facts: e.target.value }))}
                        className="font-mono text-sm"
                        data-testid="textarea-facts"
                      />
                      <p className="text-xs text-muted-foreground mt-2">You can ask follow-up questions later on.</p>
                    </div>
                    <Button onClick={handleGenerate} disabled={!formData.facts || isGenerating} className="w-full" data-testid="button-generate">
                      {isGenerating ? <StreamingIndicator className="mr-2" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      {isGenerating ? "Generating..." : "Generate Draft"}
                    </Button>
                  </CardContent>
                </Card>

                {draftContent && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <CardTitle className="text-base">Generated Draft</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleReviewDraft} data-testid="button-review">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Review Draft
                        </Button>
                        <Button variant="outline" size="sm">
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                        <Button size="sm" data-testid="button-save">
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        rows={20}
                        className="font-mono text-sm leading-relaxed"
                        data-testid="textarea-draft"
                      />
                    </CardContent>
                  </Card>
                )}

                {(riskItems.length > 0 || grammarErrors.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Review Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {grammarErrors.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">Grammar Errors ({grammarErrors.length})</h4>
                            <Button size="sm" variant="outline" data-testid="button-fix-grammar">
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Correct All Errors
                            </Button>
                          </div>
                          {grammarErrors.map((e) => (
                            <div key={e.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded mb-1">
                              <span className="line-through text-destructive">{e.text}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-green-600 dark:text-green-400">{e.correction}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {riskItems.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">Risk Analysis ({riskItems.length})</h4>
                            <Button size="sm" variant="outline" data-testid="button-fix-risks">
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Reduce All Risks
                            </Button>
                          </div>
                          {riskItems.map((r) => (
                            <div key={r.id} className="p-3 border rounded-md mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge>
                                <span className="text-sm font-medium">{r.text}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{r.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          ) : startOption === "upload_reference" ? (
            <div className="flex-1 p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload Reference Documents</CardTitle>
                  <CardDescription>Upload documents to use as reference for your draft</CardDescription>
                </CardHeader>
                <CardContent>
                  <UploadDropzone
                    onUpload={async (files) => console.log("Files:", files)}
                    maxFiles={10}
                  />
                  <Button className="w-full mt-4" onClick={() => setStartOption("type_facts")}>
                    Continue to Draft
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex-1 p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload Your Draft</CardTitle>
                  <CardDescription>Upload your existing draft to edit with AI assistance</CardDescription>
                </CardHeader>
                <CardContent>
                  <UploadDropzone
                    onUpload={async (files) => console.log("Files:", files)}
                    maxFiles={1}
                  />
                  <Button className="w-full mt-4">
                    Open in Editor
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="w-80 flex flex-col overflow-hidden bg-muted/30">
          <Tabs defaultValue="research" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b px-4">
              <TabsTrigger value="research">AI Legal Research</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="research" className="flex-1 flex flex-col p-4 mt-0 overflow-hidden">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search legal provisions..."
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  data-testid="input-research"
                />
                <Button size="icon" onClick={handleResearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Sources found:
                  </div>
                  <div className="space-y-1 text-xs">
                    <a href="#" className="text-primary hover:underline block">[0] https://devgan.in/bns/section/103/</a>
                    <a href="#" className="text-primary hover:underline block">[1] https://devgan.in/bns/section/100/</a>
                    <a href="#" className="text-primary hover:underline block">[2] https://iitrem.in/bak/clause-101-murder.php</a>
                  </div>

                  <div className="pt-4">
                    <div className="flex gap-2 mb-3">
                      <Button variant="outline" size="sm" className="text-xs">New Laws</Button>
                      <Button variant="ghost" size="sm" className="text-xs">Old Laws</Button>
                    </div>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-md bg-background">
                        <h4 className="font-medium text-sm">Section 103(1) Bharatiya Nyaya Sanhita (BNS)</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine...
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button variant="ghost" size="sm" className="text-xs h-7">Add to Notes</Button>
                          <Button variant="ghost" size="sm" className="text-xs h-7">Add to Document</Button>
                        </div>
                      </div>
                      <div className="p-3 border rounded-md bg-background">
                        <h4 className="font-medium text-sm">Section 103(2) Bharatiya Nyaya Sanhita (BNS)</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          If murder is committed by a group of five or more people, especially when motivated by discrimination...
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button variant="ghost" size="sm" className="text-xs h-7">Add to Notes</Button>
                          <Button variant="ghost" size="sm" className="text-xs h-7">Add to Document</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="notes" className="flex-1 p-4 mt-0">
              <Textarea
                placeholder="Your research notes..."
                className="h-full resize-none"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
