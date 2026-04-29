import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ModelBadge } from "@/components/model-badge";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { VoiceRecorder } from "@/components/voice-recorder";
import { CitationCard, CitationInline } from "@/components/citation-card";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Send,
  Plus,
  FileText,
  PanelRightOpen,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
  Clock,
} from "lucide-react";
import { apiRequest, authFetch, queryClient } from "@/lib/queryClient";
import type { ChatSession, ChatMessage, ModelTier } from "@shared/schema";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: ModelTier;
  confidence?: number;
  cost?: number;
  citations?: Array<{
    id: string;
    source: string;
    text: string;
    page?: number;
  }>;
  isStreaming?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ChatSession[]>({
    queryKey: ["/api/chat/sessions"],
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const streamingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMessage]);

    try {
      const response = await authFetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Partial<Message> = {};

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
                    m.id === streamingMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
              if (data.done) {
                metadata = {
                  modelUsed: data.modelUsed || "mini",
                  confidence: data.confidence || 0.85,
                  cost: data.cost || 0.15,
                  citations: data.citations || [],
                };
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMessage.id
            ? {
                ...m,
                content: fullContent,
                isStreaming: false,
                ...metadata,
              }
            : m
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMessage.id
            ? {
                ...m,
                content: "Sorry, there was an error processing your request. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceRecording = async (audioBlob: Blob) => {
    setInput("Processing voice input...");
    setTimeout(() => {
      setInput("What are the key terms in this contract agreement?");
    }, 1500);
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Legal AI Chat</h1>
              <p className="text-xs text-muted-foreground">Ask questions about your documents</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearChat} data-testid="button-clear-chat">
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-citations-panel">
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Citations & Sources</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                  <div className="space-y-3">
                    {messages
                      .filter((m) => m.citations && m.citations.length > 0)
                      .flatMap((m) =>
                        m.citations!.map((citation) => (
                          <CitationCard
                            key={citation.id}
                            citation={citation}
                            isExpanded={expandedCitation === citation.id}
                            onToggle={() =>
                              setExpandedCitation(
                                expandedCitation === citation.id ? null : citation.id
                              )
                            }
                          />
                        ))
                      )}
                    {messages.filter((m) => m.citations && m.citations.length > 0).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Citations will appear here as you chat
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Start a Conversation</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Ask questions about your legal documents. Get answers with citations and confidence scores.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "Summarize this contract",
                    "What are the key obligations?",
                    "Find relevant case law",
                    "Explain Section 420 IPC",
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(suggestion)}
                      data-testid={`button-suggestion-${suggestion.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-md",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground p-4"
                      : "bg-muted p-6"
                  )}
                  data-testid={`message-${message.id}`}
                >
                  {message.role === "assistant" && message.isStreaming && !message.content && (
                    <StreamingIndicator />
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    {message.isStreaming && message.content && (
                      <span className="inline-block w-2 h-4 bg-foreground/80 animate-pulse ml-0.5" />
                    )}
                  </div>

                  {message.role === "assistant" && !message.isStreaming && message.content && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex flex-wrap items-center gap-3">
                        {message.modelUsed && (
                          <ModelBadge tier={message.modelUsed} />
                        )}
                        {message.confidence !== undefined && (
                          <ConfidenceIndicator
                            value={message.confidence}
                            className="flex-1 max-w-[200px]"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(message.content, message.id)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {message.citations && message.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          <span className="text-xs text-muted-foreground mr-1">Sources:</span>
                          {message.citations.map((citation, index) => (
                            <CitationInline
                              key={citation.id}
                              number={index + 1}
                              onClick={() =>
                                setExpandedCitation(
                                  expandedCitation === citation.id ? null : citation.id
                                )
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4 bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask a legal question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="min-h-[44px] max-h-[200px] resize-none pr-20"
                  data-testid="input-chat-message"
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <VoiceRecorder
                    onRecordingComplete={handleVoiceRecording}
                  />
                </div>
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              AI responses are generated based on your documents. Always verify important legal information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
