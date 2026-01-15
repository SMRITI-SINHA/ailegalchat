import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Filter,
  FileSignature,
  Calendar,
  Edit,
  GraduationCap,
  MessageSquare,
  Gauge,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { markdownToHtml, stripHtmlTags } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Draft, IndianLanguage, DocumentTypeSelection } from "@shared/schema";
import { indianLanguages } from "@shared/schema";
import { DocumentTypeSelector, getDocumentTypeForPrompt, getDocumentTypeString } from "@/components/document-type-selector";
import { formatDistanceToNow } from "date-fns";

type StartOption = "upload_reference" | "type_facts" | "upload_draft" | null;
type ViewMode = "list" | "input_form" | "editor";
type FilterType = "all" | "custom" | "ai" | "user";

// Truncate filename helper
function truncateFilename(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) return name;
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '';
  const baseName = name.slice(0, name.lastIndexOf('.') > 0 ? name.lastIndexOf('.') : name.length);
  const truncatedBase = baseName.slice(0, maxLength - ext.length - 2);
  return `${truncatedBase}..${ext}`;
}

// Accept only documents, no images
const documentAcceptTypes = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

// Quality meter calculation - measures detail level of user input
function calculateDetailQuality(text: string): { score: number; level: "poor" | "fair" | "good" | "excellent"; message: string } {
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const hasNumbers = /\d/.test(text);
  const hasNames = /[A-Z][a-z]+/.test(text);
  const hasDates = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(text);
  const hasLegalTerms = /court|petition|plaintiff|defendant|section|act|clause|agreement|contract|party|parties|jurisdiction|claim|relief|prayer|affidavit|notice|order|decree|appeal|suit|case/i.test(text);
  
  let score = 0;
  
  // Word count scoring (max 40 points)
  if (wordCount >= 200) score += 40;
  else if (wordCount >= 100) score += 30;
  else if (wordCount >= 50) score += 20;
  else if (wordCount >= 25) score += 10;
  else score += Math.floor(wordCount / 3);
  
  // Content richness scoring (max 60 points)
  if (hasNumbers) score += 10;
  if (hasNames) score += 15;
  if (hasDates) score += 15;
  if (hasLegalTerms) score += 20;
  
  // Clamp score to 100
  score = Math.min(100, score);
  
  let level: "poor" | "fair" | "good" | "excellent";
  let message: string;
  
  if (score >= 80) {
    level = "excellent";
    message = "Excellent! Very detailed input";
  } else if (score >= 60) {
    level = "good";
    message = "Good level of detail";
  } else if (score >= 35) {
    level = "fair";
    message = "Add more details for better results";
  } else {
    level = "poor";
    message = "More details needed for quality output";
  }
  
  return { score, level, message };
}

