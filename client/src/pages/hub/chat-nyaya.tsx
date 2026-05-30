import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AiThinkingText } from "@/components/ai-thinking-text";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { CitationCard } from "@/components/citation-card";
import { StreamingIndicator } from "@/components/streaming-text";
import { VoiceAssistant } from "@/components/voice-assistant";
import {
  Scale,
  Send,
  Sparkles,
  Lightbulb,
  MessageSquare,
  History,
  Clock,
  Trash2,
  Mic,
  Paperclip,
  X,
  FileText,
  Wand2,
  Edit,
  Download,
  Save,
  CheckCircle2,
  RotateCcw,
  Loader2,
  FileSignature,
  BookOpen,
} from "lucide-react";
import { apiRequest, authFetch, queryClient } from "@/lib/queryClient";
import { markdownToHtml } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { ModelTier, Citation, ChatSession } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface DraftQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "multi_select" | "radio";
  options?: string[];
  placeholder?: string;
  required: boolean;
  hint?: string;
}

interface DraftQuestionsData {
  documentType: string;
  suggestedTitle: string;
  questions: DraftQuestion[];
}

interface DraftOutputData {
  title: string;
  htmlContent: string;
  originalHtmlContent: string;
  draftId: string;
  documentType: string;
  generationParams: Record<string, string>;
}

interface UploadedFile {
  id: string;
  name: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "draft_questions" | "draft_output";
  modelUsed?: ModelTier;
  confidence?: number;
  cost?: number;
  citations?: Citation[];
  draftQuestionsData?: DraftQuestionsData;
  draftOutputData?: DraftOutputData;
  attachedFiles?: string[];
  submitted?: boolean;
}

const sampleQuestions = [
  { label: "What are the grounds for a writ petition under Article 226?", icon: BookOpen },
  { label: "Write a Non-Disclosure Agreement between two Indian tech startups", icon: FileSignature },
  { label: "Explain the basic structure doctrine with key Supreme Court judgments", icon: BookOpen },
  { label: "Draft a legal notice for breach of contract to recover ₹5 lakhs", icon: FileSignature },
  { label: "What is the limitation period for a money recovery civil suit?", icon: BookOpen },
  { label: "Prepare a bail application for a first-time offender in a property dispute", icon: FileSignature },
];

