import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { BackButton } from "@/components/back-button";
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { markdownToHtml } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Draft, IndianLanguage } from "@shared/schema";

export default function EmptyDraftPage() {
  const { toast } = useToast();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("Untitled Document");
  const [draftContent, setDraftContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<IndianLanguage>("English");

  const { data: drafts = [] } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const createDraftMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/drafts", {
        title,
        type: "empty",
        content: draftContent,
        status: "draft",
      });
      return response.json() as Promise<Draft>;
    },
    onSuccess: (draft) => {
      setDraftId(draft.id);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Draft saved",
        description: "Your document has been saved.",
      });
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
      toast({
        title: "Draft saved",
        description: "Your changes have been saved.",
      });
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (draftId) {
        await updateDraftMutation.mutateAsync({
          id: draftId,
          title: draftTitle,
          content: draftContent,
        });
      } else {
        await createDraftMutation.mutateAsync(draftTitle);
      }
    } finally {
      setIsSaving(false);
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
      setDraftContent(result.translatedContent || draftContent);
      setCurrentLanguage(targetLanguage);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleOpenDraft = (draft: Draft) => {
    setDraftId(draft.id);
    setDraftTitle(draft.title || "Untitled Document");
    setDraftContent(markdownToHtml(draft.content || ""));
    setCurrentLanguage((draft.language as IndianLanguage) || "English");
  };

  const handleMakeCopy = () => {
    setDraftId(null);
    setDraftTitle(`${draftTitle} (Copy)`);
  };

  const handleAddToDocument = (text: string) => {
    setDraftContent((prev) => prev + "\n\n" + text);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b shrink-0">
        <BackButton />
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <PremiumEditor
            title={draftTitle}
            onTitleChange={setDraftTitle}
            content={draftContent}
            onContentChange={setDraftContent}
            onBack={() => window.history.back()}
            onSave={handleSave}
            isSaving={isSaving}
            showAiHelper
            currentLanguage={currentLanguage}
            onTranslate={handleTranslate}
            isTranslating={isTranslating}
            drafts={drafts}
            onOpenDraft={handleOpenDraft}
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
    </div>
  );
}
