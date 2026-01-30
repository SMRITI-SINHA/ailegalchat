import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { BackButton } from "@/components/back-button";
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
import { UploadDropzone } from "@/components/upload-dropzone";
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  AlertTriangle,
  Languages,
  Upload,
  Wand2,
  Plus,
  Palette,
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { markdownToHtml } from "@/lib/utils";
import type { IndianLanguage, Draft } from "@shared/schema";
import { indianLanguages } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { 
  DocumentTypeSelector, 
  getDocumentTypeForPrompt, 
  getDocumentTypeString,
  type DocumentTypeSelection 
} from "@/components/document-type-selector";

type ViewMode = "list" | "editor";

export default function CustomDraftPage() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [uploadedFormat, setUploadedFormat] = useState<File | null>(null);
  const [extractedFormatHtml, setExtractedFormatHtml] = useState<string | null>(null);
  const [isExtractingFormat, setIsExtractingFormat] = useState(false);
  const [caseFacts, setCaseFacts] = useState("");
  const [additionalPrompts, setAdditionalPrompts] = useState("");
  const [draftTitle, setDraftTitle] = useState("Custom Draft");
  const [draftContent, setDraftContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<IndianLanguage>("English");
  const [documentTypeSelection, setDocumentTypeSelection] = useState<DocumentTypeSelection | null>(null);

  const { data: allDrafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const customDrafts = allDrafts.filter((d) => d.type === "custom");

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
        title: draftTitle,
        content: draftContent,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setUploadedFormat(file);
      setExtractedFormatHtml(null);
      setIsExtractingFormat(true);
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("/api/format/extract", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          setExtractedFormatHtml(result.extractedHtml);
        }
      } catch (error) {
        console.error("Format extraction error:", error);
      } finally {
        setIsExtractingFormat(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!caseFacts.trim() || !uploadedFormat) return;
    setIsGenerating(true);

    try {
      const documentTypeStr = getDocumentTypeForPrompt(documentTypeSelection);
      const documentTypeFullStr = getDocumentTypeString(documentTypeSelection);
      
      const response = await apiRequest("POST", "/api/drafts/generate", {
        type: "custom", // Always use "custom" type for custom drafting page
        title: draftTitle || documentTypeFullStr || "Custom Draft",
        facts: caseFacts,
        additionalPrompts,
        language,
        formatReference: uploadedFormat.name,
        formatHtml: extractedFormatHtml,
        documentTypeDetails: documentTypeSelection,
        documentSubType: documentTypeStr, // Pass specific type for prompt context
      });
      const draft = await response.json();
      setDraftId(draft.id);
      setDraftTitle(draft.title || "Custom Draft");
      setDraftContent(draft.content || "");
      setShowGenerateDialog(false);
      setViewMode("editor");
      setShowResearchSidebar(true);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    } catch (error) {
      console.error("Draft generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenDraft = (draft: Draft) => {
    setDraftId(draft.id);
    setDraftTitle(draft.title);
    setDraftContent(markdownToHtml(draft.content || ""));
    setCurrentLanguage((draft.language as IndianLanguage) || "English");
    setViewMode("editor");
    setShowResearchSidebar(true);
  };

  const handleOpenDraftFromEditor = (draft: Draft) => {
    setDraftId(draft.id);
    setDraftTitle(draft.title);
    setDraftContent(markdownToHtml(draft.content || ""));
    setCurrentLanguage((draft.language as IndianLanguage) || "English");
  };

  const handleTranslate = async (targetLanguage: IndianLanguage) => {
    setIsTranslating(true);
    try {
      const response = await apiRequest("POST", "/api/drafts/translate", {
        content: draftContent,
        targetLanguage,
      });
      const result = await response.json();
      setDraftContent(result.translatedContent || draftContent);
      setCurrentLanguage(targetLanguage);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleMakeCopy = async () => {
    const response = await apiRequest("POST", "/api/drafts", {
      title: `${draftTitle} (Copy)`,
      type: "custom",
      content: draftContent,
      status: "draft",
    });
    const copyDraft = await response.json();
    setDraftId(copyDraft.id);
    setDraftTitle(`${draftTitle} (Copy)`);
    queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
  };

  const handleAddToDocument = (text: string) => {
    setDraftContent((prev) => prev + "\n\n" + text);
  };

  const resetForm = () => {
    setLanguage("English");
    setUploadedFormat(null);
    setExtractedFormatHtml(null);
    setCaseFacts("");
    setAdditionalPrompts("");
    setDraftTitle("Custom Draft");
    setDocumentTypeSelection(null);
  };

  const canGenerate = caseFacts.trim().length > 0 && uploadedFormat !== null && !isExtractingFormat && extractedFormatHtml !== null && documentTypeSelection !== null;

  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <BackButton />
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-md bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Custom Drafts</h1>
              <p className="text-xs text-muted-foreground">Drafts created with your custom format templates</p>
            </div>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowGenerateDialog(true);
            }}
            data-testid="button-generate-custom"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Custom Draft
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <StreamingIndicator />
            </div>
          ) : customDrafts.length === 0 ? (
            <Card className="max-w-md mx-auto mt-8">
              <CardContent className="p-8 text-center">
                <Palette className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No Custom Drafts Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first custom draft by uploading your format template and providing case details.
                </p>
                <Button
                  onClick={() => {
                    resetForm();
                    setShowGenerateDialog(true);
                  }}
                  data-testid="button-generate-first"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom Draft
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customDrafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="hover-elevate cursor-pointer group"
                  onClick={() => handleOpenDraft(draft)}
                  data-testid={`card-draft-${draft.id}`}
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
                            <Badge variant="outline" className="text-[10px]">Custom</Badge>
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
                      {draft.content?.substring(0, 100) || "Empty draft"}...
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
                Generate Custom Draft
              </DialogTitle>
              <DialogDescription>
                Upload your format template and provide case details to generate a new draft
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Draft Language
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
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Format Template <span className="text-destructive">*</span>
                </Label>
                <Alert className="bg-amber-500/10 border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm">
                    Upload a reference document for style and formatting. The AI will match its tone and structure but NOT use its content.
                  </AlertDescription>
                </Alert>
                <UploadDropzone 
                  onUpload={handleUpload} 
                  maxFiles={1}
                  maxSize={5 * 1024 * 1024}
                  maxPages={10}
                  description="Max 1-10 pages, 5MB. PDF, Word supported for template."
                />
                {uploadedFormat && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">{uploadedFormat.name}</span>
                    {isExtractingFormat ? (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        Extracting...
                      </Badge>
                    ) : extractedFormatHtml ? (
                      <Badge variant="outline" className="text-green-600 dark:text-green-400 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Structure Extracted
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Format Reference</Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Document Type <span className="text-destructive">*</span>
                </Label>
                <DocumentTypeSelector 
                  value={documentTypeSelection} 
                  onChange={setDocumentTypeSelection} 
                />
              </div>

              <div className="space-y-2">
                <Label>Draft Title</Label>
                <Input
                  placeholder="e.g., Petition for Bail - State vs. Sharma"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Matter of Facts <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Describe the complete facts of the case including:
- Background and circumstances
- Parties involved
- Timeline of events
- Key issues and claims
- Relevant legal provisions"
                  rows={6}
                  value={caseFacts}
                  onChange={(e) => setCaseFacts(e.target.value)}
                  data-testid="textarea-facts"
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Instructions (Optional)</Label>
                <Textarea
                  placeholder="Any specific instructions for the AI..."
                  rows={3}
                  value={additionalPrompts}
                  onChange={(e) => setAdditionalPrompts(e.target.value)}
                  data-testid="textarea-prompts"
                />
              </div>

              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  The AI will generate your draft entirely in <strong>{language}</strong> using the provided facts and your format template's style.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
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
                      Generate Draft
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
    <div className="h-full flex min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <PremiumEditor
          title={draftTitle}
          onTitleChange={setDraftTitle}
          content={draftContent}
          onContentChange={setDraftContent}
          onBack={() => {
            setViewMode("list");
            setShowResearchSidebar(false);
          }}
          onSave={handleSave}
          isSaving={isSaving}
          showAiHelper
          currentLanguage={currentLanguage}
          onTranslate={handleTranslate}
          isTranslating={isTranslating}
          drafts={allDrafts}
          onOpenDraft={handleOpenDraftFromEditor}
          onMakeCopy={handleMakeCopy}
          onAiAssist={async (prompt: string) => {
            const response = await apiRequest("POST", "/api/drafts/assist", { prompt, context: draftContent?.slice(0, 500) });
            const data = await response.json();
            return data.content || "";
          }}
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
