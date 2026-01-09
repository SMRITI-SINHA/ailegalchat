import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Scroll,
  Wand2,
  AlertTriangle,
  ArrowLeft,
  Languages,
  Sparkles,
  Plus,
  Calendar,
  Edit,
  Trash2,
  FileText,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IndianLanguage, Draft } from "@shared/schema";
import { indianLanguages } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type ViewMode = "list" | "editor";

export default function LegalMemoPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [facts, setFacts] = useState("");
  const [issues, setIssues] = useState("");
  const [memoTitle, setMemoTitle] = useState("Legal Memorandum");
  const [jurisdiction, setJurisdiction] = useState("");
  const [parties, setParties] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [memoContent, setMemoContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<IndianLanguage>("English");

  const { data: allDrafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const memoDrafts = allDrafts.filter((d) => d.type === "memo");

  const deleteDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/drafts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/drafts/${data.id}`, {
        title: data.title,
        content: data.content,
      });
      return response.json() as Promise<Draft>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleSave = async () => {
    if (!draftId) return;
    setIsSaving(true);
    try {
      await updateDraftMutation.mutateAsync({
        id: draftId,
        title: memoTitle,
        content: memoContent,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!facts.trim()) return;
    setIsGenerating(true);

    try {
      const response = await apiRequest("POST", "/api/memos/generate", {
        facts,
        issues,
        language,
        jurisdiction,
        parties,
        title: memoTitle,
      });
      const data = await response.json();
      const generatedMemo = data.fullMemo || generateLocalizedMemo();
      
      const draftResponse = await apiRequest("POST", "/api/drafts", {
        title: memoTitle,
        type: "memo",
        content: generatedMemo,
        status: "draft",
        language,
      });
      const draft = await draftResponse.json();
      
      setDraftId(draft.id);
      setMemoContent(generatedMemo);
      setShowGenerateDialog(false);
      setViewMode("editor");
      setShowResearchSidebar(true);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    } catch (error) {
      console.error("Memo generation error:", error);
      const fallbackMemo = generateLocalizedMemo();
      const draftResponse = await apiRequest("POST", "/api/drafts", {
        title: memoTitle,
        type: "memo",
        content: fallbackMemo,
        status: "draft",
        language,
      });
      const draft = await draftResponse.json();
      setDraftId(draft.id);
      setMemoContent(fallbackMemo);
      setShowGenerateDialog(false);
      setViewMode("editor");
      setShowResearchSidebar(true);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLocalizedMemo = () => {
    const date = new Date().toLocaleDateString();
    
    if (language === "Hindi") {
      return `कानूनी ज्ञापन\n\nप्रति: वरिष्ठ भागीदार\nप्रेषक: कानूनी अनुसंधान दल\nदिनांक: ${date}\nविषय: ${memoTitle}\n\nI. प्रस्तुत प्रश्न\n\n${issues || "[तथ्यों के आधार पर मुद्दे यहाँ निर्धारित किए जाएंगे]"}\n\nII. संक्षिप्त उत्तर\n\n[विस्तृत विश्लेषण के आधार पर उत्तर यहाँ दिए जाएंगे]\n\nIII. तथ्यात्मक पृष्ठभूमि\n\n${facts}\n\nIV. लागू कानून\n\nक. वैधानिक प्रावधान\n[प्रासंगिक धाराएं यहाँ सूचीबद्ध की जाएंगी]\n\nख. न्यायिक मिसालें\n[प्रासंगिक न्यायालयीन निर्णय यहाँ उद्धृत किए जाएंगे]\n\nV. विश्लेषण\n\n[IRAC पद्धति के अनुसार विस्तृत विश्लेषण]\n\nVI. निष्कर्ष\n\n[अंतिम सिफारिशें और निष्कर्ष]\n\n---\nअस्वीकरण: यह ज्ञापन केवल अनुसंधान और सूचनात्मक उद्देश्यों के लिए तैयार किया गया है।`;
    }
    
    return `LEGAL MEMORANDUM\n[Language: ${language}]\n\nTo: Senior Partner\nFrom: Legal Research Team\nDate: ${date}\nSubject: ${memoTitle}\n\nI. QUESTIONS PRESENTED\n\n${issues || "[Issues will be determined based on the facts provided]"}\n\nII. BRIEF ANSWERS\n\n[Answers will be provided based on detailed analysis]\n\nIII. FACTUAL BACKGROUND\n\n${facts}\n\nIV. APPLICABLE LAW\n\nA. Statutory Provisions\n[Relevant sections will be listed here]\n\nB. Judicial Precedents\n[Relevant case law will be cited here]\n\nV. ANALYSIS\n\n[Detailed IRAC analysis will be provided]\n\nVI. CONCLUSION\n\n[Final recommendations and conclusions]\n\n---\nDISCLAIMER: This memorandum is for research and informational purposes only.`;
  };

  const handleOpenDraft = (draft: Draft) => {
    setDraftId(draft.id);
    setMemoTitle(draft.title);
    setMemoContent(draft.content || "");
    setViewMode("editor");
    setShowResearchSidebar(true);
  };

  const handleAddToDocument = (text: string) => {
    setMemoContent((prev) => prev + "\n\n" + text);
  };

  const handleOpenMemoFromEditor = (draft: Draft) => {
    setDraftId(draft.id);
    setMemoTitle(draft.title);
    setMemoContent(draft.content || "");
    setCurrentLanguage((draft.language as IndianLanguage) || "English");
  };

  const handleTranslate = async (targetLanguage: IndianLanguage) => {
    setIsTranslating(true);
    try {
      const response = await apiRequest("POST", "/api/drafts/translate", {
        content: memoContent,
        targetLanguage,
      });
      const result = await response.json();
      setMemoContent(result.translatedContent || memoContent);
      setCurrentLanguage(targetLanguage);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleMakeCopy = async () => {
    const response = await apiRequest("POST", "/api/drafts", {
      title: `${memoTitle} (Copy)`,
      type: "memo",
      content: memoContent,
      status: "draft",
    });
    const copyDraft = await response.json();
    setDraftId(copyDraft.id);
    setMemoTitle(`${memoTitle} (Copy)`);
    queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
  };

  const resetForm = () => {
    setLanguage("English");
    setFacts("");
    setIssues("");
    setMemoTitle("Legal Memorandum");
    setJurisdiction("");
    setParties("");
  };

  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <Link href="/hub">
            <Button variant="ghost" size="icon" data-testid="button-back-hub">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-md bg-primary/10">
              <Scroll className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Legal Memo Generator</h1>
              <p className="text-xs text-muted-foreground">IRAC structured memos with citations</p>
            </div>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowGenerateDialog(true);
            }}
            data-testid="button-generate-memo"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Legal Memo
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <StreamingIndicator />
            </div>
          ) : memoDrafts.length === 0 ? (
            <Card className="max-w-md mx-auto mt-8">
              <CardContent className="p-8 text-center">
                <Scroll className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No Legal Memos Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate your first IRAC-structured legal memorandum with AI.
                </p>
                <Button
                  onClick={() => {
                    resetForm();
                    setShowGenerateDialog(true);
                  }}
                  data-testid="button-generate-first"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Legal Memo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {memoDrafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="hover-elevate cursor-pointer group"
                  onClick={() => handleOpenDraft(draft)}
                  data-testid={`card-memo-${draft.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-muted">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{draft.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">Memo</Badge>
                            {draft.language && draft.language !== "English" && (
                              <Badge variant="secondary" className="text-[10px]">{draft.language}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDraft(draft);
                          }}
                          data-testid={`button-edit-${draft.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDraftMutation.mutate(draft.id);
                          }}
                          data-testid={`button-delete-${draft.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                      {draft.content?.substring(0, 100) || "Empty memo"}...
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Generate Legal Memo
              </DialogTitle>
              <DialogDescription>
                Provide case details to generate an IRAC-structured legal memorandum
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Language <span className="text-destructive">*</span>
                  </Label>
                  <Select value={language} onValueChange={(v) => setLanguage(v as IndianLanguage)}>
                    <SelectTrigger data-testid="select-language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {indianLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Memo Title</Label>
                  <Input
                    placeholder="e.g., Analysis of Contract Dispute"
                    value={memoTitle}
                    onChange={(e) => setMemoTitle(e.target.value)}
                    data-testid="input-title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parties Involved (Optional)</Label>
                  <Input
                    placeholder="e.g., ABC Corp. vs XYZ Ltd."
                    value={parties}
                    onChange={(e) => setParties(e.target.value)}
                    data-testid="input-parties"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jurisdiction (Optional)</Label>
                  <Input
                    placeholder="e.g., Delhi High Court"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    data-testid="input-jurisdiction"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Facts of the Case <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Describe the relevant facts, background, and circumstances of the case..."
                  rows={5}
                  value={facts}
                  onChange={(e) => setFacts(e.target.value)}
                  data-testid="textarea-facts"
                />
              </div>

              <div className="space-y-2">
                <Label>Legal Issues (Optional)</Label>
                <Textarea
                  placeholder="List the specific legal questions to be analyzed..."
                  rows={3}
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  data-testid="textarea-issues"
                />
              </div>

              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  The memo will be generated entirely in <strong>{language}</strong> using the IRAC structure.
                </AlertDescription>
              </Alert>

              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Hallucination Control</p>
                      <p className="text-muted-foreground mt-1">
                        Citations are cross-referenced with verified Indian statutes and case law.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!facts.trim() || isGenerating}
                  className="flex-1"
                  data-testid="button-generate"
                >
                  {isGenerating ? (
                    <>
                      <StreamingIndicator className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Memo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <PremiumEditor
          title={memoTitle}
          onTitleChange={setMemoTitle}
          content={memoContent}
          onContentChange={setMemoContent}
          onBack={() => {
            setViewMode("list");
            setShowResearchSidebar(false);
          }}
          onSave={handleSave}
          isSaving={isSaving}
          currentLanguage={currentLanguage}
          onTranslate={handleTranslate}
          isTranslating={isTranslating}
          drafts={allDrafts}
          onOpenDraft={handleOpenMemoFromEditor}
          onMakeCopy={handleMakeCopy}
          showAiHelper
        />
      </div>
      <ResearchSidebar
        isOpen={showResearchSidebar}
        onAddToDocument={handleAddToDocument}
        draftId={draftId || undefined}
      />
    </div>
  );
}
