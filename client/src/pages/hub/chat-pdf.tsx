import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { ModelBadge } from "@/components/model-badge";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { CostDisplay } from "@/components/cost-display";
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
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatSession, ModelTier, Citation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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
  const [nyayaExpanded, setNyayaExpanded] = useState(false);
  const [nyayaSessionId, setNyayaSessionId] = useState<string | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<SelectionPosition | null>(null);
  
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesTab, setNotesTab] = useState<"write" | "saved">("write");
  
  const [showNyayaPromptDialog, setShowNyayaPromptDialog] = useState(false);
  const [pendingSelectedText, setPendingSelectedText] = useState("");
  
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
    setNyayaExpanded(true);
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
      fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "user", content: fullMessage }),
      }).catch(console.error);
    }

    try {
      const response = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, sessionId }),
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
        fetch("/api/chat/messages", {
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
      fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "user", content: messageContent }),
      }).catch(console.error);
    }

    try {
      const response = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nyayaInput, sessionId }),
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
        fetch("/api/chat/messages", {
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

  const handleFilesSelected = async (files: File[]) => {
    const newDocs: UploadedDoc[] = files.map((file, i) => ({
      id: `temp-${Date.now()}-${i}`,
      name: file.name,
      pages: 0,
      status: "processing" as const,
    }));
    setUploadedDocs(newDocs);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const uploadedDocuments = await response.json();
      
      setUploadedDocs(
        uploadedDocuments.map((doc: { id: string; name: string; pages: number; extractedText?: string }) => ({
          id: doc.id,
          name: doc.name,
          pages: doc.pages || 0,
          status: "ready" as const,
          content: doc.extractedText || "",
        }))
      );
    } catch (error) {
      console.error("Upload error:", error);
      setUploadedDocs((prev) =>
        prev.map((doc) => ({ ...doc, status: "ready" as const }))
      );
    }
  };

  const handleStartChat = async () => {
    if (uploadedDocs.length === 0) return;
    
    const title = uploadedDocs.length === 1 
      ? `Chat: ${uploadedDocs[0].name}` 
      : `Chat: ${uploadedDocs.length} documents`;
    
    const documentIds = uploadedDocs.map(d => d.id).filter(id => !id.startsWith("temp-"));
    
    const response = await apiRequest("POST", "/api/chat/sessions", {
      title,
      sessionType: "chatwithpdf",
      documentIds,
    });
    const session = await response.json() as ChatSession;
    
    setSessionDocumentIds(documentIds);
    queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    setCurrentSessionId(session.id);
    setShowUploadDialog(false);
    setViewMode("chat");
  };

  const currentDocs = uploadedDocs;

  const handleOpenSession = async (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages([]);
    setNyayaMessages([]);
    setNyayaSessionId(null);
    setViewMode("chat");
    
    const docIds = session.documentIds || [];
    setSessionDocumentIds(docIds);
    
    try {
      const messagesResponse = await fetch(`/api/chat/sessions/${session.id}/messages`);
      if (messagesResponse.ok) {
        const loadedMessages = await messagesResponse.json();
        setMessages(loadedMessages.map((m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.role === "assistant" ? stripMarkdown(m.content) : m.content,
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
        const nyayaMessagesResponse = await fetch(`/api/chat/sessions/${nyayaSession.id}/messages`);
        if (nyayaMessagesResponse.ok) {
          const loadedNyayaMessages = await nyayaMessagesResponse.json();
          setNyayaMessages(loadedNyayaMessages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.role === "assistant" ? stripMarkdown(m.content) : m.content,
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
            const response = await fetch(`/api/documents/${docId}`);
            if (response.ok) {
              return response.json();
            }
            return null;
          })
        );
        const validDocs = docs.filter((d) => d !== null);
        setUploadedDocs(
          validDocs.map((doc: { id: string; name: string; pages: number; extractedText?: string }) => ({
            id: doc.id,
            name: doc.name,
            pages: doc.pages || 0,
            status: "ready" as const,
            content: doc.extractedText || "",
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
      const localDocIds = uploadedDocs.map(d => d.id).filter(id => !id.startsWith("temp-"));
      const documentIds = localDocIds.length > 0 ? localDocIds : (sessionDocumentIds.length > 0 ? sessionDocumentIds : []);

      if (documentIds.length === 0) {
        console.warn("No documents available for query - response may not be grounded in documents");
      }

      const response = await fetch("/api/chat/query", {
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
                  prev.map((m) => (m.id === assistantId ? { ...m, content: stripMarkdown(fullContent) } : m))
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
      
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

  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <Link href="/hub">
            <Button variant="ghost" size="icon" data-testid="button-back-hub">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
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
                Upload PDFs, case files, or evidence folders (up to 800 pages per document)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <UploadDropzone
                onUpload={handleFilesSelected}
                maxFiles={20}
              />

              {uploadedDocs.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  <h4 className="text-sm font-medium">Uploaded Documents</h4>
                  {uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted rounded-md overflow-hidden">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate" title={doc.name}>
                        {doc.name.length > 35 ? doc.name.slice(0, 35) + "..." : doc.name}
                      </span>
                      <Badge variant={doc.status === "ready" ? "outline" : "secondary"} className="text-[10px] shrink-0">
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="flex-1 shrink-0">
                  Cancel
                </Button>
                <Button
                  onClick={handleStartChat}
                  disabled={uploadedDocs.length === 0 || uploadedDocs.some(d => d.status === "processing")}
                  className="flex-1 shrink-0"
                  data-testid="button-start-chat"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Chat
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
              {currentDocName ? (currentDocName.length > 30 ? currentDocName.slice(0, 30) + '...' : currentDocName) : "DocuChat"}
            </h1>
            {uploadedDocs.length > 1 && (
              <p className="text-xs text-muted-foreground">+{uploadedDocs.length - 1} more documents</p>
            )}
          </div>
          {uploadedDocs.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{uploadedDocs.length} documents</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant={nyayaExpanded ? "default" : "outline"}
            size="sm"
            onClick={() => setNyayaExpanded(!nyayaExpanded)}
            data-testid="button-toggle-nyaya"
            className={nyayaExpanded ? "bg-gradient-to-r from-indigo-500 to-purple-500" : ""}
          >
            <Scale className="mr-2 h-4 w-4" />
            Nyaya AI
            {nyayaMessages.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{nyayaMessages.length}</Badge>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowNotesPanel(!showNotesPanel)}
            data-testid="button-toggle-notes"
          >
            <FileText className="mr-2 h-4 w-4" />
            Notes
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative" ref={chatContainerRef}>
          {selectionPosition && (
            <div
              className="absolute z-50 animate-in fade-in duration-150"
              style={{
                left: `${selectionPosition.x}px`,
                top: `${selectionPosition.y}px`,
                transform: "translateX(-50%)",
              }}
            >
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg gap-1.5"
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
                      onClick={() => {
                        setInput(action.label);
                      }}
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
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t bg-background">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input
                placeholder="Ask about your documents..."
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

        {showNotesPanel && (
          <div className="w-80 border-l flex flex-col bg-background">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Notes</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowNotesPanel(false)}
                data-testid="button-close-notes"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <div className="flex border-b">
              <button
                className={`flex-1 py-2 text-xs font-medium ${notesTab === "write" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                onClick={() => setNotesTab("write")}
              >
                Write
              </button>
              <button
                className={`flex-1 py-2 text-xs font-medium ${notesTab === "saved" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                onClick={() => setNotesTab("saved")}
              >
                Saved ({notes.length})
              </button>
            </div>

            <ScrollArea className="flex-1 p-3">
              {notesTab === "write" ? (
                <div className="space-y-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write your notes here..."
                    className="w-full h-48 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground"
                    data-testid="textarea-note"
                  />
                  <Button 
                    className="w-full" 
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
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">No saved notes yet</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <Card key={note.id} className="border-0 shadow-sm">
                        <CardContent className="p-3">
                          <p className="text-xs whitespace-pre-wrap mb-2">{note.content}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {nyayaExpanded && (
          <div className="w-80 border-l flex flex-col bg-gradient-to-b from-indigo-50/50 to-background dark:from-indigo-950/20">
            <div className="p-3 border-b flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500">
                  <Scale className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-medium text-sm">Nyaya AI</span>
                {nyayaMessages.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {nyayaMessages.length} messages
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setNyayaExpanded(false)}
                data-testid="button-close-nyaya"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-3">
              {nyayaMessages.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                  <Scale className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-xs text-muted-foreground">
                    Select text from the document chat and click "Ask Nyaya AI" for legal analysis
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
                              Selected: "{msg.selectedText.substring(0, 60)}..."
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
                              {msg.modelUsed && <ModelBadge tier={msg.modelUsed} />}
                              {msg.confidence && <ConfidenceIndicator value={msg.confidence} showLabel={false} />}
                            </div>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
                          <Sparkles className="h-3 w-3 animate-pulse text-primary" />
                          <span className="text-xs text-muted-foreground">Thinking...</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <div ref={nyayaMessagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Ask Nyaya AI..."
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
      </div>
      
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
              <p className="text-sm italic">"{pendingSelectedText.length > 200 ? pendingSelectedText.slice(0, 200) + "..." : pendingSelectedText}"</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Ask anything..."
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
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500"
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
