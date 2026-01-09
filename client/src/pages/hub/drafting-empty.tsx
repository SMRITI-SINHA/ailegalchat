import { useState } from "react";
import { Link } from "wouter";
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";

export default function EmptyDraftPage() {
  const [draftTitle, setDraftTitle] = useState("Untitled Document");
  const [draftContent, setDraftContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(true);

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
        />
      </div>
      <ResearchSidebar
        isOpen={showResearchSidebar}
        onAddToDocument={handleAddToDocument}
      />
    </div>
  );
}
