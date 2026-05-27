import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AiThinkingText } from "@/components/ai-thinking-text";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadDropzone } from "@/components/upload-dropzone";
import { StreamingIndicator } from "@/components/streaming-text";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { CitationCard } from "@/components/citation-card";
import {
  FileText,
  Send,
  Upload,
  Calendar,
  ListChecks,
  Lightbulb,
  Clock,
  Scale,
  Search,
  MessageSquare,
  Sparkles,
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Save,
  Loader2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authFetch, queryClient } from "@/lib/queryClient";
import { markdownToHtml } from "@/lib/utils";
import type { ChatSession, ModelTier, Citation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type RightPanel = "doc" | "nyaya" | "notes";

interface PageRef {
  page: number;
  refText?: string;
}

function parseAndCleanContent(raw: string): { clean: string; pageRefs: PageRef[] } {
  const refs: PageRef[] = [];
  const seen = new Set<number>();

  let clean = raw.replace(
    /([^.!?\n]{0,160}?)\s*\[Pages?\s*(\d+)(?:\s*[-–]\s*(\d+))?\]/gi,
    (_, ctx, p1, p2) => {
      const start = parseInt(p1);
      const end = p2 ? parseInt(p2) : start;
      const refText = (ctx || "").trim().slice(-90);
      for (let p = start; p <= Math.min(end, 9999); p++) {
        if (!seen.has(p)) { seen.add(p); refs.push({ page: p, refText }); }
      }
      return ctx || "";
    }
  );

  clean = clean.replace(/\(Pages?\s*(\d+)(?:\s*[-–]\s*(\d+))?\)/gi, (_, p1, p2) => {
    const start = parseInt(p1);
    const end = p2 ? parseInt(p2) : start;
    for (let p = start; p <= Math.min(end, 9999); p++) {
      if (!seen.has(p)) { seen.add(p); refs.push({ page: p }); }
    }
    return "";
  });

  refs.sort((a, b) => a.page - b.page);
  // Preserve newlines — only collapse multiple horizontal spaces on the same line
  return { clean: clean.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), pageRefs: refs };
}

