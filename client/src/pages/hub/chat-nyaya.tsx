import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ModelBadge } from "@/components/model-badge";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { CostDisplay } from "@/components/cost-display";
import { CitationCard } from "@/components/citation-card";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Scale,
  Send,
  Sparkles,
  Lightbulb,
  MessageSquare,
  History,
  Clock,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ModelTier, Citation, ChatSession } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: ModelTier;
  confidence?: number;
  cost?: number;
  citations?: Citation[];
}

const sampleQuestions = [
  "What are the grounds for filing a writ petition under Article 226?",
  "Explain the doctrine of basic structure with relevant case laws",
  "What is the limitation period for filing a civil suit for recovery of money?",
  "What are the essentials of a valid contract under Indian Contract Act?",
];

export default function NyayaAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message?: string) => {
    const query = message || input.trim();
    if (!query || isLoading) return;

    let sessionId = currentSessionId;
    
    if (!sessionId && messages.length === 0) {
      const session = await createSessionMutation.mutateAsync(query.substring(0, 50) + "...");
      sessionId = session.id;
      setCurrentSessionId(session.id);
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, sessionId }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Partial<Message> = {};

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
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages([]);
    setShowHistoryDialog(false);
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <Button variant="ghost" size="icon" data-testid="button-back-hub">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="p-2 rounded-md bg-primary/10">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold">Nyaya AI</h1>
            <p className="text-xs text-muted-foreground">Your intelligent legal assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Trained on 1000+ legal documents
          </Badge>
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

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Scale className="h-16 w-16 mb-6 text-muted-foreground/30" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Nyaya AI</h2>
              <p className="text-muted-foreground text-center max-w-md mb-8">
                Ask any legal question and get accurate, citation-backed answers instantly. Trained on Indian law, statutes, and case precedents.
              </p>

              <div className="w-full max-w-2xl">
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">Try These Sample Questions</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {sampleQuestions.map((q, i) => (
                    <Card
                      key={i}
                      className="hover-elevate cursor-pointer"
                      onClick={() => handleSend(q)}
                      data-testid={`card-sample-${i}`}
                    >
                      <CardContent className="p-3 flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <p className="text-sm">{q}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
                  {msg.role === "user" ? (
                    <div className="bg-primary text-primary-foreground p-4 rounded-lg max-w-[80%]">
                      <p>{msg.content}</p>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Scale className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Nyaya AI</span>
                          {msg.modelUsed && <ModelBadge tier={msg.modelUsed} />}
                          {msg.confidence && <ConfidenceIndicator value={msg.confidence} showLabel={false} />}
                          {msg.cost && <CostDisplay amount={msg.cost} size="sm" />}
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-4 pt-4 border-t space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground">Sources</h4>
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
              {isLoading && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
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
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            placeholder="Ask any legal question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading}
            data-testid="input-nyaya"
          />
          <Button onClick={() => handleSend()} disabled={isLoading} data-testid="button-send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
            <Button onClick={handleNewChat} variant="outline" className="w-full" data-testid="button-new-chat">
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
                                {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                              </span>
                              {session.messageCount && session.messageCount > 0 && (
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
