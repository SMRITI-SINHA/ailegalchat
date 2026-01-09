import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ArrowRight,
  Sparkles,
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatSession, ModelTier, Citation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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
}

interface SelectionPosition {
  x: number;
  y: number;
  text: string;
}

type ViewMode = "list" | "chat";

export default function ChatWithPDFPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const nyayaMessagesEndRef = useRef<HTMLDivElement>(null);

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

  const createNyayaSessionMutation = useMutation({
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

  const handleAskNyayaAI = async (selectedText?: string) => {
    const query = selectedText || selectionPosition?.text;
    if (!query) return;

    setNyayaExpanded(true);
    setSelectionPosition(null);
    window.getSelection()?.removeAllRanges();

    let sessionId = nyayaSessionId;

    if (!sessionId) {
      const session = await createNyayaSessionMutation.mutateAsync(
        `PDF Context: ${query.substring(0, 30)}...`
      );
      sessionId = session.id;
      setNyayaSessionId(session.id);
    }

    const userMsg: NyayaMessage = {
      id: Date.now().toString(),
      role: "user",
      content: `Regarding this text from my document: "${query}"\n\nPlease provide legal analysis and explanation.`,
      selectedText: query,
    };
    setNyayaMessages((prev) => [...prev, userMsg]);
    setNyayaLoading(true);

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
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
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
        prev.map((m) => (m.id === assistantId ? { ...m, ...metadata } : m))
      );
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

    if (!sessionId) {
      const session = await createNyayaSessionMutation.mutateAsync(
        `PDF Query: ${nyayaInput.substring(0, 30)}...`
      );
      sessionId = session.id;
      setNyayaSessionId(session.id);
    }

    const userMsg: NyayaMessage = {
      id: Date.now().toString(),
      role: "user",
      content: nyayaInput,
    };
    setNyayaMessages((prev) => [...prev, userMsg]);
    setNyayaInput("");
    setNyayaLoading(true);

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
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
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
        prev.map((m) => (m.id === assistantId ? { ...m, ...metadata } : m))
      );
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
      id: `doc-${Date.now()}-${i}`,
      name: file.name,
      pages: Math.floor(Math.random() * 100) + 20,
      status: "processing" as const,
    }));
    setUploadedDocs(newDocs);

    setTimeout(() => {
      setUploadedDocs((prev) =>
        prev.map((doc) => ({ ...doc, status: "ready" as const }))
      );
    }, 2000);
  };

  const handleStartChat = async () => {
    if (uploadedDocs.length === 0) return;
    
    const title = uploadedDocs.length === 1 
      ? `Chat: ${uploadedDocs[0].name}` 
      : `Chat: ${uploadedDocs.length} documents`;
    
    const session = await createSessionMutation.mutateAsync(title);
    setCurrentSessionId(session.id);
    setShowUploadDialog(false);
    setViewMode("chat");
  };

  const currentDocs = uploadedDocs;

  const handleOpenSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages([]);
    setViewMode("chat");
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Based on the uploaded documents, I found the following relevant information:\n\n**Key Points:**\n- The contract was executed on January 15, 2024\n- The parties involved are ABC Corp and XYZ Ltd\n- The agreement term is 24 months\n\nWould you like me to analyze any specific aspect in more detail?`,
      };
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
    }, 1500);
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
              <h1 className="font-semibold">Chat with PDF</h1>
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
            Upload PDF & Chat
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
                    <h3 className="font-semibold mb-2">No PDF Chats Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload your first PDF to start analyzing documents with AI.
                    </p>
                    <Button
                      onClick={() => {
                        setUploadedDocs([]);
                        setShowUploadDialog(true);
                      }}
                      data-testid="button-upload-first"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload PDF
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pdfSessions.map((session) => (
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
                            <div className="min-w-0">
                              <h3 className="font-medium text-sm truncate">{session.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">PDF Chat</Badge>
                                {session.messageCount && session.messageCount > 0 && (
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
                  ))}
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
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Uploaded Documents</h4>
                  {uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{doc.name}</span>
                      <Badge variant={doc.status === "ready" ? "outline" : "secondary"} className="text-[10px]">
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleStartChat}
                  disabled={uploadedDocs.length === 0 || uploadedDocs.some(d => d.status === "processing")}
                  className="flex-1"
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
      <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode("list")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold">Chat with PDF</h1>
          {uploadedDocs.length > 0 && (
            <Badge variant="secondary">{uploadedDocs.length} documents</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ArrowRight className="mr-2 h-4 w-4" />
            Send to Drafting
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setNyayaExpanded(!nyayaExpanded)}
            data-testid="button-toggle-nyaya"
          >
            <Scale className="mr-2 h-4 w-4" />
            Nyaya AI
            {nyayaExpanded ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronUp className="ml-1 h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r p-4 overflow-auto">
          <h3 className="font-medium text-sm mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Button key={action.label} variant="ghost" size="sm" className="w-full justify-start">
                <action.icon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

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
                onClick={() => handleAskNyayaAI()}
                data-testid="button-ask-nyaya-floating"
              >
                <Scale className="h-3.5 w-3.5" />
                Ask Nyaya AI
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-medium mb-2">Start a Conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask questions about your documents, request summaries, or use quick actions.
                    <br /><br />
                    <span className="text-xs text-muted-foreground/70">
                      Tip: Select any text in responses and click "Ask Nyaya AI" for legal analysis
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
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

        <Collapsible open={nyayaExpanded} onOpenChange={setNyayaExpanded}>
          <CollapsibleContent className="w-80 border-l flex flex-col bg-background">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
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
                            {msg.cost && (
                              <div className="mt-2 flex justify-end">
                                <CostDisplay amount={msg.cost} size="sm" />
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
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