// Quality meter component
function DetailQualityMeter({ text, label }: { text: string; label?: string }) {
  const { score, level, message } = calculateDetailQuality(text);
  
  const colorClass = {
    poor: "text-destructive",
    fair: "text-amber-500",
    good: "text-blue-500",
    excellent: "text-green-500",
  }[level];
  
  const progressColor = {
    poor: "bg-destructive",
    fair: "bg-amber-500",
    good: "bg-blue-500",
    excellent: "bg-green-500",
  }[level];
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Gauge className="h-3 w-3" />
          <span>{label || "Detail Level"}</span>
        </div>
        <span className={colorClass}>{message}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function AIDraftingPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [startOption, setStartOption] = useState<StartOption>(null);
  const [useFirmStyle, setUseFirmStyle] = useState(false);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Untitled Draft");
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<IndianLanguage>("English");
  const [filter, setFilter] = useState<FilterType>("all");
  
  // Upload states
  const [uploadedReferenceFiles, setUploadedReferenceFiles] = useState<{ name: string; content: string }[]>([]);
  const [uploadedDraftFile, setUploadedDraftFile] = useState<{ name: string; content: string } | null>(null);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isUploadingDraft, setIsUploadingDraft] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    facts: "",
    parties: "",
    jurisdiction: "Delhi High Court",
    additionalInstructions: "",
  });
  
  // Hierarchical document type selection
  const [documentTypeSelection, setDocumentTypeSelection] = useState<DocumentTypeSelection | null>(null);
  
  // Additional prompt for reference docs
  const [referencePrompt, setReferencePrompt] = useState("");

  const { data: drafts = [], isLoading: draftsLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const filteredDrafts = drafts.filter((draft) => {
    if (filter === "all") return true;
    if (filter === "custom") return draft.type === "custom";
    if (filter === "ai") return draft.modelUsed !== null && draft.modelUsed !== undefined;
    if (filter === "user") return !draft.modelUsed && draft.type !== "custom";
    return true;
  });

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

  const createDraftMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/drafts", {
        title,
        type: "petition",
        content: "",
        status: "draft",
      });
      return response.json() as Promise<Draft>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleSave = async () => {
    if (!selectedDraftId) return;
    setIsSaving(true);
    try {
      await updateDraftMutation.mutateAsync({
        id: selectedDraftId,
        title: draftTitle,
        content: draftContent,
      });
    } finally {
      setIsSaving(false);
    }
  };

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
      const factsWithInstructions = formData.additionalInstructions 
        ? `${formData.facts}\n\nADDITIONAL INSTRUCTIONS:\n${formData.additionalInstructions}`
        : formData.facts;
      
      const documentTypeStr = getDocumentTypeForPrompt(documentTypeSelection);
      const documentTypeFullStr = getDocumentTypeString(documentTypeSelection);
      
      const response = await apiRequest("POST", "/api/drafts/generate", {
        type: documentTypeStr,
        title: formData.title || `${documentTypeFullStr || "Draft"}`,
        facts: factsWithInstructions,
        parties: formData.parties,
        jurisdiction: formData.jurisdiction,
        language,
        useFirmStyle,
        documentTypeDetails: documentTypeSelection,
      });
      const draft = await response.json();
      setSelectedDraftId(draft.id);
      setDraftTitle(draft.title || "Generated Draft");
      setDraftContent(markdownToHtml(draft.content || ""));
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
    setUploadedReferenceFiles([]);
    setUploadedDraftFile(null);
    setFormData({
      title: "",
      facts: "",
      parties: "",
      jurisdiction: "Delhi High Court",
      additionalInstructions: "",
    });
    setDocumentTypeSelection(null);
    setReferencePrompt("");
  };

  const handleReferenceFilesUpload = async (files: File[]) => {
    setIsUploadingRef(true);
    try {
      const uploadedFiles: { name: string; content: string }[] = [];
      const errorFiles: string[] = [];
      
      // Upload all files together
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        const docs = await response.json();
        // Handle all returned documents
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i];
          const fileName = files[i]?.name || doc.name || `Document ${i + 1}`;
          
          // Check if document has an error message (old .doc format or extraction failed)
          if (doc.extractedText?.includes("Please save it as .docx format") || 
              doc.extractedText?.includes("could not be read") ||
              doc.extractedText?.includes("[Error extracting")) {
            errorFiles.push(fileName);
          } else if (doc.extractedText && doc.extractedText.length > 50) {
            uploadedFiles.push({
              name: fileName,
              content: doc.extractedText,
            });
          } else {
            errorFiles.push(fileName);
          }
        }
        
        // Show toast for error files
        if (errorFiles.length > 0) {
          toast({
            title: "Some files could not be processed",
            description: `${errorFiles.join(", ")} - Please convert to .docx format and try again.`,
            variant: "destructive",
          });
        }
      }
      
      setUploadedReferenceFiles(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
      console.error("Reference upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to process the documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingRef(false);
    }
  };

  const handleDraftFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploadingDraft(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append("files", file);
      
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        const docs = await response.json();
        if (docs.length > 0) {
          const doc = docs[0];
          
          // Check if document has an error message (old .doc format or extraction failed)
          if (doc.extractedText?.includes("Please save it as .docx format") || 
              doc.extractedText?.includes("could not be read") ||
              doc.extractedText?.includes("[Error extracting")) {
            toast({
              title: "File format not supported",
              description: `"${file.name}" is in an older format. Please convert it to .docx format and try again.`,
              variant: "destructive",
            });
            return;
          }
          
          // Use extractedHtml from server (preserves legal document structure)
          // Fallback to extractedText if HTML not available
          const htmlContent = doc.extractedHtml || doc.extractedText || "";
          if (htmlContent.length < 50) {
            toast({
              title: "Could not read file",
              description: "The document appears to be empty or couldn't be processed. Please try a different file.",
              variant: "destructive",
            });
            return;
          }
          
          setUploadedDraftFile({
            name: file.name,
            content: htmlContent,
          });
        }
      }
    } catch (error) {
      console.error("Draft upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to process the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingDraft(false);
    }
  };

  const handleOpenUploadedDraft = async () => {
    if (!uploadedDraftFile) return;
    const draft = await createDraftMutation.mutateAsync(uploadedDraftFile.name.replace(/\.[^.]+$/, ""));
    // Content is already HTML from server - use directly
    await updateDraftMutation.mutateAsync({
      id: draft.id,
      title: uploadedDraftFile.name.replace(/\.[^.]+$/, ""),
      content: uploadedDraftFile.content,
    });
    setSelectedDraftId(draft.id);
    setDraftTitle(uploadedDraftFile.name.replace(/\.[^.]+$/, ""));
    setDraftContent(uploadedDraftFile.content);
    setViewMode("editor");
    setShowResearchSidebar(true);
  };

  const handleGenerateFromReference = async () => {
    setIsGenerating(true);
    try {
      const referenceContext = uploadedReferenceFiles
        .map(f => `=== ${f.name} ===\n${f.content}`)
        .join("\n\n");
      
      const documentTypeStr = getDocumentTypeForPrompt(documentTypeSelection);
      const documentTypeFullStr = getDocumentTypeString(documentTypeSelection);
      
      const response = await apiRequest("POST", "/api/drafts/generate", {
        type: documentTypeStr,
        title: formData.title || `${documentTypeFullStr || "Draft"}`,
        facts: `REFERENCE DOCUMENTS:\n${referenceContext}\n\nADDITIONAL CONTEXT / INSTRUCTIONS:\n${referencePrompt || "Use the reference documents to understand the case details."}`,
        parties: formData.parties,
        jurisdiction: formData.jurisdiction,
        language,
        useFirmStyle,
        documentTypeDetails: documentTypeSelection,
      });
      const draft = await response.json();
      setSelectedDraftId(draft.id);
      setDraftTitle(draft.title || "Generated Draft");
      setDraftContent(markdownToHtml(draft.content || ""));
      setViewMode("editor");
      setShowResearchSidebar(true);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    } catch (error) {
      console.error("Draft generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslate = async (targetLanguage: IndianLanguage) => {
    setIsTranslating(true);
    try {
      const response = await apiRequest("POST", "/api/drafts/translate", {
        content: draftContent,
        targetLanguage,
      });
      const result = await response.json();
      // Convert translated content (may contain markdown) to HTML
      setDraftContent(markdownToHtml(result.translatedContent || draftContent));
      setCurrentLanguage(targetLanguage);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleOpenDraftFromEditor = (draft: Draft) => {
    setSelectedDraftId(draft.id);
    setDraftTitle(draft.title || "Untitled Draft");
    setDraftContent(draft.content || "");
    setCurrentLanguage((draft.language as IndianLanguage) || "English");
  };

  const handleMakeCopy = async () => {
    const copyDraft = await createDraftMutation.mutateAsync(`${draftTitle} (Copy)`);
    await updateDraftMutation.mutateAsync({
      id: copyDraft.id,
      title: `${draftTitle} (Copy)`,
      content: draftContent,
    });
    setSelectedDraftId(copyDraft.id);
    setDraftTitle(`${draftTitle} (Copy)`);
  };

  const handleAddToDocument = (text: string) => {
    const formattedText = markdownToHtml(text);
    setDraftContent((prev) => prev + "<br><br>" + formattedText);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      custom: "Custom",
      memo: "Memo",
      petition: "Petition",
      written_statement: "Written Statement",
      notice: "Notice",
      contract: "Contract",
      affidavit: "Affidavit",
      application: "Application",
      reply: "Reply",
      brief: "Brief",
    };
    return labels[type] || type;
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
            <div className="p-2 rounded-md bg-primary/10">
              <FileSignature className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">AI Legal Drafting</h1>
              <p className="text-xs text-muted-foreground">All your drafts in one place</p>
            </div>
            <Badge variant="outline">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Powered
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              <GraduationCap className="h-3 w-3 mr-1" />
              Trained on 2000+ legal drafts
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  {filter === "all" ? "All Drafts" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem checked={filter === "all"} onCheckedChange={() => setFilter("all")}>
                  All Drafts
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filter === "custom"} onCheckedChange={() => setFilter("custom")}>
                  Custom Drafts
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filter === "ai"} onCheckedChange={() => setFilter("ai")}>
                  AI Generated
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filter === "user"} onCheckedChange={() => setFilter("user")}>
                  User Created
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-draft">
              <Plus className="mr-2 h-4 w-4" />
              Generate Draft
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          {draftsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : filteredDrafts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDrafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="hover-elevate cursor-pointer group"
                  onClick={() => handleOpenDraft(draft)}
                  data-testid={`card-draft-${draft.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-muted shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm truncate flex-1" title={draft.title}>{draft.title}</h3>
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
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
                              className="h-6 w-6 text-destructive hover:text-destructive"
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
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{getTypeLabel(draft.type)}</Badge>
                          {draft.modelUsed && (
                            <Badge variant="secondary" className="text-[10px]">AI</Badge>
                          )}
                          {draft.language && draft.language !== "English" && (
                            <Badge variant="secondary" className="text-[10px]">{draft.language}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                      {stripHtmlTags(draft.content || "").substring(0, 100) || "Empty draft"}...
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileEdit className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">
                {filter === "all" ? "No drafts yet" : `No ${filter} drafts`}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filter === "all"
                  ? 'Click "Generate Draft" to create your first AI-powered legal document'
                  : "Try changing the filter to see other drafts"}
              </p>
              {filter === "all" && (
                <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-first">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Draft
                </Button>
              )}
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
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <DocumentTypeSelector 
                    value={documentTypeSelection} 
                    onChange={setDocumentTypeSelection} 
                  />
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
                <div className="space-y-2">
                  <Label>Facts of the Case</Label>
                  <Textarea
                    placeholder="Enter detailed facts including: dates, party names, locations, amounts, chronological events, claims, and any relevant legal issues..."
                    rows={8}
                    value={formData.facts}
                    onChange={(e) => setFormData((p) => ({ ...p, facts: e.target.value }))}
                    className="font-mono text-sm"
                    data-testid="textarea-facts"
                  />
                  <DetailQualityMeter text={formData.facts} label="Facts Detail Level" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <Label>Additional Instructions for AI</Label>
                  </div>
                  <Textarea
                    placeholder="Any specific instructions for the AI, e.g., 'Include prayer for interim relief', 'Use formal language', 'Focus on breach of contract aspects'..."
                    rows={3}
                    value={formData.additionalInstructions}
                    onChange={(e) => setFormData((p) => ({ ...p, additionalInstructions: e.target.value }))}
                    className="text-sm"
                    data-testid="textarea-additional-instructions"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <Label className="cursor-pointer">Use trained style</Label>
                  </div>
                  <Switch checked={useFirmStyle} onCheckedChange={setUseFirmStyle} />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!formData.facts || !documentTypeSelection || isGenerating}
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
                <CardDescription>Upload documents to use as reference. AI will analyze them to understand the case details. (Max 10 docs, 50 pages each, 150 pages total)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UploadDropzone
                  onUpload={handleReferenceFilesUpload}
                  accept={documentAcceptTypes}
                  maxFiles={10}
                  maxSize={25 * 1024 * 1024}
                  maxPages={50}
                  description="Max 10 docs, 50 pages each, 25MB total. PDF, Word supported."
                />
                
                {isUploadingRef && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <StreamingIndicator />
                    <span>Processing documents...</span>
                  </div>
                )}
                
                {uploadedReferenceFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Uploaded files:</Label>
                    <div className="flex flex-wrap gap-2">
                      {uploadedReferenceFiles.map((file, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          <span title={file.name}>{truncateFilename(file.name)}</span>
                          <button 
                            onClick={() => setUploadedReferenceFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="ml-1 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {uploadedReferenceFiles.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <Label>Additional Context / Instructions</Label>
                      </div>
                      <Textarea
                        placeholder="Provide any additional context about the case that may not be in the reference documents, or specific instructions for the AI (e.g., 'Focus on the contractual breach', 'Include prayer for specific performance')..."
                        rows={4}
                        value={referencePrompt}
                        onChange={(e) => setReferencePrompt(e.target.value)}
                        className="text-sm"
                        data-testid="textarea-ref-prompt"
                      />
                      <DetailQualityMeter text={referencePrompt} label="Instructions Detail Level" />
                    </div>
                    <div className="border-t pt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Document Type</Label>
                        <DocumentTypeSelector 
                          value={documentTypeSelection} 
                          onChange={setDocumentTypeSelection} 
                        />
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input
                          placeholder="e.g., Petition for..."
                          value={formData.title}
                          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                          data-testid="input-ref-title"
                        />
                      </div>
                      <div>
                        <Label>Parties</Label>
                        <Input
                          placeholder="e.g., ABC Pvt Ltd vs XYZ Corp"
                          value={formData.parties}
                          onChange={(e) => setFormData((p) => ({ ...p, parties: e.target.value }))}
                          data-testid="input-ref-parties"
                        />
                      </div>
                      <div>
                        <Label>Jurisdiction</Label>
                        <Select value={formData.jurisdiction} onValueChange={(v) => setFormData((p) => ({ ...p, jurisdiction: v }))}>
                          <SelectTrigger data-testid="select-ref-jurisdiction">
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
                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <Label className="cursor-pointer">Use trained style</Label>
                        </div>
                        <Switch checked={useFirmStyle} onCheckedChange={setUseFirmStyle} />
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleGenerateFromReference}
                      disabled={isGenerating || uploadedReferenceFiles.length === 0 || !formData.title || !formData.parties || !documentTypeSelection}
                    >
                      {isGenerating ? <StreamingIndicator className="mr-2" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      {isGenerating ? "Generating..." : "Generate Draft with AI"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {startOption === "upload_draft" && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-base">Upload Your Draft</CardTitle>
                <CardDescription>Upload your existing draft to edit with AI assistance (Max 50 pages)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UploadDropzone
                  onUpload={handleDraftFileUpload}
                  accept={documentAcceptTypes}
                  maxFiles={1}
                  maxSize={10 * 1024 * 1024}
                  maxPages={50}
                  description="Max 50 pages (ideal 5-25), 10MB. PDF, Word supported."
                />
                
                {isUploadingDraft && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <StreamingIndicator />
                    <span>Processing document...</span>
                  </div>
                )}
                
                {uploadedDraftFile && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1" title={uploadedDraftFile.name}>
                      {truncateFilename(uploadedDraftFile.name)}
                    </span>
                    <button 
                      onClick={() => setUploadedDraftFile(null)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                
                <Button 
                  className="w-full" 
                  onClick={handleOpenUploadedDraft}
                  disabled={!uploadedDraftFile || createDraftMutation.isPending}
                >
                  {createDraftMutation.isPending ? "Opening..." : "Open in Editor"}
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
          onSave={handleSave}
          isSaving={isSaving}
          showAiHelper
          currentLanguage={currentLanguage}
          onTranslate={handleTranslate}
          isTranslating={isTranslating}
          drafts={drafts}
          onOpenDraft={handleOpenDraftFromEditor}
          onMakeCopy={handleMakeCopy}
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