function HighlightedPageText({ text, highlight }: { text: string; highlight: string }) {
  if (!text) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/25 mb-3" />
        <p className="text-sm text-muted-foreground">No text content for this page</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          This may be a scanned image — the original file is preserved above.
        </p>
      </div>
    );
  }

  const searchTerm = highlight && highlight.length >= 4 ? highlight.slice(0, 80) : null;
  let regex: RegExp | null = null;
  if (searchTerm) {
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(`(${escaped})`, "gi");
    } catch {
      regex = null;
    }
  }

  function applyHighlight(chunk: string): JSX.Element[] {
    if (!regex || !searchTerm) return [<span key="0">{chunk}</span>];
    const parts = chunk.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 dark:bg-amber-700/60 text-inherit rounded-sm px-0.5 py-px">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className="text-sm leading-relaxed space-y-3 font-sans">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        return (
          <p key={pi} className="text-foreground">
            {lines.map((line, li) => (
              <span key={li}>
                {applyHighlight(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, (match) => match);
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pageRefs?: PageRef[];
}

interface NyayaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  selectedText?: string;
  modelUsed?: ModelTier;
  confidence?: number;
  cost?: number;
  citations?: Citation[];
}

interface UploadedDoc {
  id: string;
  name: string;
  pages: number;
  status: "processing" | "ready";
  content?: string;
  type?: string;     // mime type — determines whether to show native iframe viewer
  hasFile?: boolean; // true when /api/documents/:id/file will serve the raw file
}

function getAuthToken(): string {
  return sessionStorage.getItem("chakshi_token") || "";
}

function buildFileUrl(docId: string): string {
  const token = getAuthToken();
  return token
    ? `/api/documents/${docId}/file?token=${encodeURIComponent(token)}`
    : `/api/documents/${docId}/file`;
}

function isNativeViewable(type?: string): boolean {
  if (!type) return false;
  return type.includes("pdf") || type.startsWith("image/");
}

interface SelectionPosition {
  x: number;
  y: number;
  text: string;
}

interface PdfNote {
  id: string;
  content: string;
  createdAt: Date;
}

type ViewMode = "list" | "chat";

export default function ChatWithPDFPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [sessionDocumentIds, setSessionDocumentIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [nyayaMessages, setNyayaMessages] = useState<NyayaMessage[]>([]);
  const [nyayaInput, setNyayaInput] = useState("");
  const [nyayaLoading, setNyayaLoading] = useState(false);
  const [isFullPageRef, setIsFullPageRef] = useState(false);
  const docPanelRef = useRef<HTMLDivElement>(null);
  const [nyayaSessionId, setNyayaSessionId] = useState<string | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<SelectionPosition | null>(null);

  const [rightPanel, setRightPanel] = useState<RightPanel>("doc");
  const [activeDocPage, setActiveDocPage] = useState(1);
  const [highlightText, setHighlightText] = useState("");

  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesTab, setNotesTab] = useState<"write" | "saved">("write");
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(42); // % of main area width
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const isDraggingDivider = useRef(false);
  
  const [showNyayaPromptDialog, setShowNyayaPromptDialog] = useState(false);
  const [pendingSelectedText, setPendingSelectedText] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const nyayaMessagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ChatSession[]>({
    queryKey: ["/api/chat/sessions"],
  });

  const pdfSessions = sessions.filter((s) => s.sessionType === "chatwithpdf");

  const createSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/chat/sessions", {
        title,
        sessionType: "chatwithpdf",
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

  const currentDocName = uploadedDocs.length > 0 ? uploadedDocs[0].name : "Document";

  const createNyayaSessionMutation = useMutation({
    mutationFn: async (parentId: string) => {
      const docName = currentDocName.length > 25 ? currentDocName.slice(0, 25) + "..." : currentDocName;
      const sessionTitle = `DocuChat: ${docName}`;
      const response = await apiRequest("POST", "/api/chat/sessions", {
        title: sessionTitle,
        sessionType: "nyaya",
        parentSessionId: parentId,
      });
      return response.json() as Promise<ChatSession>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-scroll to highlighted text in doc panel when a page ref is clicked
  useEffect(() => {
    if (!highlightText || highlightText.length < 4) return;
    const timer = setTimeout(() => {
      const mark = docPanelRef.current?.querySelector("mark");
      mark?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(timer);
  }, [activeDocPage, highlightText]);

  // Load notes from localStorage when session changes
  useEffect(() => {
    if (!currentSessionId) return;
    try {
      const raw = localStorage.getItem(`docuchat-notes-${currentSessionId}`);
      const parsed: PdfNote[] = raw ? JSON.parse(raw).map((n: { id: string; content: string; createdAt: string | Date }) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      })) : [];
      setNotes(parsed);
    } catch {
      setNotes([]);
    }
    setNotesLoaded(true);
  }, [currentSessionId]);

  // Persist notes to localStorage on every change
  useEffect(() => {
    if (!currentSessionId || !notesLoaded) return;
    try {
      localStorage.setItem(`docuchat-notes-${currentSessionId}`, JSON.stringify(notes));
    } catch {
      // localStorage quota exceeded — fail silently
    }
  }, [notes, currentSessionId, notesLoaded]);

  const handleSaveNote = () => {
    if (!newNote.trim()) return;
    const note: PdfNote = {
      id: Date.now().toString(),
      content: newNote.trim(),
      createdAt: new Date(),
    };
    setNotes(prev => [note, ...prev]);
    setNewNote("");
    setNotesTab("saved");
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !chatContainerRef.current) {
      setSelectionPosition(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      setSelectionPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    
    if (!chatContainerRef.current.contains(range.commonAncestorContainer)) {
      setSelectionPosition(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = chatContainerRef.current.getBoundingClientRect();

    setSelectionPosition({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 40,
      text: selectedText,
    });
  }, []);

  useEffect(() => {
    if (viewMode !== "chat") return;

    const handleMouseUp = (e: MouseEvent) => {
      if (chatContainerRef.current?.contains(e.target as Node)) {
        setTimeout(handleTextSelection, 10);
      } else {
        setSelectionPosition(null);
      }
    };

    const handleMouseDown = () => {
      setSelectionPosition(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [handleTextSelection, viewMode]);

  const scrollNyayaToBottom = () => {
    nyayaMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollNyayaToBottom();
  }, [nyayaMessages]);

  const handleDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // let collapse button handle its own click
    e.preventDefault();
    isDraggingDivider.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handleDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingDivider.current || !mainAreaRef.current) return;
    const rect = mainAreaRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPanelWidth(Math.min(72, Math.max(28, pct)));
  };

  const handleDividerPointerUp = () => { isDraggingDivider.current = false; };

  const handleAskNyayaAI = (selectedText?: string) => {
    const query = selectedText || selectionPosition?.text;
    if (!query) return;
    
    setPendingSelectedText(query);
    setNyayaInput("");
    setShowNyayaPromptDialog(true);
    setSelectionPosition(null);
    window.getSelection()?.removeAllRanges();
  };
  
  const handleSendNyayaPrompt = async () => {
    if (!pendingSelectedText) return;
    
    const customQuestion = nyayaInput.trim();
    const fullMessage = customQuestion 
      ? `Regarding this text from my document: "${pendingSelectedText}"\n\n${customQuestion}`
      : `Regarding this text from my document: "${pendingSelectedText}"\n\nPlease provide legal analysis and explanation.`;
    
    setShowNyayaPromptDialog(false);
    setRightPanel("nyaya");
    setNyayaInput("");

    let sessionId = nyayaSessionId;

    if (!sessionId && currentSessionId) {
      const session = await createNyayaSessionMutation.mutateAsync(currentSessionId);
      sessionId = session.id;
      setNyayaSessionId(session.id);
    }

    const userMsg: NyayaMessage = {
      id: Date.now().toString(),
      role: "user",
      content: fullMessage,
      selectedText: pendingSelectedText,
    };
    setNyayaMessages((prev) => [...prev, userMsg]);
    setNyayaLoading(true);
    setPendingSelectedText("");
    
    if (sessionId) {
      authFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "user", content: fullMessage }),
      }).catch(console.error);
    }

    try {
      // Pass the document IDs so Nyaya AI has the same document context.
      // The server applies smart truncation (80 K chars, beginning+middle+end
      // for large docs) so even 800-page files stay within token limits.
      const nyayaDocIds = sessionDocumentIds.length > 0
        ? sessionDocumentIds
        : uploadedDocs.map(d => d.id).filter(id => !id.startsWith("temp-"));

      const response = await authFetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          sessionId,
          documentIds: nyayaDocIds.length > 0 ? nyayaDocIds : undefined,
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Partial<NyayaMessage> = {};

      const assistantId = (Date.now() + 1).toString();
      setNyayaMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
                setNyayaMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: stripMarkdown(fullContent) } : m))
                );
              }
              if (data.done) {
                metadata = {
                  modelUsed: data.modelUsed || "standard",
                  confidence: data.confidence || 0.85,
                  cost: data.cost || 0.40,
                  citations: data.citations || [],
                };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      setNyayaMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: stripMarkdown(fullContent), ...metadata } : m))
      );
      
      if (sessionId && fullContent) {
        authFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, role: "assistant", content: fullContent }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Nyaya AI error:", error);
      setNyayaMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setNyayaLoading(false);
    }
  };

  const handleNyayaSend = async () => {
    if (!nyayaInput.trim() || nyayaLoading) return;

    let sessionId = nyayaSessionId;
    const messageContent = nyayaInput;

    if (!sessionId && currentSessionId) {
      const session = await createNyayaSessionMutation.mutateAsync(currentSessionId);
      sessionId = session.id;
      setNyayaSessionId(session.id);
    }

    const userMsg: NyayaMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
    };
    setNyayaMessages((prev) => [...prev, userMsg]);
    setNyayaInput("");
    setNyayaLoading(true);
    
    if (sessionId) {
      authFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "user", content: messageContent }),
      }).catch(console.error);
    }

    try {
      const nyayaDocIds = sessionDocumentIds.length > 0
        ? sessionDocumentIds
        : uploadedDocs.map(d => d.id).filter(id => !id.startsWith("temp-"));

      const response = await authFetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          sessionId,
          documentIds: nyayaDocIds.length > 0 ? nyayaDocIds : undefined,
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Partial<NyayaMessage> = {};

      const assistantId = (Date.now() + 1).toString();
      setNyayaMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
                setNyayaMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: stripMarkdown(fullContent) } : m))
                );
              }
              if (data.done) {
                metadata = {
                  modelUsed: data.modelUsed || "standard",
                  confidence: data.confidence || 0.85,
                  cost: data.cost || 0.40,
                  citations: data.citations || [],
                };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      setNyayaMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: stripMarkdown(fullContent), ...metadata } : m))
      );
      
      if (sessionId && fullContent) {
        authFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, role: "assistant", content: fullContent }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Nyaya AI error:", error);
      setNyayaMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setNyayaLoading(false);
    }
  };

  const pollDocRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollDocumentStatus = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    const check = async () => {
      const stillPending: string[] = [];
      for (const id of ids) {
        try {
          const res = await authFetch(`/api/documents/${id}`);
          if (!res.ok) { stillPending.push(id); continue; }
          const doc = await res.json();
          if (doc.status === "completed" || doc.status === "ready") {
            setUploadedDocs(prev =>
              prev.map(d => d.id === id ? { ...d, status: "ready" as const, pages: doc.pages || d.pages, content: doc.extractedText || d.content, type: doc.type || d.type, hasFile: !!doc.storagePath } : d)
            );
          } else if (doc.status === "failed") {
            setUploadedDocs(prev =>
              prev.map(d => d.id === id ? { ...d, status: "ready" as const } : d)
            );
            toast({ title: "Processing issue", description: `${doc.name}: text extraction encountered an error. Chat may be limited.`, variant: "destructive" });
          } else {
            stillPending.push(id);
          }
        } catch {
          stillPending.push(id);
        }
      }
      if (stillPending.length > 0) {
        pollDocRef.current = setTimeout(() => pollDocumentStatus(stillPending), 2000);
      }
    };
    check();
  }, [toast]);

  const handleFilesSelected = async (files: File[]) => {
    if (pollDocRef.current) { clearTimeout(pollDocRef.current); pollDocRef.current = null; }

    const tempDocs: UploadedDoc[] = files.map((file, i) => ({
      id: `temp-${Date.now()}-${i}`,
      name: file.name,
      pages: 0,
      status: "processing" as const,
    }));
    setUploadedDocs(tempDocs);
    setIsUploadingDocs(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await authFetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let errMsg = "Document upload failed. Please try again.";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch { if (errText.length < 120) errMsg = errText || errMsg; }
        throw new Error(errMsg);
      }

      const uploadedDocuments = await response.json();
      const initialDocs = uploadedDocuments.map((doc: { id: string; name: string; pages: number; status?: string; type?: string }) => ({
        id: doc.id,
        name: doc.name,
        pages: doc.pages || 0,
        status: (doc.status === "completed" ? "ready" : "processing") as "ready" | "processing",
        content: "",
        type: doc.type,
        hasFile: true, // server always saves file to disk in Phase 1 now
      }));
      setUploadedDocs(initialDocs);
      setIsUploadingDocs(false);

      const pendingIds = initialDocs.filter((d: UploadedDoc) => d.status === "processing").map((d: UploadedDoc) => d.id);
      if (pendingIds.length > 0) {
        pollDocumentStatus(pendingIds);
      }
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error instanceof Error ? error.message : "Document upload failed. Please try again.";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
      setUploadedDocs([]);
      setIsUploadingDocs(false);
    }
  };

  const handleStartChat = async () => {
    if (uploadedDocs.length === 0) return;
    
    const title = uploadedDocs.length === 1 
      ? `Chat: ${uploadedDocs[0].name}` 
      : `Chat: ${uploadedDocs.length} documents`;
    
    const documentIds = uploadedDocs.map(d => d.id).filter(id => !id.startsWith("temp-"));
    
    if (documentIds.length === 0) {
      toast({
        title: "Upload not complete",
        description: "Please wait for the document to finish uploading, or re-upload it.",
        variant: "destructive",
      });
      return;
    }
    
    setIsStartingChat(true);
    
    try {
      const response = await apiRequest("POST", "/api/chat/sessions", {
        title,
        sessionType: "chatwithpdf",
        documentIds,
      });
      
      const session = await response.json() as ChatSession;
      
      setMessages([]);
      setNyayaMessages([]);
      setNyayaSessionId(null);
      setActiveDocPage(1);
      setHighlightText("");
      setSessionDocumentIds(documentIds);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      setCurrentSessionId(session.id);
      setShowUploadDialog(false);
      setViewMode("chat");
    } catch (error) {
      console.error("Error starting chat:", error);
      const msg = error instanceof Error ? error.message : "Failed to start chat. Please try again.";
      toast({ title: "Failed to start chat", description: msg, variant: "destructive" });
    } finally {
      setIsStartingChat(false);
    }
  };

  const currentDocs = uploadedDocs;

  const handleOpenSession = async (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages([]);
    setNyayaMessages([]);
    setNyayaSessionId(null);
    setUploadedDocs([]);    // clear immediately so stale docs never leak into handleSend
    setActiveDocPage(1);
    setHighlightText("");
    setViewMode("chat");
    
    const docIds = session.documentIds || [];
    setSessionDocumentIds(docIds);
    
    try {
      const messagesResponse = await authFetch(`/api/chat/sessions/${session.id}/messages`);
      if (messagesResponse.ok) {
        const loadedMessages = await messagesResponse.json();
        setMessages(loadedMessages.map((m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        })));
      }
    } catch (error) {
      console.error("Error loading session messages:", error);
    }
    
    const nyayaSession = sessions.find(
      (s) => s.sessionType === "nyaya" && s.parentSessionId === session.id
    );
    if (nyayaSession) {
      setNyayaSessionId(nyayaSession.id);
      try {
        const nyayaMessagesResponse = await authFetch(`/api/chat/sessions/${nyayaSession.id}/messages`);
        if (nyayaMessagesResponse.ok) {
          const loadedNyayaMessages = await nyayaMessagesResponse.json();
          setNyayaMessages(loadedNyayaMessages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })));
        }
      } catch (error) {
        console.error("Error loading Nyaya AI messages:", error);
      }
    }
    
    if (docIds.length > 0) {
      try {
        const docs = await Promise.all(
          docIds.map(async (docId) => {
            const response = await authFetch(`/api/documents/${docId}`);
            if (response.ok) {
              return response.json();
            }
            return null;
          })
        );
        const validDocs = docs.filter((d) => d !== null);
        setUploadedDocs(
          validDocs.map((doc: { id: string; name: string; pages: number; extractedText?: string; type?: string; storagePath?: string }) => ({
            id: doc.id,
            name: doc.name,
            pages: doc.pages || 0,
            status: "ready" as const,
            content: doc.extractedText || "",
            type: doc.type,
            hasFile: !!doc.storagePath,
          }))
        );
      } catch (error) {
        console.error("Error loading session documents:", error);
      }
    } else {
      setUploadedDocs([]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    const userQuestion = input;
    setInput("");
    setIsLoading(true);

    if (currentSessionId) {
      fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, role: "user", content: userQuestion }),
      }).catch(console.error);
    }

    try {
      // sessionDocumentIds is set synchronously when a session is opened/created,
      // so it is always the authoritative source. Fall back to uploadedDocs only when
      // a brand-new session has just been created and sessionDocumentIds hasn't propagated yet.
      const documentIds = sessionDocumentIds.length > 0
        ? sessionDocumentIds
        : uploadedDocs.map(d => d.id).filter(id => !id.startsWith("temp-"));

      const response = await authFetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userQuestion,
          sessionId: currentSessionId,
          documentIds,
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
      
      const { clean, pageRefs } = parseAndCleanContent(fullContent);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: clean, pageRefs } : m))
      );

      if (currentSessionId && fullContent) {
        fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, role: "assistant", content: fullContent }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I encountered an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Prepare List of Dates", icon: Calendar, description: "Extract chronological events" },
    { label: "Generate Timeline", icon: Clock, description: "Create a visual timeline" },
    { label: "Find Key Evidence", icon: Lightbulb, description: "Identify important evidence" },
    { label: "Identify Contradictions", icon: Search, description: "Spot inconsistencies" },
  ];

  const features = [
    { title: "800+ Pages Support", description: "Upload large case files and documents", icon: FileText },
    { title: "Timeline Generation", description: "Automatically extract dates and events", icon: Calendar },
    { title: "Issue Tagging", description: "AI-powered legal issue identification", icon: ListChecks },
    { title: "Evidence Finder", description: "Locate key evidence across documents", icon: Lightbulb },
  ];

  const CHARS_PER_PAGE = 3000;
  const rawDocContent = uploadedDocs[0]?.content || "";
  // Strip InLegalBERT analysis header that server prepends — show only the actual document text
  const docContent = rawDocContent
    .replace(/^=== DOCUMENT STRUCTURE \(InLegalBERT Analysis\) ===[\s\S]*?=== END STRUCTURE ===\n*/m, "")
    .trim();
  const docTotalPages = uploadedDocs[0]?.pages || 1;
  const docPages = docContent
    ? Array.from(
        { length: Math.max(1, Math.ceil(docContent.length / CHARS_PER_PAGE)) },
        (_, i) => docContent.slice(i * CHARS_PER_PAGE, (i + 1) * CHARS_PER_PAGE)
      )
    : Array.from({ length: Math.max(1, docTotalPages) }, () => "");
  const hasDocViewer = uploadedDocs.length > 0;

  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <BackButton />
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-md bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">DocuChat</h1>
              <p className="text-xs text-muted-foreground">Upload documents and analyze with AI</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setUploadedDocs([]);
              setShowUploadDialog(true);
            }}
            data-testid="button-upload-pdf"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload & Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-4">What you can do</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {features.map((feature) => (
                  <Card key={feature.title} className="bg-muted/30">
                    <CardContent className="p-4">
                      <feature.icon className="h-6 w-6 text-primary mb-2" />
                      <h3 className="font-medium text-sm">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Previous Chats</h2>
              {sessionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <StreamingIndicator />
                </div>
              ) : pdfSessions.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold mb-2">No Document Chats Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload your first document to start analyzing with AI.
                    </p>
                    <Button
                      onClick={() => {
                        setUploadedDocs([]);
                        setShowUploadDialog(true);
                      }}
                      data-testid="button-upload-first"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pdfSessions.map((session) => {
                    const getFileType = (title: string) => {
                      if (title.toLowerCase().includes('.pdf')) return 'PDF';
                      if (title.toLowerCase().includes('.docx') || title.toLowerCase().includes('.doc')) return 'Word';
                      if (title.toLowerCase().includes('.txt')) return 'TXT';
                      return 'Doc';
                    };
                    const truncateTitle = (title: string, maxLen = 35) => {
                      const cleanTitle = title.replace(/^Chat:\s*/, '');
                      return cleanTitle.length > maxLen ? cleanTitle.slice(0, maxLen) + '...' : cleanTitle;
                    };
                    return (
                    <Card
                      key={session.id}
                      className="hover-elevate cursor-pointer group"
                      onClick={() => handleOpenSession(session)}
                      data-testid={`card-session-${session.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-muted">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-sm truncate max-w-[180px]" title={session.title}>{truncateTitle(session.title)}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">{getFileType(session.title)}</Badge>
                                {(session.messageCount ?? 0) > 0 && (
                                  <span className="text-[10px] text-muted-foreground">{session.messageCount} messages</span>
                                )}
                              </div>
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
                        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}</span>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Documents
              </DialogTitle>
              <DialogDescription>
                Upload PDFs, case files, or evidence folders. DocuChat can analyze up to 800 pages per document with extractive mode.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {isUploadingDocs ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Extracting document text…</p>
                    <p className="text-xs mt-1">This takes a few seconds. Start Chat will enable automatically.</p>
                  </div>
                  {uploadedDocs.length > 0 && (
                    <p className="text-xs text-muted-foreground/70 truncate max-w-[280px]" title={uploadedDocs[0]?.name}>
                      {uploadedDocs[0]?.name}
                    </p>
                  )}
                </div>
              ) : (
                <UploadDropzone
                  onUpload={handleFilesSelected}
                  maxFiles={1}
                  maxSize={200 * 1024 * 1024}
                  maxPages={800}
                  description="Max 800 pages, 200MB per document. One document per session (read-only, extractive mode)."
                />
              )}

              {!isUploadingDocs && uploadedDocs.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  <h4 className="text-sm font-medium">Uploaded Documents</h4>
                  {uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted rounded-md overflow-hidden">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate" title={doc.name}>
                        {doc.name.length > 35 ? doc.name.slice(0, 35) + "..." : doc.name}
                      </span>
                      <Badge variant={doc.status === "ready" ? "outline" : "secondary"} className="text-[10px] shrink-0">
                        {doc.status === "ready" ? "Ready" : doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="flex-1 shrink-0" disabled={isStartingChat || isUploadingDocs}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStartChat}
                  disabled={uploadedDocs.length === 0 || isUploadingDocs || uploadedDocs.some(d => d.status === "processing") || isStartingChat}
                  className="flex-1 shrink-0"
                  data-testid="button-start-chat"
                >
                  {isStartingChat ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting…
                    </>
                  ) : isUploadingDocs ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting…
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Chat
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
    <div className="h-full flex flex-col">
      {/* ── Top bar ── */}
      <div className="p-3 border-b flex items-center justify-between gap-4 flex-wrap bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode("list")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2 rounded-md bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm truncate max-w-[200px]" title={currentDocName}>
              {currentDocName ? (currentDocName.length > 30 ? currentDocName.slice(0, 30) + "…" : currentDocName) : "DocuChat"}
            </h1>
            {uploadedDocs.length > 1 && (
              <p className="text-xs text-muted-foreground">+{uploadedDocs.length - 1} more documents</p>
            )}
          </div>
          {uploadedDocs.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{uploadedDocs.length} doc{uploadedDocs.length > 1 ? "s" : ""}</Badge>
          )}
        </div>

        <div className="flex gap-1.5 items-center">
          {hasDocViewer && (
            <Button
              variant={rightPanel === "doc" && !panelCollapsed ? "default" : "outline"}
              size="sm"
              onClick={() => { setRightPanel("doc"); setPanelCollapsed(false); }}
              data-testid="button-toggle-doc"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Document
            </Button>
          )}
          <Button
            variant={rightPanel === "nyaya" && !panelCollapsed ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (rightPanel === "nyaya" && !panelCollapsed) {
                setPanelCollapsed(true);
              } else {
                setRightPanel("nyaya");
                setPanelCollapsed(false);
              }
            }}
            data-testid="button-toggle-nyaya"
            className={
              rightPanel === "nyaya" && !panelCollapsed
                ? "bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 border-amber-500/50 shadow-md"
                : "border-amber-600/30 text-amber-800 hover:bg-amber-50 hover:border-amber-600/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
            }
          >
            <Scale className="mr-1.5 h-3.5 w-3.5" />
            Nyaya AI
          </Button>
          <Button
            variant={rightPanel === "notes" && !panelCollapsed ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (rightPanel === "notes" && !panelCollapsed) {
                setPanelCollapsed(true);
              } else {
                setRightPanel("notes");
                setPanelCollapsed(false);
              }
            }}
            data-testid="button-toggle-notes"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Notes
          </Button>

        </div>
      </div>

      {/* ── Main area: chat left + resizable divider + right panel ── */}
      <div className="flex-1 flex overflow-hidden" ref={mainAreaRef}>

        {/* LEFT — Chat */}
        <div
          className="flex flex-col overflow-hidden relative"
          style={
            (hasDocViewer || rightPanel !== "doc") && !panelCollapsed
              ? { width: `${leftPanelWidth}%` }
              : { flex: 1 }
          }
          ref={chatContainerRef}
        >
          {selectionPosition && (
            <div
              className="absolute z-50 animate-in fade-in duration-150"
              style={{ left: `${selectionPosition.x}px`, top: `${selectionPosition.y}px`, transform: "translateX(-50%)" }}
            >
              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-500/25 gap-1.5 border border-amber-500/30"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handleAskNyayaAI(selectionPosition.text)}
                data-testid="button-ask-nyaya-floating"
              >
                <Scale className="h-3.5 w-3.5" />
                Ask Nyaya AI
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-medium mb-2">Start a Conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask questions about your documents and get instant AI-powered answers.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    Tip: Select any text in responses and click "Ask Nyaya AI" for legal analysis
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-lg">
                  {quickActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      className="justify-start h-auto py-3 px-4"
                      onClick={() => setInput(action.label)}
                      data-testid={`button-suggestion-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <action.icon className="mr-2 h-4 w-4 text-primary" />
                      <div className="text-left">
                        <div className="text-sm">{action.label}</div>
                        <div className="text-xs text-muted-foreground">{action.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] p-3 rounded-lg ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-sm">{msg.content}</p>
                      ) : (
                        <>
                          <div
                            className="text-sm prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                          />
                          {msg.pageRefs && msg.pageRefs.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">References:</span>
                              {msg.pageRefs.map((ref) => (
                                <button
                                  key={ref.page}
                                  onClick={() => {
                                    setActiveDocPage(ref.page);
                                    setHighlightText(ref.refText || "");
                                    setIsFullPageRef(!ref.refText);
                                    setRightPanel("doc");
                                    setPanelCollapsed(false);
                                  }}
                                  data-testid={`button-page-ref-${ref.page}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                                >
                                  <BookOpen className="h-2.5 w-2.5" />
                                  pg.{ref.page}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg flex items-center gap-2.5 max-w-[85%]">
                      <Sparkles className="h-4 w-4 animate-pulse shrink-0" />
                      <AiThinkingText />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your documents…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                data-testid="input-chat"
              />
              <Button onClick={handleSend} disabled={isLoading} data-testid="button-send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* DIVIDER — drag to resize, centre button collapses/expands right panel */}
        {(hasDocViewer || rightPanel === "nyaya" || rightPanel === "notes") && (
          <div
            className="relative flex-none w-3 cursor-col-resize select-none group z-10"
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onLostPointerCapture={handleDividerPointerUp}
            data-testid="divider-panel-resize"
          >
            {/* Visible line */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-primary/40 transition-colors" />
            {/* Collapse / expand arrow button */}
            <button
              onClick={() => setPanelCollapsed(c => !c)}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-9 rounded-sm bg-background border border-border shadow-sm hover:bg-muted hover:border-primary/40 transition-colors cursor-pointer"
              title={panelCollapsed ? "Expand panel" : "Collapse panel"}
              data-testid="button-toggle-panel-collapse"
            >
              {panelCollapsed
                ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                : <ChevronLeft className="h-3 w-3 text-muted-foreground" />
              }
            </button>
          </div>
        )}

        {/* RIGHT — tabbed panel (Document / Nyaya AI / Notes) */}
        {(hasDocViewer || rightPanel === "nyaya" || rightPanel === "notes") && !panelCollapsed && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── Document viewer ── */}
            {rightPanel === "doc" && hasDocViewer && (() => {
              const currentDoc = uploadedDocs[0];
              const usePdfIframe = !!(currentDoc?.hasFile && isNativeViewable(currentDoc?.type));
              const fileUrl = currentDoc ? buildFileUrl(currentDoc.id) : "";
              const totalPages = usePdfIframe ? (currentDoc?.pages || 1) : docPages.length;
              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="p-3 border-b flex items-center justify-between bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{currentDoc?.name || "Document"}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{totalPages} pg</Badge>
                      {usePdfIframe && (
                        <Badge variant="outline" className="text-[10px] shrink-0 text-primary border-primary/40">Native viewer</Badge>
                      )}
                    </div>
                    {/* Show prev/next only for text view — native PDF viewer has its own controls */}
                    {!usePdfIframe && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={activeDocPage <= 1}
                          onClick={() => { setActiveDocPage((p) => Math.max(1, p - 1)); setHighlightText(""); setIsFullPageRef(false); }}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[52px] text-center tabular-nums">
                          {activeDocPage} / {docPages.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={activeDocPage >= docPages.length}
                          onClick={() => { setActiveDocPage((p) => Math.min(docPages.length, p + 1)); setHighlightText(""); setIsFullPageRef(false); }}
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {usePdfIframe && activeDocPage > 1 && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Jumped to p.{activeDocPage}
                      </span>
                    )}
                  </div>

                  {/* ── Reference banner — blue only, for full-page refs ── */}
                  {isFullPageRef && !highlightText && (
                    <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200/50 dark:border-blue-800/40 flex items-center justify-between shrink-0">
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                        The answer referenced page {activeDocPage} broadly — no specific passage was cited
                      </span>
                      <button
                        onClick={() => setIsFullPageRef(false)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                        data-testid="button-clear-fullpage-ref"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Native PDF / image iframe */}
                  {usePdfIframe && (
                    <div className="flex-1 overflow-hidden">
                      <iframe
                        key={`pdf-${currentDoc!.id}-${activeDocPage}`}
                        src={activeDocPage > 1 ? `${fileUrl}#page=${activeDocPage}` : fileUrl}
                        className="w-full h-full border-none"
                        title={currentDoc!.name}
                        data-testid="iframe-document-viewer"
                      />
                    </div>
                  )}

                  {/* Text viewer — for DOCX or docs without file */}
                  {!usePdfIframe && (
                    <ScrollArea className="flex-1 p-5">
                      <div ref={docPanelRef} className="text-foreground leading-relaxed">
                        <HighlightedPageText
                          text={docPages[activeDocPage - 1] || ""}
                          highlight={highlightText}
                        />
                      </div>
                    </ScrollArea>
                  )}
                </div>
              );
            })()}

            {/* ── Nyaya AI panel ── */}
            {rightPanel === "nyaya" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-amber-50/80 via-orange-50/30 to-background dark:from-amber-950/20 dark:via-background dark:to-background">
                <div className="p-3 border-b border-amber-200/50 flex items-center gap-2 bg-gradient-to-r from-amber-100/80 via-yellow-50/60 to-orange-50/40 dark:from-amber-950/40 dark:via-background dark:to-background shrink-0">
                  <div className="p-1.5 rounded-md bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-500 shadow-sm shadow-amber-400/30">
                    <Scale className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-medium text-sm text-amber-900 dark:text-amber-400">Nyaya AI</span>
                  {nyayaMessages.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{nyayaMessages.length} messages</Badge>
                  )}
                </div>

                <ScrollArea className="flex-1 p-3">
                  {nyayaMessages.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                      <Scale className="h-8 w-8 text-muted-foreground/30 mb-3" />
                      <p className="text-xs text-muted-foreground">
                        Select text from the chat and click "Ask Nyaya AI" for legal analysis
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {nyayaMessages.map((msg) => (
                        <div key={msg.id}>
                          {msg.role === "user" ? (
                            <div className="bg-primary/10 p-2.5 rounded-md">
                              {msg.selectedText && (
                                <div className="text-[10px] text-muted-foreground mb-1.5 pb-1.5 border-b border-muted">
                                  Selected: "{msg.selectedText.substring(0, 60)}…"
                                </div>
                              )}
                              <p className="text-xs">{msg.content}</p>
                            </div>
                          ) : (
                            <Card className="border-0 shadow-sm">
                              <CardContent className="p-2.5">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Scale className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-medium">Nyaya AI</span>
                                  {msg.confidence && <ConfidenceIndicator value={msg.confidence} showLabel={false} />}
                                </div>
                                <div
                                  className="text-xs leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                                />
                                {msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-2 pt-2 border-t space-y-1">
                                    <h4 className="text-[10px] font-medium text-muted-foreground">Sources</h4>
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
                      {nyayaLoading && (
                        <Card className="border-0 shadow-sm">
                          <CardContent className="p-2.5">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3 w-3 animate-pulse text-primary shrink-0" />
                              <AiThinkingText size="xs" />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      <div ref={nyayaMessagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="p-3 border-t shrink-0">
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Ask Nyaya AI…"
                      value={nyayaInput}
                      onChange={(e) => setNyayaInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleNyayaSend()}
                      className="text-xs h-8"
                      disabled={nyayaLoading}
                      data-testid="input-nyaya"
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleNyayaSend}
                      disabled={nyayaLoading || !nyayaInput.trim()}
                      data-testid="button-send-nyaya"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notes panel ── */}
            {rightPanel === "notes" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b flex items-center gap-2 shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Notes</span>
                </div>
                <div className="flex border-b shrink-0">
                  <button
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${notesTab === "write" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setNotesTab("write")}
                    data-testid="button-notes-tab-write"
                  >
                    Write
                  </button>
                  <button
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${notesTab === "saved" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setNotesTab("saved")}
                    data-testid="button-notes-tab-saved"
                  >
                    Saved {notes.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">{notes.length}</span>}
                  </button>
                </div>

                {notesTab === "write" ? (
                  <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Write your notes here…"
                      className="flex-1 min-h-0 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground"
                      data-testid="textarea-note"
                    />
                    <Button
                      className="w-full shrink-0"
                      size="sm"
                      onClick={handleSaveNote}
                      disabled={!newNote.trim()}
                      data-testid="button-save-note"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Note
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-3">
                    {notes.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">No saved notes yet</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">Switch to Write tab to add one</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <Card key={note.id} className="border shadow-sm">
                            <CardContent className="p-3">
                              <p className="text-xs whitespace-pre-wrap mb-2 text-foreground">{note.content}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteNote(note.id)}
                                  data-testid={`button-delete-note-${note.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Nyaya prompt dialog ── */}
      <Dialog open={showNyayaPromptDialog} onOpenChange={setShowNyayaPromptDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Ask Nyaya AI
            </DialogTitle>
            <DialogDescription>
              Ask a question about the selected text from your document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Selected text:</p>
              <p className="text-sm italic">
                "{pendingSelectedText.length > 200 ? pendingSelectedText.slice(0, 200) + "…" : pendingSelectedText}"
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Ask anything…"
                value={nyayaInput}
                onChange={(e) => setNyayaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendNyayaPrompt()}
                className="flex-1"
                data-testid="input-nyaya-prompt"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNyayaPromptDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSendNyayaPrompt}
                className="flex-1 bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 shadow-md shadow-amber-500/20"
                data-testid="button-send-nyaya-prompt"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
