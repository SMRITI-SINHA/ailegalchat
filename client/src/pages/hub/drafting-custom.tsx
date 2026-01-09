import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IndianLanguage, Draft } from "@shared/schema";
import { indianLanguages } from "@shared/schema";

type ViewMode = "upload" | "editor";

export default function CustomDraftPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [useFirmStyle, setUseFirmStyle] = useState(false);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [draftTitle, setDraftTitle] = useState("Uploaded Document");
  const [draftContent, setDraftContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

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
    onSuccess: (draft) => {
      setDraftId(draft.id);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleUpload = async (files: File[]) => {
    console.log("Uploaded files:", files);
    if (files.length > 0) {
      setDraftTitle(files[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleContinueToEditor = async () => {
    const draft = await createDraftMutation.mutateAsync(draftTitle);
    setDraftId(draft.id);
    setViewMode("editor");
    setShowResearchSidebar(true);
  };

  const handleAddToDocument = (text: string) => {
    setDraftContent((prev) => prev + "\n\n" + text);
  };

  if (viewMode === "upload") {
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

        <ScrollArea className="flex-1 p-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Upload Your Document
              </CardTitle>
              <CardDescription>
                Upload your own template or draft to edit with AI assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UploadDropzone
                onUpload={handleUpload}
                maxFiles={1}
              />
              <Button className="w-full" onClick={handleContinueToEditor} data-testid="button-continue">
                Open in Editor
              </Button>
            </CardContent>
          </Card>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 border-b flex items-center justify-end gap-4 px-4 bg-background">
          <div className="flex items-center gap-2">
            <Switch
              id="firm-style"
              checked={useFirmStyle}
              onCheckedChange={setUseFirmStyle}
              data-testid="switch-firm-style"
            />
            <Label htmlFor="firm-style" className="text-xs">Use trained style</Label>
          </div>
          <Select value={language} onValueChange={(v) => setLanguage(v as IndianLanguage)}>
            <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {indianLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PremiumEditor
          title={draftTitle}
          onTitleChange={setDraftTitle}
          content={draftContent}
          onContentChange={setDraftContent}
          onBack={() => setViewMode("upload")}
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
