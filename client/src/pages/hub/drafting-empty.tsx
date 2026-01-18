import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Draft, IndianLanguage } from "@shared/schema";

export default function EmptyDraftPage() {
  const [draftTitle, setDraftTitle] = useState("Untitled Document");
  const [draftContent, setDraftContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<IndianLanguage>("English");

  const { data: drafts = [] } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

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
    setDraftTitle(draft.title || "Untitled Document");
    setDraftContent(draft.content || "");
    setCurrentLanguage((draft.language as IndianLanguage) || "English");
  };

  const handleMakeCopy = () => {
    setDraftTitle(`${draftTitle} (Copy)`);
  };

  const handleAddToDocument = (text: string) => {
    setDraftContent((prev) => prev + "\n\n" + text);
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <PremiumEditor
          title={draftTitle}
          onTitleChange={setDraftTitle}
          content={draftContent}
          onContentChange={setDraftContent}
          onBack={() => window.history.back()}
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
      />
    </div>
  );
}
