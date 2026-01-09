import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ArrowLeft, ArrowRight, FileText, Sparkles, AlertTriangle, Languages, Upload, FileEdit, Wand2, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IndianLanguage, Draft } from "@shared/schema";
import { indianLanguages } from "@shared/schema";

type Step = 1 | 2 | 3 | 4;
type ViewMode = "wizard" | "editor";

export default function CustomDraftPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("wizard");
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [uploadedFormat, setUploadedFormat] = useState<File | null>(null);
  const [caseFacts, setCaseFacts] = useState("");
  const [additionalPrompts, setAdditionalPrompts] = useState("");
  const [draftTitle, setDraftTitle] = useState("Custom Draft");
  const [draftContent, setDraftContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const createDraftMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await apiRequest("POST", "/api/drafts", {
        title: data.title,
        type: "custom",
        content: data.content,
        status: "draft",
      });
      return response.json() as Promise<Draft>;
    },
    onSuccess: (draft) => {
      setDraftId(draft.id);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleUpload = async (files: File[]) => {
    if (files.length > 0) {
      setUploadedFormat(files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!caseFacts.trim()) return;
    setIsGenerating(true);

    try {
      const response = await apiRequest("POST", "/api/drafts/generate", {
        type: "custom",
        title: draftTitle,
        facts: caseFacts,
        additionalPrompts,
        language,
        formatReference: uploadedFormat?.name || null,
      });
      const draft = await response.json();
      setDraftId(draft.id);
      setDraftTitle(draft.title || "Custom Draft");
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

  const handleAddToDocument = (text: string) => {
    setDraftContent((prev) => prev + "\n\n" + text);
  };

  const canProceedToStep2 = language.length > 0;
  const canProceedToStep3 = true;
  const canProceedToStep4 = caseFacts.trim().length > 0;

  const steps = [
    { number: 1, title: "Language", icon: Languages },
    { number: 2, title: "Format", icon: Upload },
    { number: 3, title: "Case Details", icon: FileEdit },
    { number: 4, title: "Generate", icon: Wand2 },
  ];

  if (viewMode === "wizard") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <Link href="/hub">
            <Button variant="ghost" size="icon" data-testid="button-back-hub">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-semibold text-lg">Custom Drafting</h1>
          <Badge variant="outline">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
        </div>

        <div className="p-4 border-b bg-muted/30">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      currentStep === step.number
                        ? "border-primary bg-primary text-primary-foreground"
                        : currentStep > step.number
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 ${currentStep >= step.number ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${currentStep > step.number ? "bg-primary" : "bg-muted-foreground/30"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          {currentStep === 1 && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Languages className="h-4 w-4" />
                  Select Language
                </CardTitle>
                <CardDescription>
                  Choose the language in which you want the draft to be generated. The AI will write the entire document precisely in this language.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Draft Language</Label>
                  <Select value={language} onValueChange={(v) => setLanguage(v as IndianLanguage)}>
                    <SelectTrigger className="w-full mt-2" data-testid="select-language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {indianLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => setCurrentStep(2)}
                  disabled={!canProceedToStep2}
                  data-testid="button-next-step"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4" />
                  Upload Draft Format (Optional)
                </CardTitle>
                <CardDescription>
                  Upload a reference document to match its style, tone, and format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-amber-500/10 border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm">
                    <strong>Important:</strong> This document is used ONLY as a style and format reference. The AI will pick up the tone, structure, and formatting patterns from this document but will NOT use any of its content. Your draft will be generated based on the case facts you provide in the next step.
                  </AlertDescription>
                </Alert>

                <UploadDropzone
                  onUpload={handleUpload}
                  maxFiles={1}
                />

                {uploadedFormat && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{uploadedFormat.name}</span>
                    <Badge variant="secondary" className="ml-auto">Format Reference</Badge>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} data-testid="button-prev-step">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setCurrentStep(3)} data-testid="button-next-step">
                    {uploadedFormat ? "Continue" : "Skip & Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileEdit className="h-4 w-4" />
                  Case Details
                </CardTitle>
                <CardDescription>
                  Provide the facts and details of your case. The AI will use this information to generate your draft.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Draft Title</Label>
                  <input
                    type="text"
                    className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., Petition for Bail - State vs. Sharma"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label>Matter of Facts <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Describe the complete facts of the case including:&#10;- Background and circumstances&#10;- Parties involved&#10;- Timeline of events&#10;- Key issues and claims&#10;- Relevant legal provisions"
                    rows={8}
                    value={caseFacts}
                    onChange={(e) => setCaseFacts(e.target.value)}
                    className="mt-2"
                    data-testid="textarea-facts"
                  />
                </div>
                <div>
                  <Label>Additional Instructions (Optional)</Label>
                  <Textarea
                    placeholder="Any specific instructions for the AI:&#10;- Particular sections to emphasize&#10;- Specific legal arguments to include&#10;- Tone preferences (formal, assertive, etc.)&#10;- Any other requirements"
                    rows={4}
                    value={additionalPrompts}
                    onChange={(e) => setAdditionalPrompts(e.target.value)}
                    className="mt-2"
                    data-testid="textarea-prompts"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="button-prev-step">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setCurrentStep(4)}
                    disabled={!canProceedToStep4}
                    data-testid="button-next-step"
                  >
                    Review & Generate
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wand2 className="h-4 w-4" />
                  Review & Generate
                </CardTitle>
                <CardDescription>
                  Review your selections and generate the draft
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Language</span>
                    <Badge variant="secondary">{language}</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Format Reference</span>
                    <span className="text-sm">{uploadedFormat ? uploadedFormat.name : "None"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Draft Title</span>
                    <span className="text-sm font-medium">{draftTitle}</span>
                  </div>
                  <div className="py-2 border-b">
                    <span className="text-sm text-muted-foreground">Case Facts Preview</span>
                    <p className="text-sm mt-1 line-clamp-3">{caseFacts}</p>
                  </div>
                  {additionalPrompts && (
                    <div className="py-2">
                      <span className="text-sm text-muted-foreground">Additional Instructions</span>
                      <p className="text-sm mt-1 line-clamp-2">{additionalPrompts}</p>
                    </div>
                  )}
                </div>

                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm">
                    The AI will generate your draft entirely in <strong>{language}</strong> using the provided facts. After generation, you can edit the document and use the Research Assistant for additional legal research.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="button-prev-step">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    data-testid="button-generate"
                  >
                    {isGenerating ? (
                      <>
                        <StreamingIndicator className="mr-2" />
                        Generating Draft in {language}...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate Draft
                      </>
                    )}
                  </Button>
                </div>
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
          onBack={() => {
            setViewMode("wizard");
            setCurrentStep(1);
            setShowResearchSidebar(false);
          }}
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
