import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Upload,
  FileEdit,
  FileText,
  Wand2,
  Plus,
  Trash2,
  Clock,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Draft, IndianLanguage } from "@shared/schema";
import { indianLanguages } from "@shared/schema";

type StartOption = "upload_reference" | "type_facts" | "upload_draft" | null;
type ViewMode = "list" | "option_select" | "input_form" | "editor";

export default function AIDraftingPage() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [startOption, setStartOption] = useState<StartOption>(null);
  const [useFirmStyle, setUseFirmStyle] = useState(false);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Untitled Draft");
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    facts: "",
    parties: "",
    jurisdiction: "Delhi High Court",
    documentType: "petition",
  });

  const { data: drafts, isLoading: draftsLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/drafts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/drafts", {
        title,
        type: "custom",
        content: "",
        status: "draft",
      });
      return response.json() as Promise<Draft>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleContinueToEditorWithDraft = async (title: string) => {
    const draft = await createDraftMutation.mutateAsync(title);
    setSelectedDraftId(draft.id);
    setDraftTitle(draft.title || title);
    setViewMode("editor");
    setShowResearchSidebar(true);
  };

  const handleStartOption = (option: StartOption) => {
    setStartOption(option);
    setShowGenerateDialog(false);
    setViewMode("input_form");
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
      setSelectedDraftId(draft.id);
      setDraftTitle(draft.title || "Generated Draft");
      setDraftContent(draft.content || "");
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
    setSelectedDraftId(draft.id);
    setDraftTitle(draft.title || "Untitled Draft");
    setDraftContent(draft.content || "");
    setViewMode("editor");
    setShowResearchSidebar(true);
  };

  const handleBackToList = () => {
    setViewMode("list");
    setStartOption(null);
    setShowResearchSidebar(false);
    setDraftContent("");
    setDraftTitle("Untitled Draft");
    setSelectedDraftId(null);
  };

  const handleAddToDocument = (text: string) => {
    setDraftContent((prev) => prev + "\n\n" + text);
  };

  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/hub">
              <Button variant="ghost" size="icon" data-testid="button-back-hub">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-semibold text-lg">AI Legal Drafting</h1>
            <Badge variant="outline">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Powered
            </Badge>
          </div>
          <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-draft">
            <Plus className="mr-2 h-4 w-4" />
            Generate Draft
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          {draftsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : drafts && drafts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => handleOpenDraft(draft)}
                  data-testid={`card-draft-${draft.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{draft.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {(draft.content || "").substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {draft.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(draft.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDraftMutation.mutate(draft.id);
                        }}
                        data-testid={`button-delete-draft-${draft.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileEdit className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No drafts yet</h3>
              <p className="text-muted-foreground mb-4">
                Click "Generate Draft" to create your first AI-powered legal document
              </p>
              <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-first">
                <Plus className="mr-2 h-4 w-4" />
                Generate Draft
              </Button>
            </div>
          )}
        </ScrollArea>

        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Generate Draft
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
                    <h3 className="font-medium">Upload reference documents</h3>
                    <p className="text-sm text-muted-foreground">Upload existing documents to use as reference</p>
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
                    <h3 className="font-medium">Type facts of the matter</h3>
                    <p className="text-sm text-muted-foreground">Start fresh by providing case facts and details</p>
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
      </div>
    );
  }

  if (viewMode === "input_form") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBackToList} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold text-lg">
              {startOption === "upload_reference" && "Upload Reference Documents"}
              {startOption === "type_facts" && "Enter Case Details"}
              {startOption === "upload_draft" && "Upload Your Draft"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="firm-style"
                checked={useFirmStyle}
                onCheckedChange={setUseFirmStyle}
                data-testid="switch-firm-style"
              />
              <Label htmlFor="firm-style" className="text-sm">Use trained style</Label>
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

        <ScrollArea className="flex-1 p-6">
          {startOption === "type_facts" && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileEdit className="h-4 w-4" />
                  Enter the facts and details of the matter
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
                    placeholder="Enter the facts and details of your case..."
                    rows={8}
                    value={formData.facts}
                    onChange={(e) => setFormData((p) => ({ ...p, facts: e.target.value }))}
                    className="font-mono text-sm"
                    data-testid="textarea-facts"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!formData.facts || isGenerating}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {isGenerating ? <StreamingIndicator className="mr-2" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  {isGenerating ? "Generating..." : "Generate Draft"}
                </Button>
              </CardContent>
            </Card>
          )}

          {startOption === "upload_reference" && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-base">Upload Reference Documents</CardTitle>
                <CardDescription>Upload documents to use as reference for your draft</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UploadDropzone
                  onUpload={async (files) => console.log("Files:", files)}
                  maxFiles={10}
                />
                <Button 
                  className="w-full" 
                  onClick={() => handleContinueToEditorWithDraft("New Draft from Reference")}
                  disabled={createDraftMutation.isPending}
                >
                  {createDraftMutation.isPending ? "Creating..." : "Continue to Editor"}
                </Button>
              </CardContent>
            </Card>
          )}

          {startOption === "upload_draft" && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-base">Upload Your Draft</CardTitle>
                <CardDescription>Upload your existing draft to edit with AI assistance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UploadDropzone
                  onUpload={async (files) => console.log("Files:", files)}
                  maxFiles={1}
                />
                <Button 
                  className="w-full" 
                  onClick={() => handleContinueToEditorWithDraft("Uploaded Draft")}
                  disabled={createDraftMutation.isPending}
                >
                  {createDraftMutation.isPending ? "Creating..." : "Open in Editor"}
                </Button>
              </CardContent>
            </Card>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <PremiumEditor
          title={draftTitle}
          onTitleChange={setDraftTitle}
          content={draftContent}
          onContentChange={setDraftContent}
          onBack={handleBackToList}
          showAiHelper
        />
      </div>
      <ResearchSidebar
        isOpen={showResearchSidebar}
        onAddToDocument={handleAddToDocument}
        draftId={selectedDraftId || undefined}
      />
    </div>
  );
}