function DraftQuestionsCard({
  data,
  messageId,
  submitted,
  onSubmit,
  isGenerating,
}: {
  data: DraftQuestionsData;
  messageId: string;
  submitted?: boolean;
  onSubmit: (answers: Record<string, string>, context: { documentType: string; suggestedTitle: string }) => void;
  isGenerating: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});

  const setAnswer = (id: string, val: string) => setAnswers((p) => ({ ...p, [id]: val }));

  const toggleMulti = (id: string, val: string) => {
    setMultiAnswers((p) => {
      const cur = p[id] || [];
      return {
        ...p,
        [id]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val],
      };
    });
  };

  const isValid = data.questions
    .filter((q) => q.required)
    .every((q) =>
      q.type === "multi_select"
        ? (multiAnswers[q.id] || []).length > 0
        : (answers[q.id] || "").trim().length > 0
    );

  const handleSubmit = () => {
    const combined: Record<string, string> = { ...answers };
    Object.entries(multiAnswers).forEach(([k, v]) => {
      if (v.length > 0) combined[k] = v.join(", ");
    });
    onSubmit(combined, { documentType: data.documentType, suggestedTitle: data.suggestedTitle });
  };

  return (
    <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-sm text-amber-900 dark:text-amber-300">Nyaya AI</span>
          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Drafting Mode
          </Badge>
        </div>

        <p className="text-sm text-foreground mb-4 leading-relaxed">
          Sure! To draft your{" "}
          <span className="font-medium text-amber-800 dark:text-amber-300">{data.documentType}</span>,
          I need a few details:
        </p>

        {submitted ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Answers submitted — generating your draft below.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {data.questions.map((q) => (
                <div key={q.id}>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1">
                    {q.label}
                    {q.required && <span className="text-destructive text-[10px]">*</span>}
                  </label>
                  {q.hint && (
                    <p className="text-[11px] text-muted-foreground mb-1.5">{q.hint}</p>
                  )}

                  {q.type === "text" && (
                    <Input
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="h-8 text-sm"
                      disabled={isGenerating}
                      data-testid={`input-draft-${q.id}`}
                    />
                  )}

                  {q.type === "textarea" && (
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="text-sm min-h-[80px] resize-none"
                      disabled={isGenerating}
                      data-testid={`textarea-draft-${q.id}`}
                    />
                  )}

                  {q.type === "select" && (
                    <Select
                      value={answers[q.id] || ""}
                      onValueChange={(v) => setAnswer(q.id, v)}
                      disabled={isGenerating}
                    >
                      <SelectTrigger className="h-8 text-sm" data-testid={`select-draft-${q.id}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {q.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {q.type === "radio" && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options?.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={isGenerating}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                            answers[q.id] === opt
                              ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                              : "border-muted-foreground/30 hover:border-amber-400 hover:text-amber-700"
                          }`}
                          onClick={() => setAnswer(q.id, opt)}
                          data-testid={`radio-draft-${q.id}-${opt}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === "multi_select" && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options?.map((opt) => {
                        const selected = (multiAnswers[q.id] || []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={isGenerating}
                            className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                              selected
                                ? "bg-amber-100 border-amber-500 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "border-muted-foreground/30 hover:border-amber-400"
                            }`}
                            onClick={() => toggleMulti(q.id, opt)}
                            data-testid={`multi-draft-${q.id}-${opt}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-5 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSubmit}
              disabled={!isValid || isGenerating}
              data-testid="button-generate-draft"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Draft...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Draft
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DraftOutputCard({ data }: { data: DraftOutputData }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showingTrainedStyle, setShowingTrainedStyle] = useState(false);
  const [trainedContent, setTrainedContent] = useState<string | null>(null);
  const [isApplyingStyle, setIsApplyingStyle] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  const { data: trainingDocs = [] } = useQuery<unknown[]>({
    queryKey: ["/api/training-docs"],
  });
  const hasTrainedStyle = Array.isArray(trainingDocs) && trainingDocs.length > 0;
  const displayContent = showingTrainedStyle && trainedContent ? trainedContent : data.htmlContent;

  const handleEdit = () => {
    sessionStorage.setItem("nyaya_open_draft_id", data.draftId);
    setLocation("/hub/drafting/ai");
  };

  const handleDownload = () => {
    const parsed = new DOMParser().parseFromString(displayContent, "text/html");
    const text = parsed.body.textContent || "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.replace(/[^a-zA-Z0-9\s]/g, "").trim() || "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUseTrainedStyle = async () => {
    if (!hasTrainedStyle) {
      toast({
        title: "No trained documents",
        description: "Upload documents in the Training section to use firm style.",
        variant: "destructive",
      });
      return;
    }
    if (showingTrainedStyle) {
      setShowingTrainedStyle(false);
      return;
    }
    setIsApplyingStyle(true);
    try {
      const response = await authFetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data.generationParams, useFirmStyle: true }),
      });
      const result = await response.json();
      if (result.content) {
        setTrainedContent(markdownToHtml(result.content));
        setShowingTrainedStyle(true);
      }
    } catch {
      toast({ title: "Failed to apply trained style", variant: "destructive" });
    } finally {
      setIsApplyingStyle(false);
    }
  };

  return (
    <Card className="border-green-200/60 dark:border-green-900/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-900 dark:text-amber-300">Nyaya AI</span>
            <Badge
              variant="secondary"
              className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            >
              Draft Generated
            </Badge>
          </div>
          {showingTrainedStyle && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-400"
            >
              Firm Style Applied
            </Badge>
          )}
        </div>

        <div className="border rounded-md overflow-hidden mb-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium truncate">{data.title}</span>
          </div>
          <div
            className="p-4 prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed max-h-[400px] overflow-auto"
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleEdit}
            data-testid="button-draft-edit"
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            data-testid="button-draft-download"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsSaved(true);
              toast({
                title: "Draft saved",
                description: "You can find it in the Drafting section.",
              });
            }}
            data-testid="button-draft-save"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                Saved in Drafts
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant={showingTrainedStyle ? "default" : "outline"}
            className={
              showingTrainedStyle
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : ""
            }
            onClick={handleUseTrainedStyle}
            disabled={isApplyingStyle}
            data-testid="button-draft-trained-style"
            title={!hasTrainedStyle ? "Upload training documents in the Training section first" : undefined}
          >
            {isApplyingStyle ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Applying...
              </>
            ) : showingTrainedStyle ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Discard Trained Style
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Use Trained Style
              </>
            )}
          </Button>
        </div>

        {!hasTrainedStyle && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Upload training documents in the Training section to apply your firm&apos;s style.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function NyayaAIPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDraftGenerating, setIsDraftGenerating] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ChatSession[]>({
    queryKey: ["/api/chat/sessions"],
  });

  const nyayaSessions = sessions.filter((s) => s.sessionType === "nyaya");

  const createSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/chat/sessions", {
        title,
        sessionType: "nyaya",
      });
      return response.json() as Promise<ChatSession>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/chat/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append("files", f));
      const response = await authFetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const docs = await response.json();
        const newFiles: UploadedFile[] = docs
          .filter((d: { id: string; status?: string }) => d.id && d.status !== "error")
          .map((d: { id: string; name?: string }, i: number) => ({
            id: d.id,
            name: fileList[i]?.name || d.name || `Document ${i + 1}`,
          }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        if (newFiles.length === 0) {
          toast({
            title: "Some files could not be read",
            description: "Only PDF, DOCX, and TXT files are fully supported.",
          });
        }
      }
    } catch {
      toast({ title: "File upload failed", variant: "destructive" });
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUploadedFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDraftSubmit = async (
    answers: Record<string, string>,
    context: { documentType: string; suggestedTitle: string }
  ) => {
    setIsDraftGenerating(true);

    setMessages((prev) =>
      prev.map((m) =>
        m.type === "draft_questions" && !m.submitted ? { ...m, submitted: true } : m
      )
    );

    try {
      const jurisdiction =
        answers["jurisdiction"] || answers["court"] || "Delhi High Court";
      const parties =
        answers["parties"] ||
        [answers["parties_sender"], answers["parties_recipient"]]
          .filter(Boolean)
          .join(" and ") ||
        answers["party_a"] ||
        "";
      const factsChunks = [
        answers["facts"] || answers["background"] || answers["key_facts"] || "",
        answers["relief"] ? `Relief sought: ${answers["relief"]}` : "",
        answers["offence"] ? `Offence: ${answers["offence"]}` : "",
        answers["purpose"] ? `Purpose: ${answers["purpose"]}` : "",
        Object.entries(answers)
          .filter(
            ([k]) =>
              ![
                "jurisdiction",
                "court",
                "parties",
                "parties_sender",
                "parties_recipient",
                "party_a",
                "party_b",
                "facts",
                "background",
                "key_facts",
                "relief",
                "language",
                "offence",
                "purpose",
              ].includes(k)
          )
          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
          .join("\n"),
      ].filter(Boolean);

      const facts = factsChunks.join("\n\n");
      const language = answers["language"] || "English";

      const generationParams: Record<string, string> = {
        type: context.documentType.toLowerCase().replace(/\s+/g, "_"),
        title: context.suggestedTitle,
        facts,
        parties,
        jurisdiction,
        language,
        additionalInfo: answers["additional_requirements"] || answers["additional"] || "",
      };

      const response = await authFetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generationParams),
      });
      const draft = await response.json();

      if (!draft || (!draft.content && !draft.id)) {
        throw new Error("Empty draft response");
      }

      const htmlContent = markdownToHtml(draft.content || "");

      const outputMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "",
        type: "draft_output",
        draftOutputData: {
          title: draft.title || context.suggestedTitle,
          htmlContent,
          originalHtmlContent: htmlContent,
          draftId: draft.id,
          documentType: context.documentType,
          generationParams,
        },
      };
      setMessages((prev) => [...prev, outputMsg]);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    } catch (err) {
      console.error("Draft generation error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content:
            "Sorry, I encountered an error generating the draft. Please try again or use the full Drafting tool.",
          type: "chat",
        },
      ]);
    } finally {
      setIsDraftGenerating(false);
    }
  };

  const handleSend = async (message?: string) => {
    const query = message || input.trim();
    if (!query || isLoading || isDraftGenerating) return;

    let sessionId = currentSessionId;
    if (!sessionId && messages.length === 0) {
      const session = await createSessionMutation.mutateAsync(
        query.substring(0, 50) + "..."
      );
      sessionId = session.id;
      setCurrentSessionId(session.id);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      type: "chat",
      attachedFiles: uploadedFiles.map((f) => f.name),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const draftingVerbs =
      /\b(draft|write|prepare|create|generate|compose|draw up|help me draft|help me write|make me a)\b/i;
    const legalDocNouns =
      /\b(notice|petition|contract|agreement|application|affidavit|bail|writ|reply|plaint|complaint|nda|deed|lease|mou|letter of intent|will|trust|power of attorney|suit|plaint|indemnity|guarantee|injunction|memorandum|resolution|employment agreement|rental agreement|loan agreement)\b/i;
    const isPotentialDraft = draftingVerbs.test(query) && legalDocNouns.test(query);

    if (isPotentialDraft) {
      try {
        const detectRes = await authFetch("/api/nyaya/detect-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: query }),
        });
        const detectData = await detectRes.json();

        if (detectData.isDraft && detectData.questions?.length > 0) {
          const questionsMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "",
            type: "draft_questions",
            draftQuestionsData: {
              documentType: detectData.documentType,
              suggestedTitle: detectData.suggestedTitle,
              questions: detectData.questions,
            },
            submitted: false,
          };
          setMessages((prev) => [...prev, questionsMsg]);
          setIsLoading(false);
          return;
        }
      } catch {
        // Fall through to normal chat
      }
    }

    const documentIds = uploadedFiles.map((f) => f.id);

    try {
      const response = await authFetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          sessionId,
          documentIds: documentIds.length > 0 ? documentIds : undefined,
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Partial<Message> = {};

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", type: "chat" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  )
                );
              }
              if (data.done) {
                metadata = {
                  modelUsed: data.modelUsed || "standard",
                  confidence: data.confidence || 0.85,
                  cost: data.cost || 0.4,
                  citations: data.citations || [],
                };
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...metadata } : m))
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
          type: "chat",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSession = async (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setShowHistoryDialog(false);
    try {
      const response = await authFetch(`/api/chat/sessions/${session.id}/messages`);
      if (response.ok) {
        const sessionMessages = await response.json();
        setMessages(
          sessionMessages.map(
            (m: {
              id: string;
              role: string;
              content: string;
              modelUsed?: string;
              confidence?: number;
              cost?: number;
              citations?: string | Citation[];
            }) => {
              let parsedCitations: Citation[] = [];
              if (m.citations) {
                if (typeof m.citations === "string") {
                  try {
                    parsedCitations = JSON.parse(m.citations);
                  } catch {
                    parsedCitations = [];
                  }
                } else if (Array.isArray(m.citations)) {
                  parsedCitations = m.citations;
                }
              }
              return {
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                type: "chat" as const,
                modelUsed: m.modelUsed as ModelTier | undefined,
                confidence: m.confidence,
                citations: parsedCitations,
              };
            }
          )
        );
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setUploadedFiles([]);
  };

  return (
    <div className="h-full flex flex-col">
      {!voiceMode && (
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton />
            <div className="p-2 rounded-md bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-500 shadow-sm shadow-amber-400/30">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-amber-900 dark:text-amber-300">Nyaya AI</h1>
              <p className="text-xs text-amber-700/70 dark:text-amber-500">
                Your intelligent legal assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVoiceMode(true)}
              data-testid="button-enable-voice"
            >
              <Mic className="h-4 w-4 mr-2" />
              Voice Mode
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryDialog(true)}
              data-testid="button-history"
            >
              <History className="h-4 w-4 mr-2" />
              Previous Chats
            </Button>
          </div>
        </div>
      )}

      {voiceMode ? (
        <VoiceAssistant onClose={() => setVoiceMode(false)} />
      ) : (
        <>
          <div className="flex-1 flex overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8">
                  <Scale className="h-16 w-16 mb-6 text-amber-400/50" />
                  <h2 className="text-xl font-semibold mb-2">Welcome to Nyaya AI</h2>
                  <p className="text-muted-foreground text-center max-w-md mb-4 text-sm">
                    Ask any legal question and get accurate, citation-backed answers instantly.
                    Trained on Indian law, statutes, case precedents and live legal sources. Also
                    drafts legal documents on request.
                  </p>

                  <Card className="max-w-md mb-8 border-amber-300/40 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-transparent dark:from-amber-950/30">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground italic text-center">
                        This AI provides legal research and information. No legal opinion or advice
                        is provided. Always consult a qualified legal professional.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="w-full max-w-2xl">
                    <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                      Try These Sample Questions
                    </h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      {sampleQuestions.map((q, i) => (
                        <Card
                          key={i}
                          className="hover-elevate cursor-pointer"
                          onClick={() => handleSend(q.label)}
                          data-testid={`card-sample-${i}`}
                        >
                          <CardContent className="p-3 flex items-start gap-2">
                            <q.icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm">{q.label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 max-w-3xl mx-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={msg.role === "user" ? "flex justify-end" : ""}
                    >
                      {msg.role === "user" ? (
                        <div className="bg-primary text-primary-foreground p-4 rounded-lg max-w-[80%]">
                          <p className="text-sm">{msg.content}</p>
                          {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {msg.attachedFiles.map((name, i) => (
                                <span
                                  key={i}
                                  className="flex items-center gap-1 text-[10px] bg-primary-foreground/20 rounded px-1.5 py-0.5"
                                >
                                  <FileText className="h-2.5 w-2.5" />
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : msg.type === "draft_questions" && msg.draftQuestionsData ? (
                        <div className="w-full">
                          <DraftQuestionsCard
                            data={msg.draftQuestionsData}
                            messageId={msg.id}
                            submitted={msg.submitted}
                            onSubmit={handleDraftSubmit}
                            isGenerating={isDraftGenerating}
                          />
                        </div>
                      ) : msg.type === "draft_output" && msg.draftOutputData ? (
                        <div className="w-full">
                          <DraftOutputCard data={msg.draftOutputData} />
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Scale className="h-4 w-4 text-amber-600" />
                              <span className="font-medium text-sm text-amber-900 dark:text-amber-300">
                                Nyaya AI
                              </span>
                              {msg.confidence && (
                                <ConfidenceIndicator
                                  value={msg.confidence}
                                  showLabel={false}
                                />
                              )}
                            </div>
                            <div className="mb-3 p-2 rounded bg-amber-50/50 border-l-2 border-amber-500 dark:bg-amber-950/30">
                              <p className="text-[10px] text-muted-foreground italic">
                                This research compiles judicial decisions and statutory provisions.
                                No legal opinion or advice is provided.
                              </p>
                            </div>
                            <div
                              className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: markdownToHtml(msg.content),
                              }}
                            />
                            {msg.citations &&
                              Array.isArray(msg.citations) &&
                              msg.citations.length > 0 && (
                                <div className="mt-4 pt-4 border-t space-y-2">
                                  <h4 className="text-xs font-medium text-muted-foreground">
                                    Sources
                                  </h4>
                                  {msg.citations.map((cite) => (
                                    <CitationCard key={cite.id} citation={cite} />
                                  ))}
                                </div>
                              )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}

                  {(isLoading || isDraftGenerating) && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 animate-pulse text-amber-500 shrink-0" />
                          <AiThinkingText />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="p-4 border-t">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 max-w-3xl mx-auto">
                {uploadedFiles.map((f) => (
                  <span
                    key={f.id}
                    className="flex items-center gap-1.5 text-xs bg-muted rounded-full px-2.5 py-1 border"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeUploadedFile(f.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                      data-testid={`button-remove-file-${f.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="max-w-3xl mx-auto flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
                data-testid="input-file-nyaya"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploadingFile || isDraftGenerating}
                title="Attach files for context"
                data-testid="button-attach-file"
              >
                {isUploadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Input
                placeholder="Ask a legal question or request a draft..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={isLoading || isDraftGenerating}
                data-testid="input-nyaya"
                className="flex-1"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || isDraftGenerating || !input.trim()}
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Previous Chats
            </DialogTitle>
            <DialogDescription>
              Continue a previous conversation or start a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Button
              onClick={handleNewChat}
              variant="outline"
              className="w-full"
              data-testid="button-new-chat"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Start New Chat
            </Button>

            {sessionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <StreamingIndicator />
              </div>
            ) : nyayaSessions.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No previous chats found</p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {nyayaSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="hover-elevate cursor-pointer group"
                      onClick={() => handleOpenSession(session)}
                      data-testid={`card-session-${session.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium truncate">{session.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(session.updatedAt), {
                                  addSuffix: true,
                                })}
                              </span>
                              {session.messageCount != null && session.messageCount > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {session.messageCount} messages
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSessionMutation.mutate(session.id);
                            }}
                            data-testid={`button-delete-${session.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
